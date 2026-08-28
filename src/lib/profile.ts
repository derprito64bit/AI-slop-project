// The survey's answers, and how they turn into a program shortlist.
//
// Kept as pure functions so the matching can be tested without rendering
// anything, and so the honesty rules live in one reviewable place rather than
// being spread through JSX.
//
// Two constraints this file exists to hold:
//
//  1. NO probability of admission, ever. Every filter below is a comparison of
//     reported numbers ("programs where the median admitted student reported an
//     average at or below X"), never a chance of getting in. `search.ts` carries
//     the same rule for difficulty bands.
//  2. NO personal data. Nothing here identifies a student — no name, no age, no
//     school. An account (see `auth.ts`) is a username the student invents and a
//     password, which does not change that rule: the username is asked for as a
//     label, never as a real name.
//
//     What DID change on 2026-08-18: for a signed-in student this record is
//     uploaded, exact average included, so their list follows them to another
//     device. It used to stay on the device entirely. `api.ts` documents exactly
//     what goes over the wire, and the anonymous telemetry still sends a coarse
//     band rather than the average. Signed out, nothing is uploaded at all.
//
// WHOSE PROFILE. Which record these functions read and write depends on who is
// signed in, and `session.ts` owns that decision. A signed-out visitor keeps
// using the original key, so adding accounts did not strand anyone's existing
// shortlist behind a sign-in prompt.
//
// STILL SYNCHRONOUS, and this is the load-bearing decision. Every reader here is
// a component rendering now — a Keep button, a course tick, a sidebar badge — so
// storage stays the working copy and `sync.ts` pushes to the server behind the
// UI. Turning these into promises would put a loading state in every one of them
// and make the site unusable while a free-tier server wakes up.

import { queryPrograms, type ProgramFilters } from './search'
import { activeProfileKey, isGuest } from './session'
import { queueProfilePush } from './sync'
import type { Program, University } from '../data/types'

const LEGACY_KEY = 'acceptiversity.profile.v1'

export type Ambition = 'safe' | 'balanced' | 'reach'

export type SurveyAnswers = {
  /** program field, e.g. 'engineering' — matches Program.field. '' = skipped */
  field: string
  /** province code, or '' for no preference / skipped */
  province: string
  /**
   * Current overall average, 0-100 — or null when the question was skipped.
   *
   * null is a real answer, not a missing one. The survey lets a student skip
   * any question, and plenty will skip this one: they do not know it yet, or
   * they would rather not type it. Everything downstream treats null as "do
   * not filter by average" rather than as zero — an average of 0 would silently
   * match nothing, which is the worst way to handle a blank.
   */
  average: number | null
  ambition: Ambition
  /**
   * The city the student calls home, for map distances. '' = skipped.
   *
   * A city, never an address. It is the coarsest thing that still makes a
   * distance mean something, and coarse is the point: this record is uploaded
   * for a signed-in student, and the audience is mostly minors. Keys match
   * CITY_POINTS in data/campus-locations.ts.
   *
   * This used to live in its own localStorage key set from the Map view, which
   * meant it was asked for in the one place it was already obvious. Moving it
   * into the survey is what lets distance appear anywhere.
   */
  homeCity: string
  /**
   * Co-op preference. '' = no preference / skipped.
   *
   * The dataset supports this honestly because co-op and non-co-op are separate
   * programs and are never merged — see `isCoop` in search.ts.
   */
  coop: '' | 'yes' | 'no'
  /**
   * Calendar year the student expects to finish high school, or null.
   *
   * Kept deliberately coarse and deliberately OUT OF THE TELEMETRY. It is a
   * fact about the student rather than about a program, and /api/data is the
   * one endpoint whose rows must stay unlinkable to a person — see api.ts.
   * Inside the private profile it is fine, and it is what lets the site say
   * which application cycle's data is the one that describes them.
   */
  gradYear: number | null
}

export type SavedProfile = {
  /**
   * null when the student skipped the survey and started browsing instead.
   * Every tool asks for the one input it needs rather than the dashboard
   * refusing to load, so this being null is a normal state, not an error.
   */
  answers: SurveyAnswers | null
  /** program ids the student chose to keep */
  shortlist: string[]
  /** Ontario course codes the student is taking, e.g. ['ENG4U', 'MHF4U'] */
  courses: string[]
  /** programId -> free text */
  notes: Record<string, string>
  /** programId -> student-defined labels */
  tags: Record<string, string[]>
  savedAt: string
}

