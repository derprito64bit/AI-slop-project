// Keeping the device's profile and the server's copy in step.
//
// THE SHAPE OF THIS, and why it is not simply "read from the server":
//
// The dashboard reads the profile synchronously, in dozens of places — every
// Keep button, every course tick, the sidebar badge. Making those reads remote
// would mean making them async, which means a loading state in each one, which
// means the site is unusable on a sleeping free-tier Render instance. So:
//
//   localStorage is the working copy. The server is the durable copy.
//
// Writes land locally and instantly (`saveProfile` is unchanged), and this file
// pushes them up afterwards, debounced. Sign-in pulls the server's copy down over
// the local one. Between sign-ins, the device wins.
//
// THE CONFLICT RULE, stated plainly because "it syncs" always hides one: last
// write wins, per whole profile. Two devices editing between sign-ins will not
// merge — the second one to push replaces the first. For a shortlist that one
// student edits from a phone and a laptop that is a fair trade for not building
// a merge engine; if two-device editing becomes real, this is the file that has
// to change, and `savedAt` on both copies is the clock to do it with.
//
// OFFLINE. Every failure leaves the data on the device and the dirty flag set, so
// nothing is lost and the next opportunity retries: the next write, coming back
// online, the tab being shown again, or a backoff timer. Being offline is never
// allowed to block or undo a student's own edit.

import { activeProfileKey, activeToken, activeAccountId, writeProfileFor } from './session'
import { fetchProfile, pushProfile, ApiError, type RemoteProfile } from './api'
import type { SavedProfile } from './profile'

// Type-only import above, deliberately: `profile.ts` imports this file to queue a
// push, so a value import would be a cycle. This file handles the record as raw
// storage and lets profile.ts own its shape.

/**
 * Marks the local copy as newer than the server's.
 *
 * Set when a change is queued and while a push is in flight; cleared only by a
 * push that the server accepted, or by a pull that replaced the local copy. So
 * "set" means "the server may not have this yet", which is the question every
 * retry trigger and the account page's backup panel actually ask.
 */
const DIRTY_KEY = 'acceptiversity.sync.dirty.v1'

// Long enough to collect a burst — ticking six courses is one push, not six —
// short enough that closing the tab a couple of seconds later still catches it.
const DEBOUNCE_MS = 1_500

// Backoff after a failed push. Capped, and never gives up entirely: the flag
// stays set, so the next edit or the next visibility change tries again.
const BACKOFF_MS = [2_000, 5_000, 15_000, 60_000]

export type SyncStatus = 'idle' | 'pending' | 'pushing' | 'error' | 'signed-out'

let status: SyncStatus = 'idle'
let timer: ReturnType<typeof setTimeout> | undefined
let inFlight: Promise<void> | null = null
let failures = 0

const listeners = new Set<(status: SyncStatus) => void>()

/** Subscribe to sync status, for the "saving…" / "not backed up" readouts. */
export function onSyncStatus(listener: (status: SyncStatus) => void): () => void {
  listeners.add(listener)
  listener(status)
  return () => listeners.delete(listener)
}

export function syncStatus(): SyncStatus {
  return status
}

function setStatus(next: SyncStatus): void {
  if (status === next) return
  status = next
  for (const listener of listeners) listener(next)
}

/* ------------------------------------------------------------ dirty flag --- */
// Persisted, not just held in memory: a change made and then a tab closed before
// the debounce fires has to still be known to be unsynced on the next load.

function markDirty(accountId: string): void {
  try {
    localStorage.setItem(DIRTY_KEY, accountId)
  } catch {
    /* storage unavailable — the in-memory timer is all we have */
  }
}

function clearDirty(accountId: string): void {
  try {
    // Only clear it if it is still ours. Signing out and in as someone else
    // between a queue and a flush must not tick off the other account's work.
    if (localStorage.getItem(DIRTY_KEY) === accountId) localStorage.removeItem(DIRTY_KEY)
  } catch {
    /* nothing to do */
  }
}

/** The account with unpushed local changes, if any. */
export function pendingAccountId(): string | null {
  try {
    return localStorage.getItem(DIRTY_KEY)
  } catch {
    return null
  }
}

/**
 * Drop the pending flag for an account being deleted.
 *
 * Not the same as a successful push clearing it. Deleting an account means there
 * is nothing left to push to, and leaving the flag behind would point every retry
 * trigger at an account that no longer exists.
 */
export function forgetPending(accountId: string): void {
  if (timer) {
    clearTimeout(timer)
    timer = undefined
  }
  failures = 0
  clearDirty(accountId)
  setStatus('signed-out')
}

/* ------------------------------------------------------------------ push --- */

function readLocal(): SavedProfile | null {
  try {
    const raw = localStorage.getItem(activeProfileKey())
    return raw ? (JSON.parse(raw) as SavedProfile) : null
  } catch {
    return null
  }
}

/**
 * Called by `saveProfile` on every write.
 *
 * Cheap and synchronous — it sets a flag and moves a timer. Nothing about a
 * student ticking a checkbox waits on a network call.
 */
export function queueProfilePush(): void {
  const accountId = activeAccountId()
  if (!accountId) {
    // Signed out: there is nowhere to push. Guest data lives on the device and
    // gets adopted at sign-up, which is a different mechanism entirely.
    setStatus('signed-out')
    return
  }

  markDirty(accountId)
  setStatus('pending')

  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = undefined
    void run()
  }, DEBOUNCE_MS)
}

