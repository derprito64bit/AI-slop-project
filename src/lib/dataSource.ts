// The single seam between the app and where its data lives.
//
// Today the dataset is static JSON generated from the moderated spreadsheets.
// If it ever moves behind an API, only this file changes — callers keep using
// loadPrograms()/loadUniversities() unchanged.
//
// Loading is dynamic and cached: the ~160kB (gzipped) of program data is a
// separate chunk, fetched the first time a data-driven page needs it, so it
// never weighs down the Home page.

import { fetchUniversityContent, type UniversityContent } from './api'
import type { CommunityStat, Program, University } from '../data/types'

let programsPromise: Promise<Program[]> | null = null
let universitiesPromise: Promise<University[]> | null = null
let statsPromise: Promise<CommunityStat[]> | null = null
let contentPromise: Promise<Record<string, UniversityContent>> | null = null

export function loadPrograms(): Promise<Program[]> {
  programsPromise ??= import('../data/generated/programs.json').then(
    (m) => m.default as Program[],
  )
  return programsPromise
}

export function loadUniversities(): Promise<University[]> {
  universitiesPromise ??= import('../data/generated/universities.json').then(
    (m) => m.default as University[],
  )
  return universitiesPromise
}

/** Individual anonymous reports — only needed by the community feed. */
export function loadStats(): Promise<CommunityStat[]> {
  statsPromise ??= import('../data/generated/stats.json').then(
    (m) => m.default as CommunityStat[],
  )
  return statsPromise
}

/**
 * Editable prose about each university, keyed by id.
 *
 * THE FIRST THING IN HERE THAT COMES OVER THE NETWORK, and the reason this file
 * was written as a seam in the first place — "if it ever moves behind an API,
 * only this file changes". Everything above is a static chunk; this is a request
 * to a free-tier service that spends most of its life asleep.
 *
 * SO IT CANNOT FAIL. A rejection resolves to `{}`, not an error: this content is
 * decoration on top of a dataset already sitting on the device, and a cold Render
 * instance has to cost a paragraph of prose rather than a page. Every caller can
 * therefore treat it as "extra, if it turns up" and needs no error branch.
 *
 * A FAILURE IS REMEMBERED FOR A MINUTE, and that number was chosen against a
 * real measurement rather than a feeling. Retrying immediately meant one failed
 * request per program page — the route is not deployed yet, so the sweep caught
 * a 404 on every navigation — while never retrying would mean a student who
 * opened the site before the server woke up saw no prose until they reloaded.
 * A minute is longer than a burst of browsing and shorter than a visit.
 */
const RETRY_AFTER_MS = 60_000
let contentFailedAt = 0

export function loadUniversityContent(): Promise<Record<string, UniversityContent>> {
  if (!contentPromise && contentFailedAt && Date.now() - contentFailedAt < RETRY_AFTER_MS) {
    return Promise.resolve({})
  }
  const mine = (contentPromise ??= fetchUniversityContent()
    .then((list) => {
      contentFailedAt = 0
      return Object.fromEntries(list.map((c) => [c.universityId, c]))
    })
    .catch(() => {
      // Only clear the slot if it is still OURS. An earlier fetch that fails
      // after `invalidateUniversityContent()` has already started a newer one
      // would otherwise throw the newer promise away and arm a 60-second
      // back-off against a server an admin has just proved is awake.
      if (contentPromise === mine) {
        contentPromise = null
        contentFailedAt = Date.now()
      }
      return {}
    }))
  return mine
}

/** Forget the cached copy, so an admin's save is visible without a reload. */
export function invalidateUniversityContent(): void {
  contentPromise = null
  // Clears the back-off too: an admin who has just saved has proved the server
  // is awake, so there is nothing to wait out.
  contentFailedAt = 0
}

/** Everything the Explore page needs, in one await. */
export function loadCatalogue(): Promise<{
  programs: Program[]
  universities: University[]
}> {
  return Promise.all([loadPrograms(), loadUniversities()]).then(
    ([programs, universities]) => ({ programs, universities }),
  )
}
