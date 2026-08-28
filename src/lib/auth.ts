// Accounts: a username, a password, and the profile data tied to them.
//
// The server is the authority. `api.ts` makes the requests; this file decides what
// happens locally around them — which account owns the profile record on disk,
// what a guest's work does when they sign up, and what is left behind when they
// sign out.
//
// WHAT CHANGED, 2026-08-18. Accounts were local for a few hours: a PBKDF2 hash in
// localStorage next to the data it was supposed to protect. That was never a
// security boundary and the file said so. It is gone — deleted rather than ported,
// because a server that trusts a digest computed in the browser has made the
// digest the password. The password now travels over TLS and is hashed with
// scrypt on arrival (passwords.js in the backend repo, TheKeems/UniServer).
//
// WHAT THAT BUYS, and what it costs:
//
//   + The account is real. It works on another device, it survives clearing the
//     browser, and the password check happens somewhere the student cannot edit.
//   + The profile follows them, which is the thing accounts were asked for.
//   - Signing in needs the network. The free Render tier sleeps, so the first
//     attempt in a while can take most of a minute; every call site treats that
//     as "waking up" rather than as a failure.
//   - Once signed in, nothing needs the network: the dashboard reads the local
//     copy and `sync.ts` pushes changes when it can. Being offline never blocks
//     a student from using their own list.
//
// STILL TRUE: no email, no real name, no age, no school. A username is a label
// the student invented. And `submitSurvey` in api.ts stays anonymous — the
// telemetry rows carry no account id, so they cannot be joined to a person.

import {
  ApiError,
  authenticate,
  changeRemotePassword,
  createAccount,
  deleteRemoteAccount,
  fetchAccount,
  type RemoteAccount,
  type RemoteProfile,
} from './api'
import {
  activeToken,
  adoptGuestProfile,
  cachedAccount,
  endSession,
  isGuest,
  removeProfileFor,
  startSession,
  updateSessionAccount,
  type SessionAccount,
} from './session'
import { applyRemoteProfile, flushProfile, forgetPending, pullProfile } from './sync'
import { clearTracker } from './tracker'

/** What the rest of the app sees. */
export type Account = SessionAccount

/**
 * The server's account shape, narrowed to the one we cache.
 *
 * The only difference is `isAdmin`, which is optional on the wire — a server
 * build predating the field just omits it — and required here. Absent is not an
 * admin, and this is the single place that decision gets made rather than seven
 * `?? false`s scattered through the callers.
 */
function asAccount(remote: RemoteAccount): Account {
  return {
    id: remote.id,
    username: remote.username,
    createdAt: remote.createdAt,
    isAdmin: remote.isAdmin === true,
  }
}

/**
 * An error a form can render against the right input.
 *
 * `field` is what makes it worth a class: "that username is taken" belongs under
 * the username box, and a generic banner for everything means the student has to
 * work out which of three inputs to fix.
 *
 * `retryable` marks the failures that are nobody's fault — a sleeping server, no
 * connection — where the honest advice is "try that again" rather than "fix your
 * input".
 */
export class AuthError extends Error {
  field: 'username' | 'password' | 'confirm' | undefined
  retryable: boolean

  constructor(message: string, field?: AuthError['field'], retryable = false) {
    super(message)
    this.name = 'AuthError'
    this.field = field
    this.retryable = retryable
  }
}

/**
 * Turn a transport or server error into something a form can show.
 *
 * The mapping is the whole point: the server sends a machine-readable code, and
 * exactly one place decides which input that code belongs under.
 */
function asAuthError(cause: unknown, fallbackField?: AuthError['field']): AuthError {
  if (!(cause instanceof ApiError)) {
    return new AuthError('Something went wrong. Try again.', fallbackField)
  }

  switch (cause.code) {
    case 'username_taken':
      return new AuthError('That username is already taken.', 'username')
    case 'invalid_username':
      return new AuthError(cause.message, 'username')
    case 'invalid_password':
      return new AuthError(cause.message, 'confirm')
    case 'wrong_password':
      return new AuthError(cause.message, 'password')
    case 'invalid_credentials':
      return new AuthError('That username and password don’t match.', 'password')
    case 'rate_limited':
      return new AuthError(cause.message, fallbackField)
    case 'unauthorized':
      return new AuthError('Please sign in again.', undefined)
    case 'not_found':
    case 'http_404':
      // Worth its own message: this is what a client points at a server that has
      // not had the account routes deployed yet, and "wrong password" would send
      // whoever hits it looking in entirely the wrong place.
      return new AuthError(
        'Accounts aren’t available on the server yet. You can keep using the site without one.',
        undefined,
      )
    default:
      return new AuthError(cause.message, fallbackField, cause.isTransport)
  }
}

