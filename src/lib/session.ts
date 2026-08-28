// Who is signed in on this device, which profile record is theirs, and the token
// that proves it to the server.
//
// This file exists so `profile.ts`, `auth.ts` and `sync.ts` can all answer "whose
// data am I touching?" without importing each other. It knows about keys, raw
// strings and one token — never about the shape of a profile or how a password
// is checked.
//
// THE NAMESPACING RULE, unchanged by the move to a server:
//
//   acceptiversity.profile.v2            guest — the pre-accounts behaviour
//   acceptiversity.profile.v2.u.<id>     one account, keyed by its SERVER id
//
// The local record is a working copy, not the master. Every profile read in the
// app is synchronous and there are dozens of them, so the dashboard reads this
// copy and `sync.ts` pushes it to the server behind the UI. A signed-out visitor
// still keeps their data at the original key: adding accounts, and then moving
// them to a server, must not log anyone out of their own browser.

const SESSION_KEY = 'acceptiversity.session.v2'
const PROFILE_BASE_KEY = 'acceptiversity.profile.v2'

// The local-only account store this replaced, and the flag that remembers we
// cleaned it up. Both exist purely for the migration at the bottom of this file.
const LOCAL_ACCOUNTS_KEY = 'acceptiversity.accounts.v1'
const LOCAL_SESSION_KEY = 'acceptiversity.session.v1'
const MIGRATED_KEY = 'acceptiversity.accounts.moved.v1'

/** Wrapped because localStorage throws on access in some private modes. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — the session still holds for this page view */
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* nothing to do */
  }
}

/** The account fields worth caching, so the first paint needs no request. */
export type SessionAccount = {
  id: string
  username: string
  createdAt: string
  /**
   * Whether this account may edit site content.
   *
   * Cached like the username, so the admin link renders on the first frame
   * rather than after a round trip. THIS VALUE DECIDES NOTHING. It is read from
   * localStorage, which the person holding the browser can edit; flipping it
   * gets you an admin screen whose every save is refused, because UniServer
   * re-reads the database on each write. Rendering, not permission.
   */
  isAdmin: boolean
}

type StoredSession = SessionAccount & {
  token: string
  since: string
}

function readSession(): StoredSession | null {
  const raw = read(SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (!parsed.id || !parsed.token || !parsed.username) {
      // Half a session is no session. Clear it rather than leaving something
      // that fails one check here and a different one somewhere else.
      remove(SESSION_KEY)
      return null
    }
    return {
      id: parsed.id,
      username: parsed.username,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      // Anything other than a stored `true` is not an admin. A session written
      // by an older build has no such field at all, and false is the safe read.
      isAdmin: parsed.isAdmin === true,
      token: parsed.token,
      since: parsed.since ?? new Date().toISOString(),
    }
  } catch {
    remove(SESSION_KEY)
    return null
  }
}

/**
 * The signed-in account's id, or null for a guest.
 *
 * Deliberately synchronous. Making the answer to "whose profile?" a promise
 * would turn `loadProfile()` async and ripple through every component that
 * calls it.
 */
export function activeAccountId(): string | null {
  return readSession()?.id ?? null
}

/**
 * The bearer token, or null.
 *
 * Yes, this is in localStorage, and yes, that means script on the page could
 * read it. The alternative — an httpOnly cookie — needs a same-site backend, and
 * this is a static site on GitHub Pages talking to a Render service on another
 * domain. The mitigations that do apply: the token carries no personal data
 * (tokens.js in TheKeems/UniServer), it expires, and the API it opens holds a self-chosen
 * username and a shortlist rather than anything that spends money.
 */
export function activeToken(): string | null {
  return readSession()?.token ?? null
}

/** The cached account, so the navbar renders correctly on the first frame. */
export function cachedAccount(): SessionAccount | null {
  const session = readSession()
  if (!session) return null
  return {
    id: session.id,
    username: session.username,
    createdAt: session.createdAt,
    isAdmin: session.isAdmin,
  }
}

export function startSession(account: SessionAccount, token: string): void {
  write(
    SESSION_KEY,
    JSON.stringify({ ...account, token, since: new Date().toISOString() } satisfies StoredSession),
  )
}

/** Refresh the cached account without disturbing the token. */
export function updateSessionAccount(account: SessionAccount): void {
  const session = readSession()
  if (!session) return
  write(SESSION_KEY, JSON.stringify({ ...session, ...account }))
}

export function endSession(): void {
  remove(SESSION_KEY)
}

/* ------------------------------------------------------- profile records --- */