/** A profile with nothing in it yet — the shape every reader can rely on. */
export const EMPTY_PROFILE: Omit<SavedProfile, 'savedAt'> = {
  answers: null,
  shortlist: [],
  courses: [],
  notes: {},
  tags: {},
}

export const FIELD_LABELS: Record<string, string> = {
  engineering: 'Engineering',
  'computer-science': 'Computer science',
  'life-sciences': 'Life sciences',
  health: 'Health',
  business: 'Business',
  'physical-sciences': 'Physical sciences',
  'social-sciences': 'Social sciences',
  'arts-humanities': 'Arts & humanities',
  education: 'Education',
  law: 'Law',
  architecture: 'Architecture',
  agriculture: 'Agriculture',
  // Not "Something else". This bucket holds 247 real programs — "Science",
  // "Applied Science", direct-entry streams like Ivey AEO, "Humanities I" —
  // which are how several universities actually admit: you pick the subject in
  // second year. Labelling that as a leftover told a student the programs were
  // unclassified when the truth is they are undeclared, which is a feature of
  // the program and often the reason to apply to one.
  other: 'General & interdisciplinary',
}

export const PROVINCE_LABELS: Record<string, string> = {
  ON: 'Ontario',
  QC: 'Quebec',
  BC: 'British Columbia',
  AB: 'Alberta',
  NS: 'Nova Scotia',
  NB: 'New Brunswick',
  SK: 'Saskatchewan',
}

/**
 * How far above the student's own average to keep showing programs.
 *
 * This is the only place ambition does anything. It is a *view* setting — how
 * wide to cast the net — not an estimate of anything. A student on 88 asking
 * for reach programs sees programs whose admitted median was up to 96; that is
 * a statement about other people's reported averages, not about their odds.
 */
const HEADROOM: Record<Ambition, number> = {
  safe: -2,
  balanced: 3,
  reach: 8,
}

export const AMBITION_LABELS: Record<Ambition, { label: string; hint: string }> = {
  safe: { label: 'Comfortable', hint: 'Programs whose admitted median sits below your average.' },
  balanced: { label: 'Balanced', hint: 'A mix, up to a few points above your average.' },
  reach: { label: 'Ambitious', hint: 'Include programs well above your average.' },
}

/** Turn survey answers into the filters `search.ts` already understands. */
export function toFilters(a: SurveyAnswers): ProgramFilters {
  return {
    field: a.field || undefined,
    province: a.province || undefined,
    coop: a.coop || undefined,
    // Matching compares against a reported median, so a program without one
    // cannot be matched at all — it would be an empty row in the results.
    withDataOnly: true,
    // No average means no ceiling. Skipping the question has to widen the
    // shortlist, never empty it: `0 + headroom` would ask for programs whose
    // admitted median was at most 3%, and match nothing at all.
    medianAtMost:
      typeof a.average === 'number'
        ? Math.min(100, a.average + HEADROOM[a.ambition])
        : undefined,
  }
}

/**
 * The shortlist for a set of answers.
 *
 * Sorted by most-reported so the programs with the sturdiest data come first —
 * a median from 210 reports deserves to outrank one from 6.
 */
export function matchPrograms(
  answers: SurveyAnswers,
  programs: Program[],
  universities: University[],
  limit = 24,
): Program[] {
  return queryPrograms(
    programs,
    { filters: toFilters(answers), sort: 'most-reported' },
    universities,
  ).slice(0, limit)
}

/**
 * Coarse band for the anonymous telemetry payload.
 *
 * The exact average stays on the device; only the band is ever sent, so a
 * submission can never be traced back to one student's transcript.
 */
export function averageBand(average: number | null): string {
  // A skipped average is reported as skipped, not bucketed as a low one.
  if (typeof average !== 'number') return 'not-given'
  if (average >= 95) return '95+'
  if (average >= 90) return '90-94'
  if (average >= 85) return '85-89'
  if (average >= 80) return '80-84'
  if (average >= 75) return '75-79'
  return 'below-75'
}