/* ---------------------------------------------------------- validation --- */
// Pure, exported, and tested: the forms call these so a student is told what is
// wrong before a request goes anywhere. The server enforces the same rules in
// validate.js in TheKeems/UniServer and is the copy that decides — this one is a
// courtesy, and
// if you change a number here change it there too.

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 200

const USERNAME_SHAPE = /^[a-z0-9][a-z0-9_-]*$/i

/**
 * The handful of passwords that turn up at the top of every breach list.
 *
 * Not a strength meter. Meters mostly teach people to add "1!" to the end. This
 * catches the genuinely reflexive answers, and the server checks the same list.
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwertyuiop', 'qwerty123', 'iloveyou', 'letmein', 'welcome1', 'abc12345',
  'football', 'princess', 'sunshine', 'baseball', 'trustno1', 'admin123',
])

export function usernameError(raw: string): string | undefined {
  const name = raw.trim()
  if (!name) return 'Pick a username.'
  if (name.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`
  if (name.length > USERNAME_MAX) return `At most ${USERNAME_MAX} characters.`
  if (!USERNAME_SHAPE.test(name)) {
    return 'Letters, numbers, hyphens and underscores only, starting with a letter or number.'
  }
  return undefined
}

/**
 * Password rules.
 *
 * Length first, because it is the only rule that reliably helps. No
 * character-class requirements: they push people towards "Passw0rd!".
 */
export function passwordError(raw: string, username?: string): string | undefined {
  if (!raw) return 'Pick a password.'
  if (raw.length < PASSWORD_MIN) return `At least ${PASSWORD_MIN} characters.`
  if (raw.length > PASSWORD_MAX) return `At most ${PASSWORD_MAX} characters.`
  if (username && raw.toLowerCase() === username.trim().toLowerCase()) {
    return 'Your password can’t be your username.'
  }
  if (COMMON_PASSWORDS.has(raw.toLowerCase())) {
    return 'That’s one of the most common passwords. Pick another.'
  }
  return undefined
}

export function confirmError(password: string, confirm: string): string | undefined {
  if (!confirm) return 'Type your password again.'
  if (password !== confirm) return 'Those two don’t match.'
  return undefined
}

/* ------------------------------------------------------------- read state --- */

/**
 * The signed-in account, from the local session cache.
 *
 * Synchronous and offline-safe: it reports who signed in on this device, not who
 * the server currently agrees is signed in. `verifySession` is the one that asks.
 */
export function currentAccount(): Account | null {
  return cachedAccount()
}

export function isSignedIn(): boolean {
  return cachedAccount() !== null
}

/* ------------------------------------------------------------- actions --- */

/**
 * Create an account, sign into it, and carry any guest work across.
 *
 * The order matters. The account is created first, because if that fails there is
 * nothing to adopt into and the guest's data must be left exactly where it was.
 * Then the local record moves under the new account id, then it is pushed — so a
 * failed push leaves the data on the device rather than losing it.
 */
export async function signUp(
  rawUsername: string,
  password: string,
): Promise<{ account: Account; adopted: boolean }> {
  const username = rawUsername.trim()

  const nameProblem = usernameError(username)
  if (nameProblem) throw new AuthError(nameProblem, 'username')
  const passProblem = passwordError(password, username)
  if (passProblem) throw new AuthError(passProblem, 'password')

  let result
  try {
    result = await createAccount(username, password)
  } catch (cause) {
    throw asAuthError(cause, 'username')
  }

  const account = asAccount(result.account)
  const adopted = adoptGuestProfile(account.id)
  startSession(account, result.token)

  // A brand-new account's server profile is empty, so the local copy is the one
  // worth keeping. Push it rather than pulling over it — pulling here is how the
  // adopted survey answers would get wiped by an empty server record.
  if (adopted) {
    await flushProfile().catch(() => {
      /* stays on the device, and sync.ts retries */
    })
  } else if (result.profile) {
    applyRemoteProfile(account.id, result.profile)
  }

  return { account, adopted }
}

/**
 * Sign in.
 *
 * The server's copy wins. Someone signing in on a second device expects to see
 * the list they built on the first, and the local record for this account is a
 * cache of exactly that. Any guest data on the device is left alone — it belongs
 * to whoever was browsing signed out, which may not be this person.
 */