/** Storage key holding a given account's profile — the guest key for null. */
export function profileKeyFor(id: string | null): string {
  return id ? `${PROFILE_BASE_KEY}.u.${id}` : PROFILE_BASE_KEY
}

/** Storage key for whoever is signed in right now. */
export function activeProfileKey(): string {
  return profileKeyFor(activeAccountId())
}

/** True when nobody is signed in, so the guest-only migration may run. */
export function isGuest(): boolean {
  return activeAccountId() === null
}

/**
 * Move any guest profile into a newly created account.
 *
 * This is the point of tying accounts to survey data: the common path is
 * answering the questions, keeping a few programs, and *then* deciding to make
 * an account so the work is not stranded in one browser. Signing up has to carry
 * that across, or the account starts empty and the survey was for nothing.
 *
 * It moves rather than copies. Two divergent copies of one student's shortlist —
 * one guest, one account — would silently disagree the moment they edited the
 * signed-out one, and there is no sane way to merge them later.
 *
 * Only ever called on sign-up, never on sign-in: adopting guest data at sign-in
 * would hand whatever the last person on a shared laptop typed to whoever signs
 * in next, and on sign-in the server's copy is the one that matters anyway.
 */
export function adoptGuestProfile(accountId: string): boolean {
  const guest = read(profileKeyFor(null))
  if (!guest) return false
  write(profileKeyFor(accountId), guest)
  remove(profileKeyFor(null))
  return true
}

/** Delete one account's local profile copy. */
export function removeProfileFor(accountId: string): void {
  remove(profileKeyFor(accountId))
}

/** Overwrite an account's local copy with what came back from the server. */
export function writeProfileFor(accountId: string, raw: string): void {
  write(profileKeyFor(accountId), raw)
}

/* --------------------------------------------- the local-accounts cleanup --- */

/**
 * Retire the local-only account store.
 *
 * For a few hours on 2026-08-18 accounts existed as a username and a PBKDF2 hash
 * in localStorage, with no server behind them. Those accounts cannot be carried
 * forward: the server has never heard of them, and the password hash sitting next
 * to the data is exactly the thing that stopped being how this works.
 *
 * What can be carried forward is the part that matters — the student's answers
 * and shortlist. Those move back to the guest key, which means:
 *
 *   - nothing is deleted, and the dashboard shows the list immediately, signed
 *     out, with no sign-in prompt;
 *   - the next sign-up adopts it, by the same path a guest's data takes.
 *
 * Profiles belonging to *other* local accounts on the same device are left where
 * they are rather than deleted. Orphaned, but somebody's; a migration that throws
 * away a sibling's shortlist to tidy up is not a trade worth making.
 *
 * Runs once. Safe to call on every load.
 */
export function migrateLocalAccounts(): boolean {
  const stored = read(LOCAL_ACCOUNTS_KEY)
  if (!stored) return false

  try {
    // Which local account was signed in, if any — the v1 session had no token,
    // which is precisely how it is recognised.
    let lastActiveId: string | null = null
    const oldSession = read(LOCAL_SESSION_KEY)
    if (oldSession) {
      const parsed = JSON.parse(oldSession) as { accountId?: string }
      lastActiveId = parsed.accountId ?? null
    }

    // Fall back to the only account, when there is exactly one: a device with a
    // single local account has an unambiguous owner even with no session.
    if (!lastActiveId) {
      const accounts = JSON.parse(stored) as Array<{ id?: string }>
      if (Array.isArray(accounts) && accounts.length === 1) lastActiveId = accounts[0].id ?? null
    }

    if (lastActiveId) {
      const theirs = read(profileKeyFor(lastActiveId))
      // Never overwrite a guest record that already has something in it — that
      // is somebody's current work, and the migrated copy is the older one.
      if (theirs && !read(profileKeyFor(null))) {
        write(profileKeyFor(null), theirs)
        remove(profileKeyFor(lastActiveId))
      }
    }

    remove(LOCAL_ACCOUNTS_KEY)
    remove(LOCAL_SESSION_KEY)
    write(MIGRATED_KEY, '1')
    return true
  } catch {
    // A corrupted local store is not worth blocking startup over. Drop it: the
    // profile records it pointed at are keyed independently and stay put.
    remove(LOCAL_ACCOUNTS_KEY)
    remove(LOCAL_SESSION_KEY)
    return false
  }
}

/** True once the cleanup above has run, so the auth pages can explain it. */
export function localAccountsWereMoved(): boolean {
  return read(MIGRATED_KEY) === '1'
}

/** Stop showing the "accounts moved" notice. */
export function dismissMovedNotice(): void {
  remove(MIGRATED_KEY)
}