/* ------------------------------------------------------------- storage --- */
// Wrapped in try/catch throughout: localStorage throws in private mode on some
// browsers, and a survey that crashes the page because storage is unavailable
// is worse than one that simply forgets.

/**
 * Read the stored profile, migrating a v1 record if that is all there is.
 *
 * Returns null only when the student has never interacted — the dashboard uses
 * that to show its "start here" state. Any stored record, even one with no
 * survey answers, comes back as a usable profile.
 */
export function loadProfile(): SavedProfile | null {
  try {
    const raw = localStorage.getItem(activeProfileKey()) ?? migrateLegacy()
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedProfile>
    // Fill in anything a hand-edited or older record is missing, so every
    // reader can assume the full shape.
    return {
      ...EMPTY_PROFILE,
      ...parsed,
      answers: isAnswers(parsed.answers) ? parsed.answers : null,
      shortlist: parsed.shortlist ?? [],
      courses: parsed.courses ?? [],
      notes: parsed.notes ?? {},
      tags: parsed.tags ?? {},
      savedAt: parsed.savedAt ?? new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function isAnswers(a: unknown): a is SurveyAnswers {
  if (!a || typeof a !== 'object') return false
  const { average, ambition } = a as SurveyAnswers
  // A record counts as answers if it has the shape, even when every question
  // was skipped: `average: null` with no field is still a set of answers, and
  // is what "Skip all" stores.
  return (average === null || typeof average === 'number') && typeof ambition === 'string'
}

/**
 * v1 stored only { answers, shortlist }. Carry it forward once, then leave it.
 *
 * Guests only. A v1 record predates accounts by definition, so it belongs to
 * whoever was using the browser, not to whichever account happens to be signed
 * in when the page loads — importing it into an account would hand one student's
 * old answers to another.
 */
function migrateLegacy(): string | null {
  if (!isGuest()) return null
  try {
    const old = localStorage.getItem(LEGACY_KEY)
    if (!old) return null
    const parsed = JSON.parse(old) as Partial<SavedProfile>
    const migrated = JSON.stringify({
      ...EMPTY_PROFILE,
      answers: isAnswers(parsed.answers) ? parsed.answers : null,
      shortlist: parsed.shortlist ?? [],
      savedAt: new Date().toISOString(),
    })
    localStorage.setItem(activeProfileKey(), migrated)
    localStorage.removeItem(LEGACY_KEY)
    return migrated
  } catch {
    return null
  }
}

/**
 * Write a whole profile. Callers usually go through `updateProfile`.
 *
 * The single funnel every mutation passes through, which is why the sync queue is
 * poked from here and from nowhere else: one line covers the Keep button, the
 * course checklist, notes, tags and the survey, and no future caller can add a
 * write that silently fails to reach the server.
 *
 * The queue call cannot throw and does not await — it sets a flag and moves a
 * timer. A student's click is never waiting on a request.
 */
export function saveProfile(profile: Omit<SavedProfile, 'savedAt'>): SavedProfile {
  const next: SavedProfile = { ...profile, savedAt: new Date().toISOString() }
  try {
    localStorage.setItem(activeProfileKey(), JSON.stringify(next))
  } catch {
    /* storage unavailable — the profile still works for this session */
  }
  queueProfilePush()
  return next
}

/**
 * Apply a partial change to the stored profile, creating one if needed.
 *
 * Creating on demand is what lets a student skip the survey: keeping a program
 * from Explore is enough to bring a profile into existence.
 */
export function updateProfile(patch: Partial<Omit<SavedProfile, 'savedAt'>>): SavedProfile {
  const current = loadProfile() ?? { ...EMPTY_PROFILE, savedAt: new Date().toISOString() }
  return saveProfile({ ...current, ...patch })
}

/**
 * Wipe the current profile — the signed-in account's, or the guest one.
 *
 * Does not touch the account itself. "Delete my data" and "delete my account"
 * are separate asks: a student may well want to start their list over without
 * losing the username they told their friends.
 *
 * Signed in, this writes an EMPTY profile rather than deleting the record, and
 * lets the normal push carry the emptiness to the server. Deleting the local key
 * outright would leave the server holding the old list, and signing in on any
 * device would bring back the data they just asked to be rid of — a delete that
 * quietly undoes itself is worse than no delete button.
 */
export function clearProfile(): void {
  try {
    if (isGuest()) {
      localStorage.removeItem(activeProfileKey())
      localStorage.removeItem(LEGACY_KEY)
      return
    }
  } catch {
    /* fall through: still attempt the signed-in path below */
  }
  saveProfile({ ...EMPTY_PROFILE })
}

/** Add or remove a program from the shortlist, creating a profile if needed. */
export function toggleShortlist(programId: string): SavedProfile {
  const current = loadProfile()
  const shortlist = current?.shortlist ?? []
  return updateProfile({
    shortlist: shortlist.includes(programId)
      ? shortlist.filter((id) => id !== programId)
      : [...shortlist, programId],
  })
}

export function isKept(profile: SavedProfile | null, programId: string): boolean {
  return Boolean(profile?.shortlist.includes(programId))
}

/**
 * Add or remove a course the student is taking.
 *
 * Reads the current list from storage rather than taking it as an argument.
 * Deriving it from React state meant four quick clicks all computed from the
 * same stale array and only the last one survived — ticking five courses in a
 * row kept exactly one.
 */
export function toggleCourse(code: string): SavedProfile {
  const courses = loadProfile()?.courses ?? []
  return updateProfile({
    courses: courses.includes(code) ? courses.filter((c) => c !== code) : [...courses, code],
  })
}

/** Save (or clear, when blank) a note against a program. */
export function setNote(programId: string, text: string): SavedProfile {
  const current = loadProfile()
  const notes = { ...(current?.notes ?? {}) }
  if (text.trim()) notes[programId] = text
  else delete notes[programId]
  return updateProfile({ notes })
}

/** Add or remove one of the student's own labels on a program. */
export function toggleTag(programId: string, tag: string): SavedProfile {
  const clean = tag.trim()
  const current = loadProfile()
  const tags = { ...(current?.tags ?? {}) }
  const existing = tags[programId] ?? []
  const next = existing.includes(clean)
    ? existing.filter((t) => t !== clean)
    : [...existing, clean]
  if (next.length) tags[programId] = next
  else delete tags[programId]
  return updateProfile({ tags })
}

/** Every tag the student has used, for filter chips. */
export function allTags(profile: SavedProfile | null): string[] {
  if (!profile) return []
  return [...new Set(Object.values(profile.tags).flat())].sort()
}

/* ------------------------------------------------------ balance check --- */

export type Fit = 'ambitious' | 'in-range' | 'comfortable'

/** How far from the student's average a median has to sit to change bucket. */
const FIT_MARGIN = 3

export const FIT_LABELS: Record<Fit, { label: string; blurb: string }> = {
  ambitious: {
    label: 'Ambitious',
    blurb: 'Admitted students reported averages above yours.',
  },
  'in-range': {
    label: 'In range',
    blurb: 'Admitted students reported averages close to yours.',
  },
  comfortable: {
    label: 'Comfortable',
    blurb: 'Admitted students reported averages below yours.',
  },
}

/**
 * Where a program sits relative to one student's average.
 *
 * This is deliberately NOT `difficultyBand` from search.ts. That one is
 * absolute — how competitive a program is for anyone. This is relative to the
 * person looking at it, and both are useful at once.
 *
 * It compares two reported numbers. It is not, and must never be presented as,
 * a chance of admission.
 */
export function fitFor(average: number, median: number | null | undefined): Fit | null {
  if (typeof median !== 'number') return null
  if (median > average + FIT_MARGIN) return 'ambitious'
  if (median < average - FIT_MARGIN) return 'comfortable'
  return 'in-range'
}

/** Counts per bucket, for the "is my list realistic?" readout. */
export function balanceOf(
  average: number,
  programs: Array<{ accepted?: { median: number } | null }>,
): Record<Fit, number> {
  const out: Record<Fit, number> = { ambitious: 0, 'in-range': 0, comfortable: 0 }
  for (const p of programs) {
    const fit = fitFor(average, p.accepted?.median)
    if (fit) out[fit] += 1
  }
  return out
}
