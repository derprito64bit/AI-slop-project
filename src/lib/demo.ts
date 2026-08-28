// A believable profile, for showing the site to a room.
//
// Every view here is built out of a student's own work, which means an
// unseeded dashboard is a set of empty states — honest, and useless to
// demonstrate. This fills it with one plausible student so the tools can be
// shown doing their job.
//
// THREE RULES, because a demo switch that leaks into the real site would be
// worse than no demo switch:
//
//  1. It runs only on an explicit `?demo=1`. Nothing infers it, nothing
//     remembers it across a fresh visit without the parameter.
//  2. It never overwrites real work. A visitor who already has a profile keeps
//     it, and is told the demo did not load rather than silently losing a list.
//  3. It is reversible from the UI, and says on screen that it is fake.
//
// The programs are real ids from the dataset, chosen so every tool has
// something to show: a spread across five fields, a spread of medians against
// an 88 average so Balance is not one flat bar, and two courses ticked that
// leave a genuine unmet prerequisite so the Courses gap finder is not empty.

import { EMPTY_PROFILE, loadProfile, saveProfile, type SavedProfile } from './profile'

export const DEMO_FLAG = 'acceptiversity.demo.v1'

/**
 * Real programs, deliberately mixed.
 *
 * Against an average of 88: Toronto Engineering Science (97.3) and Waterloo CS
 * (97.8) are ambitious, McMaster Eng I (95.9) and Queen's Commerce (95.8) sit
 * above, and TMU Business Management (89) and York Biomedical Science (88.3)
 * are in range — so the balance view shows an actual shape rather than a single
 * bucket, which is the point it exists to make.
 */
const DEMO_SHORTLIST = [
  'toronto::engineering-science',
  'waterloo::computer-science',
  'mcmaster::engineering-i-co-op',
  'queens::smith-commerce',
  'tmu::business-management',
  'york::biomedical-science',
]

/**
 * ENG4U and MHF4U only. McMaster Engineering I also wants Calculus & Vectors,
 * Chemistry and Physics, so the Courses view opens on a real gap rather than a
 * row of ticks — the state a student in October is actually in.
 */
const DEMO_COURSES = ['ENG4U', 'MHF4U']

export const DEMO_PROFILE: Omit<SavedProfile, 'savedAt'> = {
  ...EMPTY_PROFILE,
  answers: {
    field: 'engineering',
    province: 'ON',
    average: 88,
    ambition: 'balanced',
    // A demo student who lives near Toronto and finishes next year: the map
    // opens on real distances rather than a prompt, and the course gap below
    // is the one an Ontario applicant actually has in October.
    homeCity: 'Mississauga',
    coop: 'yes',
    gradYear: 2027,
  },
  shortlist: DEMO_SHORTLIST,
  courses: DEMO_COURSES,
  notes: {
    'toronto::engineering-science': 'Reach. Ask at the open house how many switch out after first year.',
    'tmu::business-management': 'Closest to home — could live at home for first year.',
  },
  tags: {
    'toronto::engineering-science': ['reach'],
    'waterloo::computer-science': ['reach', 'co-op'],
    'tmu::business-management': ['safe'],
  },
}

export type DemoResult = 'seeded' | 'already-demo' | 'refused-real-profile' | 'not-requested'

/**
 * Seed the demo profile if `?demo=1` is present and it is safe to do so.
 *
 * Returns what happened rather than a boolean, because "I did nothing because
 * you already have a real profile" is a different thing to say to the presenter
 * than "already loaded", and the banner says it.
 */
export function maybeSeedDemo(search: string): DemoResult {
  const wanted = new URLSearchParams(search).get('demo') === '1'
  if (!wanted) return 'not-requested'

  const existing = loadProfile()
  if (existing) {
    // A profile made BY the demo can be reseeded freely; one made by a person
    // is theirs.
    if (!isDemoActive()) return 'refused-real-profile'
    return 'already-demo'
  }

  saveProfile(DEMO_PROFILE)
  try {
    localStorage.setItem(DEMO_FLAG, '1')
  } catch {
    /* storage unavailable — the profile is in memory for this page either way */
  }
  return 'seeded'
}

export function isDemoActive(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG) === '1'
  } catch {
    return false
  }
}

/** Remove the demo profile and the flag. Only ever touches demo data. */
export function clearDemo(): void {
  if (!isDemoActive()) return
  try {
    localStorage.removeItem('acceptiversity.profile.v2')
    localStorage.removeItem(DEMO_FLAG)
  } catch {
    /* nothing to do */
  }
}
