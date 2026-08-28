import { describe, it, expect } from 'vitest'
import {
  searchPrograms,
  filterPrograms,
  sortPrograms,
  queryPrograms,
  difficultyBand,
  findProgram,
  similarPrograms,
  isCoop,
} from './search'
import type { Program, University } from '../data/types'

const universities: University[] = [
  { id: 'waterloo', name: 'University of Waterloo', city: 'Waterloo', province: 'ON', programCount: 2, reportCount: 30 },
  { id: 'mcmaster', name: 'McMaster University', city: 'Hamilton', province: 'ON', programCount: 1, reportCount: 20 },
  { id: 'ubc', name: 'University of British Columbia', city: 'Vancouver', province: 'BC', programCount: 1, reportCount: 5 },
]

const mk = (over: Partial<Program> & Pick<Program, 'id' | 'universityId' | 'name'>): Program => ({
  slug: over.name.toLowerCase().replace(/\s+/g, '-'),
  field: 'other',
  totalReports: 10,
  counts: { offer: 10, rejected: 0, waitlisted: 0, deferred: 0 },
  sampleSize: 10,
  insufficientData: false,
  cycles: ['2025-2026'],
  accepted: { min: 80, p25: 85, median: 90, p75: 94, max: 99 },
  ...over,
})

const programs: Program[] = [
  mk({ id: 'waterloo::computer-science', universityId: 'waterloo', name: 'Computer Science', field: 'computer-science', totalReports: 40,
       accepted: { min: 90, p25: 93, median: 96, p75: 98, max: 100 } }),
  mk({ id: 'waterloo::engineering', universityId: 'waterloo', name: 'Engineering', field: 'engineering', totalReports: 25,
       accepted: { min: 85, p25: 89, median: 93, p75: 96, max: 99 } }),
  mk({ id: 'mcmaster::health-science', universityId: 'mcmaster', name: 'Health Sciences', field: 'health', totalReports: 20,
       accepted: { min: 80, p25: 84, median: 88, p75: 92, max: 97 } }),
  mk({ id: 'ubc::sociology', universityId: 'ubc', name: 'Sociology', field: 'social-sciences', totalReports: 3,
       sampleSize: 2, insufficientData: true, accepted: { min: 78, p25: 79, median: 80, p75: 81, max: 82 } }),
]

describe('searchPrograms', () => {
  it('returns everything for an empty query', () => {
    expect(searchPrograms(programs, '', universities)).toHaveLength(4)
  })

  it('finds a program by name', () => {
    const r = searchPrograms(programs, 'computer', universities)
    expect(r[0].name).toBe('Computer Science')
  })

  it('matches across program and university, in any order', () => {
    const r = searchPrograms(programs, 'waterloo engineering', universities)
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('waterloo::engineering')
  })

  it('requires every token to match', () => {
    expect(searchPrograms(programs, 'waterloo sociology', universities)).toHaveLength(0)
  })

  it('ignores case and punctuation', () => {
    expect(searchPrograms(programs, 'HEALTH   sciences!', universities)).toHaveLength(1)
  })

  it('ranks exact name matches above partial ones', () => {
    const r = searchPrograms(programs, 'engineering', universities)
    expect(r[0].name).toBe('Engineering')
  })
})

describe('filterPrograms', () => {
  it('filters by university and field', () => {
    expect(filterPrograms(programs, { universityId: 'waterloo' }, universities)).toHaveLength(2)
    expect(filterPrograms(programs, { field: 'health' }, universities)).toHaveLength(1)
  })

  it('filters by province via the university record', () => {
    expect(filterPrograms(programs, { province: 'BC' }, universities)).toHaveLength(1)
    expect(filterPrograms(programs, { province: 'ON' }, universities)).toHaveLength(3)
  })

  it('can hide programs without enough reports', () => {
    const r = filterPrograms(programs, { withDataOnly: true }, universities)
    expect(r).toHaveLength(3)
    expect(r.every((p) => !p.insufficientData)).toBe(true)
  })

  it('filters by difficulty band', () => {
    const hard = filterPrograms(programs, { difficulty: 'highly-competitive' }, universities)
    expect(hard.map((p) => p.name).sort()).toEqual(['Computer Science', 'Engineering'])
  })

  it('filters by median ceiling', () => {
    const r = filterPrograms(programs, { medianAtMost: 90 }, universities)
    expect(r.map((p) => p.name).sort()).toEqual(['Health Sciences', 'Sociology'])
  })

  it('combines filters', () => {
    expect(
      filterPrograms(programs, { universityId: 'waterloo', field: 'engineering' }, universities),
    ).toHaveLength(1)
  })
})