export async function signIn(rawUsername: string, password: string): Promise<Account> {
  const username = rawUsername.trim()
  if (!username || !password) {
    throw new AuthError('Enter your username and password.', username ? 'password' : 'username')
  }

  let result
  try {
    result = await authenticate(username, password)
  } catch (cause) {
    throw asAuthError(cause, 'password')
  }

  const account = asAccount(result.account)
  startSession(account, result.token)

  if (result.profile) {
    applyRemoteProfile(account.id, result.profile)
  } else {
    // The login response normally carries the profile; pull it if this server
    // build does not send one, so a sign-in is never a blank dashboard.
    await pullProfile().catch(() => {
      /* offline: the cached copy, if any, is what they get */
    })
  }

  return account
}

/**
 * Check the stored token with the server, refreshing the cached username.
 *
 * Called once on load, behind a UI that has already rendered from cache. Returns
 * the account, or null when the token is no longer good — and only then, because
 * a network failure must not sign anyone out: being offline is not the same as
 * being logged out, and treating it that way would drop people out of their own
 * dashboard on a train.
 */
export async function verifySession(): Promise<Account | null> {
  const token = activeToken()
  if (!token) return null

  try {
    const { account } = await fetchAccount(token)
    // Refreshes isAdmin as well as the username, so a promotion — or a
    // revocation — done in the database reaches the browser on the next load
    // rather than on the next sign-in.
    const fresh = asAccount(account)
    updateSessionAccount(fresh)
    return fresh
  } catch (cause) {
    if (cause instanceof ApiError && !cause.isTransport && cause.status === 401) {
      // Expired, revoked, or the account was deleted elsewhere. The local profile
      // copy is left on disk: it is still that student's work, and wiping it
      // because a token aged out would be its own kind of data loss.
      endSession()
      return null
    }
    return cachedAccount()
  }
}

/**
 * End the session.
 *
 * Pushes anything unsynced first, so signing out on a school computer does not
 * lose the last few things they kept. The local copy stays on the device — it is
 * a cache, and it is what makes signing back in instant; `deleteAccount` is the
 * one that removes.
 */
export async function signOut(): Promise<void> {
  await flushProfile().catch(() => {
    /* nothing more to try; the server has what it got */
  })
  endSession()
}

/** Change the password. The old one has to be right, and the server decides. */
export async function changePassword(current: string, next: string): Promise<void> {
  const token = activeToken()
  const account = cachedAccount()
  if (!token || !account) throw new AuthError('You’re not signed in.')

  const problem = passwordError(next, account.username)
  if (problem) throw new AuthError(problem, 'confirm')
  if (next === current) throw new AuthError('That’s the password you already have.', 'confirm')

  try {
    await changeRemotePassword(token, current, next)
  } catch (cause) {
    throw asAuthError(cause, 'password')
  }
}

/**
 * Delete the account and everything stored under it, on the server and here.
 *
 * The server call comes first. If it fails, nothing local is touched and the
 * student is told — a local wipe with the account still live on the server is the
 * worst of both, since signing in again would restore data they asked to be rid
 * of.
 */
export async function deleteAccount(): Promise<void> {
  const token = activeToken()
  const account = cachedAccount()
  if (!token || !account) return

  try {
    await deleteRemoteAccount(token)
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) {
      // Already gone as far as the server is concerned. Finish the local half.
    } else {
      throw asAuthError(cause)
    }
  }

  removeProfileFor(account.id)
  // Before ending the session, so the queue stops pointing at an account that no
  // longer exists — otherwise a pending push would sit in storage forever.
  forgetPending(account.id)

  // The tracker lives OUTSIDE the profile, in its own localStorage key, which is
  // why removeProfileFor does not reach it — and that is deliberate everywhere
  // except here. The button says "Delete everything" and the student typed
  // DELETE to confirm; leaving their application statuses and the deadline dates
  // they typed sitting on the device is not what either of those means.
  //
  // This is the ONLY place the tracker should be cleared. It stays out of the
  // profile the rest of the time — see the header of lib/tracker.ts.
  clearTracker()

  endSession()
}

/** Whether a guest has local work that signing up would carry across. */
export function hasGuestData(): boolean {
  if (!isGuest()) return false
  try {
    return Boolean(localStorage.getItem('acceptiversity.profile.v2'))
  } catch {
    return false
  }
}

/** Re-exported so components need one import for the profile-remote types. */
export type { RemoteProfile }
