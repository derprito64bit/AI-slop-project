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
//     school. Answers live in localStorage on their own device (the "no
//     accounts" decision in HANDOFF §4) and only the coarse band leaves it.

import { queryPrograms, type ProgramFilters } from './search'
import type { Program, University } from '../data/types'

const STORAGE_KEY = 'acceptiversity.profile.v1'

export type Ambition = 'safe' | 'balanced' | 'reach'

export type SurveyAnswers = {
  /** program field, e.g. 'engineering' — matches Program.field */
  field: string
  /** province code, or '' for no preference */
  province: string
  /** current overall average, 0-100 */
  average: number
  ambition: Ambition
}

export type SavedProfile = {
  answers: SurveyAnswers
  /** program ids the student chose to keep */
  shortlist: string[]
  savedAt: string
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
  other: 'Something else',
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
    // Matching compares against a reported median, so a program without one
    // cannot be matched at all — it would be an empty row in the results.
    withDataOnly: true,
    medianAtMost: Math.min(100, a.average + HEADROOM[a.ambition]),
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
export function averageBand(average: number): string {
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

export function loadProfile(): SavedProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedProfile
    // Guard against a half-written or hand-edited value.
    if (!parsed?.answers || typeof parsed.answers.average !== 'number') return null
    return { ...parsed, shortlist: parsed.shortlist ?? [] }
  } catch {
    return null
  }
}

export function saveProfile(answers: SurveyAnswers, shortlist: string[] = []): SavedProfile {
  const profile: SavedProfile = { answers, shortlist, savedAt: new Date().toISOString() }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    /* storage unavailable — the answers still work for this session */
  }
  return profile
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nothing to do */
  }
}

/** Add or remove a program from the saved shortlist. */
export function toggleShortlist(programId: string): SavedProfile | null {
  const current = loadProfile()
  if (!current) return null
  const shortlist = current.shortlist.includes(programId)
    ? current.shortlist.filter((id) => id !== programId)
    : [...current.shortlist, programId]
  return saveProfile(current.answers, shortlist)
}