/**
 * Push now and wait for it.
 *
 * Used where the answer matters before moving on: signing out, deleting an
 * account, leaving the page. Resolves either way — callers treat a failure as
 * "still on the device" rather than as something to show a dialog about.
 */
export async function flushProfile(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = undefined
  }
  await run()
}

async function run(): Promise<void> {
  // Coalesce: a flush landing on top of a debounced push should wait for the one
  // already going out rather than racing it with the same body.
  if (inFlight) return inFlight

  const token = activeToken()
  const accountId = activeAccountId()
  if (!token || !accountId) {
    setStatus('signed-out')
    return
  }

  const local = readLocal()
  if (!local) {
    // Nothing stored locally. Not an error — a signed-in student who has not kept
    // anything yet has nothing to back up.
    clearDirty(accountId)
    setStatus('idle')
    return
  }

  // Flag it before trying, not only when queued. A push can start without a
  // preceding local write — the first upload after a sign-up adopts a guest
  // profile by moving the record rather than saving it — and if that push fails
  // with no flag set, none of the retry triggers know there is anything to retry.
  markDirty(accountId)

  setStatus('pushing')
  inFlight = (async () => {
    try {
      await pushProfile(token, {
        answers: local.answers ?? null,
        shortlist: local.shortlist ?? [],
        courses: local.courses ?? [],
        notes: local.notes ?? {},
        tags: local.tags ?? {},
        savedAt: local.savedAt ?? new Date().toISOString(),
      })
      failures = 0
      clearDirty(accountId)
      setStatus('idle')
    } catch (cause) {
      failures += 1
      setStatus('error')

      // A 401 means the token is done. Don't spin: `verifySession` on the next
      // load is what resolves it, and the data stays on the device meanwhile.
      const dead = cause instanceof ApiError && cause.status === 401
      if (!dead) {
        const wait = BACKOFF_MS[Math.min(failures - 1, BACKOFF_MS.length - 1)]
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = undefined
          void run()
        }, wait)
      }
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

/* ------------------------------------------------------------------ pull --- */

/**
 * Write a server profile into the local record for an account.
 *
 * Synchronous, because both sign-up and sign-in need the dashboard to be correct
 * on the very next render. The shape written here is `SavedProfile` — the same
 * thing `loadProfile` expects to read.
 */
export function applyRemoteProfile(accountId: string, remote: RemoteProfile): void {
  const record: SavedProfile = {
    // EVERY FIELD OF SurveyAnswers HAS TO BE LISTED HERE. This rebuilds the
    // local record from scratch on every pull, so a field that is missing from
    // this object is not merely "not synced" — it is erased from the device the
    // first time the student signs in somewhere else, silently, with their
    // answer still sitting on the server. Adding a question means adding a line
    // here, and the survey's `EMPTY` object is the checklist.
    answers: remote.answers
      ? {
          field: remote.answers.field ?? '',
          province: remote.answers.province ?? '',
          average: typeof remote.answers.average === 'number' ? remote.answers.average : null,
          // The server validates this against the same three values, but a
          // hand-edited document should not be able to make the dashboard read
          // `AMBITION_LABELS[undefined]`.
          ambition:
            remote.answers.ambition === 'safe' || remote.answers.ambition === 'reach'
              ? remote.answers.ambition
              : 'balanced',
          homeCity: remote.answers.homeCity ?? '',
          coop:
            remote.answers.coop === 'yes' || remote.answers.coop === 'no'
              ? remote.answers.coop
              : '',
          gradYear:
            typeof remote.answers.gradYear === 'number' ? remote.answers.gradYear : null,
        }
      : null,
    shortlist: remote.shortlist ?? [],
    courses: remote.courses ?? [],
    notes: remote.notes ?? {},
    tags: remote.tags ?? {},
    savedAt: remote.savedAt ?? new Date().toISOString(),
  }

  writeProfileFor(accountId, JSON.stringify(record))
  clearDirty(accountId)
  setStatus('idle')
}

/**
 * Fetch the server's copy and overwrite the local one.
 *
 * Only called on sign-in and from an explicit "refresh from server" action.
 * Never on a timer: a background pull would be able to undo something the
 * student had just typed on this device.
 */
export async function pullProfile(): Promise<RemoteProfile | null> {
  const token = activeToken()
  const accountId = activeAccountId()
  if (!token || !accountId) return null

  const remote = await fetchProfile(token)
  if (remote) applyRemoteProfile(accountId, remote)
  return remote
}

/* --------------------------------------------------------------- triggers --- */

let wired = false

/**
 * Wire the retry triggers. Called once, from AuthProvider.
 *
 * Guarded rather than idempotent-by-luck: React strict mode mounts effects twice
 * in development, and two sets of listeners would double every push.
 */
export function startSyncTriggers(): () => void {
  if (wired || typeof window === 'undefined') return () => {}
  wired = true

  const retryIfPending = () => {
    if (pendingAccountId() && activeToken()) {
      failures = 0
      void run()
    }
  }

  // Coming back online is the single most likely moment for a queued push to
  // succeed.
  window.addEventListener('online', retryIfPending)

  const onVisible = () => {
    if (document.visibilityState === 'visible') retryIfPending()
    // Hidden is the last reliable moment before a mobile browser freezes or
    // discards the tab. `pagehide`/`beforeunload` are less dependable on iOS.
    else void flushProfile()
  }
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    window.removeEventListener('online', retryIfPending)
    document.removeEventListener('visibilitychange', onVisible)
    wired = false
  }
}