describe('difficultyBand', () => {
  it('bands by median accepted average', () => {
    expect(difficultyBand(programs[0])).toBe('highly-competitive') // 96
    expect(difficultyBand(programs[2])).toBe('competitive') // 88
  })

  it('refuses to band a program with too little data', () => {
    expect(difficultyBand(programs[3])).toBeNull()
  })
})

describe('sortPrograms', () => {
  it('sorts by report count and by name', () => {
    expect(sortPrograms(programs, 'most-reported')[0].name).toBe('Computer Science')
    expect(sortPrograms(programs, 'name')[0].name).toBe('Computer Science')
  })

  it('sorts by average in both directions', () => {
    expect(sortPrograms(programs, 'average-desc')[0].accepted?.median).toBe(96)
    expect(sortPrograms(programs, 'average-asc')[0].accepted?.median).toBe(80)
  })

  it('does not mutate the input', () => {
    const before = programs.map((p) => p.id)
    sortPrograms(programs, 'average-desc')
    expect(programs.map((p) => p.id)).toEqual(before)
  })
})

describe('findProgram', () => {
  it('finds a program from its URL parts', () => {
    expect(findProgram(programs, 'waterloo', 'computer-science')?.name).toBe('Computer Science')
  })

  it('requires both parts to match, so slugs are not shared across schools', () => {
    expect(findProgram(programs, 'mcmaster', 'computer-science')).toBeNull()
  })

  it('returns null for unknown ids instead of throwing', () => {
    expect(findProgram(programs, 'nowhere', 'nothing')).toBeNull()
  })
})

describe('similarPrograms', () => {
  it('returns other programs in the same field', () => {
    const cs = programs[0]
    const alsoCs = mk({ id: 'mcmaster::cs', universityId: 'mcmaster', name: 'Computing', field: 'computer-science', totalReports: 8 })
    const out = similarPrograms([...programs, alsoCs], cs)
    expect(out.map((p) => p.id)).toEqual(['mcmaster::cs'])
  })

  it('never includes the program itself', () => {
    expect(similarPrograms(programs, programs[0]).some((p) => p.id === programs[0].id)).toBe(false)
  })

  it('excludes programs without enough data to show a median', () => {
    const thin = mk({ id: 'x::y', universityId: 'ubc', name: 'Thin CS', field: 'computer-science', insufficientData: true })
    expect(similarPrograms([...programs, thin], programs[0]).some((p) => p.id === 'x::y')).toBe(false)
  })
})

describe('queryPrograms', () => {
  it('applies search, filter and sort together', () => {
    const r = queryPrograms(
      programs,
      { query: 'science', filters: { province: 'ON' }, sort: 'average-desc' },
      universities,
    )
    expect(r.map((p) => p.name)).toEqual(['Computer Science', 'Health Sciences'])
  })

  it('defaults to most-reported when there is no query', () => {
    expect(queryPrograms(programs, {}, universities)[0].name).toBe('Computer Science')
  })
})

describe('isCoop', () => {
  // The dataset has no co-op field: co-op is baked into the program name,
  // because build-data.mjs deliberately never merges "X" with "X (Co-op)".
  it('recognises the ways the source spreadsheets word it', () => {
    for (const name of [
      'Engineering I (Co-op)',
      'Health Sciences, Co-op',
      'Computer Engineering (Co-op only)',
      'Mathematics (Coop)',
      'Computer Science (Co-op and Regular)',
    ]) {
      expect(isCoop(mk({ id: 'x', universityId: 'waterloo', name }))).toBe(true)
    }
  })

  it('does not claim co-op from a name that never says so', () => {
    for (const name of ['Computer Science', 'Cooperative Education Studies', 'Nursing']) {
      expect(isCoop(mk({ id: 'x', universityId: 'waterloo', name }))).toBe(false)
    }
  })
})

describe('the co-op filter', () => {
  const programs = [
    mk({ id: 'a', universityId: 'waterloo', name: 'Computer Science (Co-op)' }),
    mk({ id: 'b', universityId: 'waterloo', name: 'Computer Science' }),
    mk({ id: 'c', universityId: 'mcmaster', name: 'Engineering I (Co-op)' }),
  ]

  it('keeps only co-op programs', () => {
    expect(filterPrograms(programs, { coop: 'yes' }, universities).map((p) => p.id)).toEqual([
      'a',
      'c',
    ])
  })

  it('keeps only the ones without it', () => {
    expect(filterPrograms(programs, { coop: 'no' }, universities).map((p) => p.id)).toEqual(['b'])
  })

  // The failure this guards against: a "no preference" answer arriving as
  // something truthy and quietly halving the shortlist.
  it('leaves everything alone when no preference was expressed', () => {
    expect(filterPrograms(programs, {}, universities)).toHaveLength(3)
  })
})
