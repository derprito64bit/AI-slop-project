// Where each application is up to, and the deadlines the student found.
//
// DELIBERATELY OUTSIDE THE SYNCED PROFILE, and this is the whole design
// decision. `sync.ts` whitelists profile fields in both directions: a new field
// on SavedProfile would not just fail to upload, it would be ERASED, because
// `applyRemoteProfile` rebuilds the local record from that whitelist on every
// pull. A student would fill in their tracker, sign in on a laptop, and find it
// gone with nothing to explain why.
//
// So this lives in its own key, sync never touches it, and the UI says plainly
// that it stays on the device. When the backend learns these fields, this file
// is the one place that has to change — and until then nothing can silently eat
// the data.
//
// NO DATES ARE ASSERTED HERE. Deadlines are what the student read off an
// official page, stored with a link to that page. The project rule is that a
// fact is never recorded without a source, and a wrong deadline is the worst
// thing this site could publish — so it publishes none, and helps them keep
// track of the ones they verified themselves.

const KEY = 'acceptiversity.tracker.v1'

/**
 * Application stages.
 *
 * The last three are the dataset's own `decision` values (see data/types.ts),
 * on purpose: a finished application already holds everything an anonymous
 * community report would need, so it could feed that later without asking the
 * student to type any of it twice.
 */
export const STATUSES = [
  'researching',
  'applying',
  'applied',
  'offer',
  'waitlisted',
  'rejected',
] as const

export type Status = (typeof STATUSES)[number]

export const STATUS_LABELS: Record<Status, string> = {
  researching: 'Researching',
  applying: 'Applying',
  applied: 'Applied',
  offer: 'Offer',
  waitlisted: 'Waitlisted',
  rejected: 'Rejected',
}

/** The stages that are steps along the way, as opposed to an outcome. */
export const IN_PROGRESS: Status[] = ['researching', 'applying', 'applied']

/** A date the student found, and where they found it. */
export type Deadline = {
  /** what the date is for, in their words — "supplementary due" */
  label: string
  /** ISO yyyy-mm-dd, as typed into a date input */
  date: string
  /** the page they read it on; may be empty, and the UI nudges for it */
  source: string
}

export type TrackedProgram = {
  status: Status
  deadlines: Deadline[]
  updatedAt: string
}

export type Tracker = Record<string, TrackedProgram>

/* -------------------------------------------------------------- storage --- */
// try/catch throughout: localStorage throws outright in private mode on some
// browsers, and a tracker that takes the page down because storage is
// unavailable is worse than one that forgets.

export function loadTracker(): Tracker {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Tracker
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function save(tracker: Tracker): Tracker {
  try {
    localStorage.setItem(KEY, JSON.stringify(tracker))
  } catch {
    /* storage unavailable — the tracker still works for this session */
  }
  return tracker
}

/**
 * Apply a change to one program's record.
 *
 * Reads the current tracker from STORAGE rather than taking it as an argument,
 * for the reason `toggleCourse` in profile.ts does: deriving the next value
 * from React state meant several quick clicks all computed from the same stale
 * snapshot and only the last survived.
 */
function update(programId: string, change: (current: TrackedProgram) => TrackedProgram): Tracker {
  const tracker = loadTracker()
  const current = tracker[programId] ?? {
    status: 'researching' as Status,
    deadlines: [],
    updatedAt: new Date().toISOString(),
  }
  return save({
    ...tracker,
    [programId]: { ...change(current), updatedAt: new Date().toISOString() },
  })
}

/* --------------------------------------------------------------- status --- */

export function setStatus(programId: string, status: Status): Tracker {
  return update(programId, (current) => ({ ...current, status }))
}

export function statusOf(tracker: Tracker, programId: string): Status | null {
  return tracker[programId]?.status ?? null
}

/** Stop tracking a program entirely — removing the row, not resetting it. */
export function untrack(programId: string): Tracker {
  const tracker = loadTracker()
  delete tracker[programId]
  return save(tracker)
}

/* ------------------------------------------------------------ bulk add --- */

/**
 * Merge a set of program ids into a tracker, leaving anything already there
 * exactly as it was.
 *
 * Kept separate from `trackAll`, and given `now` as an argument, so the merge
 * rule can be tested without a storage stand-in and without the clock. The rule
 * is the whole point: an id ALREADY IN THE TRACKER IS RETURNED UNTOUCHED — same
 * status, same deadlines, same `updatedAt`.
 *
 * That matters because of where it is called from. The dashboard offers this as
 * one button over the student's entire kept list, and nothing stops it being
 * pressed again after they keep one more program. Someone who has already moved
 * two applications to `applied` and presses it a second time must not find them
 * back at `researching` — that would be silent, and there is nothing to undo it
 * from. Being a no-op for ids it already holds is also what makes the button
 * safe to press twice.
 */
export function withTracked(
  tracker: Tracker,
  programIds: string[],
  now = new Date().toISOString(),
): Tracker {
  const next = { ...tracker }
  for (const id of programIds) {
    // A falsy id would become a row keyed by '' that no program can ever match
    // and no part of the UI can offer to remove.
    if (!id || next[id]) continue
    next[id] = { status: 'researching', deadlines: [], updatedAt: now }
  }
  return next
}

/**
 * Start tracking every one of these that is not tracked yet, at the first
 * stage — the same place the per-row "+ Track" button starts one.
 */
export function trackAll(programIds: string[]): Tracker {
  return save(withTracked(loadTracker(), programIds))
}

/* ------------------------------------------------------------ deadlines --- */

export function addDeadline(programId: string, deadline: Deadline): Tracker {
  return update(programId, (current) => ({
    ...current,
    // Newest first is wrong for dates: they are read as a schedule, so they
    // sort by when they fall, not by when they were typed.
    deadlines: [...current.deadlines, deadline].sort((a, b) => a.date.localeCompare(b.date)),
  }))
}

export function removeDeadline(programId: string, index: number): Tracker {
  return update(programId, (current) => ({
    ...current,
    deadlines: current.deadlines.filter((_, i) => i !== index),
  }))
}

/** Every deadline across every program, in date order — the timeline view. */
export function allDeadlines(tracker: Tracker): Array<Deadline & { programId: string }> {
  return Object.entries(tracker)
    .flatMap(([programId, record]) => record.deadlines.map((d) => ({ ...d, programId })))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Whether a date has already passed.
 *
 * Compared as plain yyyy-mm-dd strings against the local date rather than
 * through Date objects: `new Date('2026-03-01')` is parsed as UTC midnight, so
 * anyone west of Greenwich sees a deadline turn red a day early.
 */
export function isPast(date: string, today = localToday()): boolean {
  return Boolean(date) && date < today
}

export function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Everything, gone. Separate from the profile's own "delete my data". */
export function clearTracker(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
}
