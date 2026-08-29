import { CITY_POINTS, distanceKm, mapCity } from '../data/campus-locations'
import type { Program, University } from '../data/types'

// The student's kept list, seen from where they live.
//
// `homeCity` is asked in the survey and, until now, read by exactly one place:
// the map, where it sets the "measure distances from" dropdown. So a student
// answered a question and the answer did nothing unless they went looking for
// the map. This is the other half of it — the same fact, on the page where
// their list already is.
//
// TWO HONESTY CONSTRAINTS, both inherited from the map and both load-bearing.
//
// 1. The distance is STRAIGHT-LINE BETWEEN CITY CENTRES. Not a campus address,
//    not a drive. `campus-locations.ts` says so at the top and MapView repeats
//    it on screen; `nearHomeNote` carries the same qualifier, and a test
//    asserts it cannot be dropped.
//
// 2. SOME SCHOOLS CANNOT BE PLACED, and the copy says how many rather than
//    quietly shrinking the denominator. CITY_POINTS covers the sixteen Ontario
//    cities in the dataset and nothing else, so a kept program at McGill or UBC
//    has no point to measure from. The tempting phrasing — "of your Ontario
//    schools" — is a different claim: the real test is "has a CITY_POINTS
//    entry", and an Ontario city that is missing one would be silently
//    relabelled out of province by it. Naming the remainder is also what the
//    rest of the site does (ListSpread's "N left off", FieldSummary's "N of M").

/** Inside this, a school is somewhere you could plausibly go home from. */
export const NEAR_KM = 100

export type PlacedProgram = {
  programId: string
  program: string
  school: string
  city: string
  km: number
}

export type NearHome = {
  home: string
  /** kept programs at a school we hold a point for, nearest first */
  placed: PlacedProgram[]
  /** kept programs whose school city has no CITY_POINTS entry */
  unplaced: number
  /** how many of `placed` are within `nearKm` */
  near: number
  nearKm: number
}

/**
 * Roll the kept list up against home.
 *
 * Returns null when there is nothing to say: no usable home city, or an empty
 * list. `home` is validated against CITY_POINTS rather than trusted, because
 * `applyRemoteProfile` copies `homeCity` across with `?? ''` and no whitelist —
 * a value from another client can be any string at all, and both existing
 * readers already guard the same way.
 *
 * `universities` rather than a map on the dashboard context: `uniName` carries
 * names only, and adding a city map to a context eleven views import, for one
 * caller, is the wrong trade.
 */
export function nearHome(
  home: string,
  kept: Program[],
  universities: University[],
  nearKm: number = NEAR_KM,
): NearHome | null {
  const from = CITY_POINTS[home]
  if (!from || !kept.length) return null

  const byId = new Map(universities.map((u) => [u.id, u]))
  const placed: PlacedProgram[] = []
  let unplaced = 0

  for (const p of kept) {
    const uni = byId.get(p.universityId)
    // Scarborough folds into Toronto, exactly as the map does — otherwise UTSC
    // would count as unplaceable while UTSG did not.
    const city = uni ? mapCity(uni.city) : ''
    const point = city ? CITY_POINTS[city] : undefined
    if (!uni || !point) {
      unplaced += 1
      continue
    }
    placed.push({
      programId: p.id,
      program: p.name,
      school: uni.name,
      city,
      km: distanceKm(from, point),
    })
  }

  placed.sort((a, b) => a.km - b.km || a.school.localeCompare(b.school))
  return { home, placed, unplaced, near: placed.filter((p) => p.km <= nearKm).length, nearKm }
}

/**
 * The sentences, as strings.
 *
 * Same reason as `reportDepth` and `cycleNote`: copy assembled inside a
 * component is copy no test can read, and every line here is a claim about the
 * student's own list.
 *
 * Returns null when nothing can be placed. "We cannot measure any of these" is
 * not information — it is an apology for a gap the student did not ask about.
 */
export function nearHomeNote(
  r: NearHome,
): { headline: string; extremes: string; qualifier: string } | null {
  if (!r.placed.length) return null

  const qualifier =
    'Straight-line from approximate city centres, not campus addresses — a sense of scale, ' +
    'not a journey time.'

  const total = r.placed.length + r.unplaced
  const leftOut =
    r.unplaced === 0
      ? ''
      : ` ${r.unplaced} more ${r.unplaced === 1 ? 'is' : 'are'} outside Ontario, where we hold no coordinates.`

  // At one placeable program the threshold sentence is silly — "1 of 1 is
  // within 100km" — so it just says the distance.
  if (r.placed.length === 1) {
    const only = r.placed[0]
    return {
      headline: `Your one kept program we can place is ${only.km}km from ${r.home}.${leftOut}`,
      extremes: '',
      qualifier,
    }
  }

  // "of the N we can place" rather than "of your N" whenever some were left
  // out, so the denominator in the sentence is the one being counted.
  const base =
    r.unplaced === 0
      ? `${r.near} of your ${total} kept programs`
      : `${r.near} of the ${r.placed.length} kept programs we can place`

  const headline =
    r.near === 0
      ? `None of the ${r.placed.length} kept programs we can place are within ${r.nearKm}km of ${r.home}.${leftOut}`
      : `${base} are within ${r.nearKm}km of ${r.home}.${leftOut}`

  const nearest = r.placed[0]
  const farthest = r.placed[r.placed.length - 1]
  return {
    headline,
    extremes: `Nearest: ${nearest.school}, ${nearest.km}km. Farthest: ${farthest.school}, ${farthest.km}km.`,
    qualifier,
  }
}
