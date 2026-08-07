// The single seam between the app and where its data lives.
//
// Today the dataset is static JSON generated from the moderated spreadsheets.
// If it ever moves behind an API, only this file changes — callers keep using
// loadPrograms()/loadUniversities() unchanged.
//
// Loading is dynamic and cached: the ~160kB (gzipped) of program data is a
// separate chunk, fetched the first time a data-driven page needs it, so it
// never weighs down the Home page.

import type { CommunityStat, Program, University } from '../data/types'

let programsPromise: Promise<Program[]> | null = null
let universitiesPromise: Promise<University[]> | null = null
let statsPromise: Promise<CommunityStat[]> | null = null

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

/** Everything the Explore page needs, in one await. */
export function loadCatalogue(): Promise<{
  programs: Program[]
  universities: University[]
}> {
  return Promise.all([loadPrograms(), loadUniversities()]).then(
    ([programs, universities]) => ({ programs, universities }),
  )
}
