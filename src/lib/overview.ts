import SUMMARY from '../data/generated/summary.json'
import { COURSES } from './courses'
import type { SavedProfile } from './profile'

// What the dashboard's front page shows a student who has just arrived.
//
// The Overview's charts all describe the student's own list, so with nothing
// kept they have nothing to draw and the page collapses to four zeros. These
// helpers are the other half of that page: a path through the first three
// things worth doing, and a handful of real programs to start it with.
//
// EVERY NUMBER HERE COMES FROM THE GENERATED SUMMARY. Nothing is hand-typed —
// the home page once advertised "120+ programs" against a real 2,436, and the
// fix was to make the figure unable to drift from the dataset rather than to
// correct it once.
//
// Pure functions in lib/ rather than logic in the view, because the repo's
// Vitest runs in node with no DOM: anything left in the component cannot be
// tested at all.

export type StartStep = {
  key: string
  label: string
  done: boolean
  /** the progress, in words — shown beside the label */
  value: string
  to: string
}

/**
 * The three-step path shown in place of the empty stat tiles.
 *
 * "Answered the questions" is true as soon as `answers` EXISTS, even if every
 * single question was skipped on the way through. That is the right line
 * because the survey has two different exits: skipping each question in turn
 * finishes with a real answers object of blanks, while "Skip all — just let me
 * browse" abandons it and stores `answers: null` (Survey.tsx `finish`). The
 * first student went through it and should see a tick; the second did not.
 * A skipped answer is still a real answer — see the note on `average` in
 * profile.ts — so nothing here nags for the one number the site is most
 * careful about.
 *
 * Courses is done at the FIRST tick, not the ninth. Nine is the length of the
 * list, not a target: a Grade 12 student takes six to eight courses and nobody
 * takes all of ENG4U through SES4U, so requiring the full set would leave a
 * step that can never complete.
 */
export function startSteps(profile: SavedProfile): StartStep[] {
  const kept = profile.shortlist.length
  // Counted against the known list rather than taken as a length. A profile
  // synced from a build with more courses in it would otherwise print
  // "11 of 9", which reads as a bug in the page rather than a stale client.
  const ticked = profile.courses.filter((c) => COURSES.some((k) => k.code === c)).length

  return [
    {
      key: 'answers',
      label: 'Answer the questions',
      done: profile.answers !== null,
      value: profile.answers !== null ? 'Done' : 'Not yet',
      to: '/survey',
    },
    {
      key: 'kept',
      label: 'Keep a program',
      done: kept > 0,
      value: `${Math.min(kept, 1)} of 1`,
      to: '/profile/programs',
    },
    {
      key: 'courses',
      label: 'Tick your Grade 12 courses',
      done: ticked > 0,
      value: `${ticked} of ${COURSES.length}`,
      to: '/profile/courses',
    },
  ]
}

export type FeaturedCard = {
  /** `${universityId}::${slug}` — the program id the shortlist stores */
  id: string
  universityId: string
  slug: string
  name: string
  school: string
  median: number
  /** offers that came with a usable average, NOT the total report count */
  sampleSize: number
}

/**
 * The most-reported programs, as something a student can act on.
 *
 * `SUMMARY.featured` is already the right six — build-data.mjs filters out
 * `insufficientData`, sorts by report volume and keeps one program per school
 * — but it carries no program id, and the shortlist is keyed by id. Attaching
 * it here keeps the `::` join in one place rather than in the JSX.
 *
 * It is a static import, so this renders before programs.json has resolved.
 */
export function featuredCards(): FeaturedCard[] {
  return SUMMARY.featured.map((f) => ({ ...f, id: `${f.universityId}::${f.slug}` }))
}

export type CatalogueTotals = {
  programs: number
  universities: number
  reports: number
  programsWithCharts: number
}

/** The dataset-wide picture — the fallback when no field was chosen. */
export function catalogueTotals(): CatalogueTotals {
  return {
    programs: SUMMARY.programs,
    universities: SUMMARY.universities,
    reports: SUMMARY.reports,
    programsWithCharts: SUMMARY.programsWithCharts,
  }
}
