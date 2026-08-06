// Pure query functions over the program dataset.
//
// These take their data as arguments rather than importing it, so they stay
// trivially testable and don't care whether the records came from static JSON
// or (later) an API.

import type { Program, University } from '../data/types'

export type DifficultyBand = 'accessible' | 'competitive' | 'highly-competitive'

export type ProgramFilters = {
  universityId?: string
  province?: string
  field?: string
  difficulty?: DifficultyBand
  /** hide programs that don't have enough reports to say anything useful */
  withDataOnly?: boolean
  /** only programs whose median accepted average is at or below this */
  medianAtMost?: number
}

export type SortKey = 'relevance' | 'most-reported' | 'average-asc' | 'average-desc' | 'name'

/**
 * Bands are based on the median average of admitted students — not on any
 * probability of admission, which this dataset cannot support.
 */
export function difficultyBand(program: Program): DifficultyBand | null {
  const m = program.accepted?.median
  if (m === undefined || m === null || program.insufficientData) return null
  if (m >= 92) return 'highly-competitive'
  if (m >= 85) return 'competitive'
  return 'accessible'
}

export const DIFFICULTY_LABELS: Record<DifficultyBand, string> = {
  accessible: 'Accessible',
  competitive: 'Competitive',
  'highly-competitive': 'Highly competitive',
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Token-AND search across program name + university name, so "waterloo cs"
 * and "mac health" both work. Results are ordered by how early and how
 * completely the query matches.
 */
export function searchPrograms(
  programs: Program[],
  query: string,
  universities: University[] = [],
): Program[] {
  const q = normalize(query)
  if (!q) return programs

  const uniName = new Map(universities.map((u) => [u.id, normalize(u.name)]))
  const tokens = q.split(' ').filter(Boolean)

  const scored: { program: Program; score: number }[] = []
  for (const p of programs) {
    const name = normalize(p.name)
    const uni = uniName.get(p.universityId) ?? normalize(p.universityId)
    const haystack = `${name} ${uni}`

    if (!tokens.every((t) => haystack.includes(t))) continue

    let score = 0
    if (name === q) score += 100
    if (name.startsWith(q)) score += 50
    if (name.includes(q)) score += 25
    for (const t of tokens) {
      if (name.startsWith(t)) score += 8
      else if (name.includes(t)) score += 4
      if (uni.startsWith(t)) score += 3
    }
    // A program people actually reported on is a more useful hit.
    score += Math.min(p.totalReports, 50) / 10
    scored.push({ program: p, score })
  }

  return scored.sort((a, b) => b.score - a.score).map((s) => s.program)
}

export function filterPrograms(
  programs: Program[],
  filters: ProgramFilters,
  universities: University[] = [],
): Program[] {
  const provinceOf = new Map(universities.map((u) => [u.id, u.province]))

  return programs.filter((p) => {
    if (filters.universityId && p.universityId !== filters.universityId) return false
    if (filters.province && provinceOf.get(p.universityId) !== filters.province) return false
    if (filters.field && p.field !== filters.field) return false
    if (filters.withDataOnly && p.insufficientData) return false
    if (filters.difficulty && difficultyBand(p) !== filters.difficulty) return false
    if (filters.medianAtMost !== undefined) {
      const m = p.accepted?.median
      if (m === undefined || m === null || m > filters.medianAtMost) return false
    }
    return true
  })
}

export function sortPrograms(programs: Program[], sort: SortKey): Program[] {
  if (sort === 'relevance') return programs
  const out = [...programs]
  switch (sort) {
    case 'most-reported':
      return out.sort((a, b) => b.totalReports - a.totalReports)
    case 'name':
      return out.sort((a, b) => a.name.localeCompare(b.name))
    // Programs without a usable median always sort last, either direction.
    case 'average-asc':
      return out.sort(
        (a, b) => (a.accepted?.median ?? Infinity) - (b.accepted?.median ?? Infinity),
      )
    case 'average-desc':
      return out.sort((a, b) => (b.accepted?.median ?? -1) - (a.accepted?.median ?? -1))
    default:
      return out
  }
}

/** Search + filter + sort in one call — what the Explore page will use. */
export function queryPrograms(
  programs: Program[],
  opts: { query?: string; filters?: ProgramFilters; sort?: SortKey } = {},
  universities: University[] = [],
): Program[] {
  const { query = '', filters = {}, sort = query ? 'relevance' : 'most-reported' } = opts
  let out = searchPrograms(programs, query, universities)
  out = filterPrograms(out, filters, universities)
  return sortPrograms(out, sort)
}
