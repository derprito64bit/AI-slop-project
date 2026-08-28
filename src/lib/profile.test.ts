import { beforeEach, describe, expect, it } from 'vitest'
import {
  toFilters,
  matchPrograms,
  averageBand,
  loadProfile,
  saveProfile,
  clearProfile,
  toggleShortlist,
  toggleCourse,
  updateProfile,
  setNote,
  toggleTag,
  allTags,
  fitFor,
  balanceOf,
  EMPTY_PROFILE,
  type SurveyAnswers,
} from './profile'
import type { Program, University } from '../data/types'

const answers = (over: Partial<SurveyAnswers> = {}): SurveyAnswers => ({
  field: 'engineering',
  province: 'ON',
  average: 88,
  ambition: 'balanced',
  homeCity: 'Toronto',
  // No co-op preference by default, matching the survey's EMPTY. A fixture that
  // asked for co-op would silently filter out every program in these tests,
  // since co-op lives in the program NAME — which is exactly what happened the
  // first time this fixture was written.
  coop: '',
  gradYear: 2027,
  ...over,
})

const program = (over: Partial<Program> = {}): Program =>
  ({
    id: 'x::y',
    universityId: 'waterloo',
    name: 'Test',
    slug: 'test',
    field: 'engineering',
    totalReports: 50,
    counts: { offer: 50, rejected: 0, waitlisted: 0, deferred: 0 },
    sampleSize: 50,
    insufficientData: false,
    cycles: ['2025-2026'],
    accepted: { min: 80, p25: 85, median: 88, p75: 92, max: 99 },
    ...over,
  }) as Program

const unis: University[] = [
  { id: 'waterloo', name: 'Waterloo', city: 'Waterloo', province: 'ON' } as University,
  { id: 'ubc', name: 'UBC', city: 'Vancouver', province: 'BC' } as University,
]

describe('toFilters', () => {
  it('maps answers onto the existing filter shape', () => {
    const f = toFilters(answers())
    expect(f.field).toBe('engineering')
    expect(f.province).toBe('ON')
    // Matching compares to a median, so programs without one are excluded.
    expect(f.withDataOnly).toBe(true)
  })

  it('widens the median ceiling as ambition rises', () => {
    const safe = toFilters(answers({ ambition: 'safe' })).medianAtMost!
    const balanced = toFilters(answers({ ambition: 'balanced' })).medianAtMost!
    const reach = toFilters(answers({ ambition: 'reach' })).medianAtMost!
    expect(safe).toBeLessThan(balanced)
    expect(balanced).toBeLessThan(reach)
  })

  it('never lets the ceiling exceed 100', () => {
    expect(toFilters(answers({ average: 99, ambition: 'reach' })).medianAtMost).toBe(100)
  })

  it('treats an empty province as no preference rather than a filter', () => {
    expect(toFilters(answers({ province: '' })).province).toBeUndefined()
  })
})

describe('matchPrograms', () => {
  const programs = [
    program({ id: 'a', name: 'Low', accepted: { min: 70, p25: 74, median: 78, p75: 82, max: 90 } }),
    program({ id: 'b', name: 'Mid', accepted: { min: 80, p25: 85, median: 88, p75: 92, max: 99 } }),
    // 95 is inside the ambitious ceiling for an 88 average (88 + 8) but outside
    // the balanced one (88 + 3), which is exactly the line being tested.
    program({ id: 'c', name: 'High', accepted: { min: 90, p25: 93, median: 95, p75: 98, max: 100 } }),
    // Far enough above that no ambition setting should reach it.
    program({ id: 'g', name: 'Very high', accepted: { min: 95, p25: 97, median: 99, p75: 100, max: 100 } }),
    program({ id: 'd', name: 'Other field', field: 'business' }),
    program({ id: 'e', name: 'Out of province', universityId: 'ubc' }),
    program({ id: 'f', name: 'No data', insufficientData: true, accepted: undefined }),
  ]

  it('keeps only programs at or below the ceiling', () => {
    const ids = matchPrograms(answers(), programs, unis).map((p) => p.id)
    // balanced on 88 -> ceiling 91, so the 97-median program is out.
    expect(ids).toContain('b')
    expect(ids).not.toContain('c')
  })

  it('respects field and province', () => {
    const ids = matchPrograms(answers(), programs, unis).map((p) => p.id)
    expect(ids).not.toContain('d')
    expect(ids).not.toContain('e')
  })

  it('excludes programs with no reported median', () => {
    expect(matchPrograms(answers(), programs, unis).map((p) => p.id)).not.toContain('f')
  })

  it('surfaces ambitious programs that the comfortable setting hides', () => {
    const safe = matchPrograms(answers({ ambition: 'safe' }), programs, unis).map((p) => p.id)
    const reach = matchPrograms(answers({ ambition: 'reach' }), programs, unis).map((p) => p.id)
    expect(safe).not.toContain('c')
    expect(reach).toContain('c')
    // Widening the net is not the same as removing it — a 99 median stays out
    // for an 88 average no matter how ambitious the setting.
    expect(reach).not.toContain('g')
  })
})

describe('averageBand', () => {
  it('buckets averages coarsely so telemetry cannot identify anyone', () => {
    expect(averageBand(97)).toBe('95+')
    expect(averageBand(90)).toBe('90-94')
    expect(averageBand(88)).toBe('85-89')
    expect(averageBand(60)).toBe('below-75')
  })
})

describe('storage', () => {
  // The suite runs in node, not jsdom, so there is no real localStorage. A
  // ten-line in-memory stand-in keeps the tests dependency-free and fast —
  // adding jsdom for one API would slow the whole suite down.
  beforeEach(() => {
    let store: Record<string, string> = {}
    globalThis.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v)
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        store = {}
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      get length() {
        return Object.keys(store).length
      },
    } as Storage
    clearProfile()
  })

  it('round-trips a profile', () => {
    saveProfile({ ...EMPTY_PROFILE, answers: answers(), shortlist: ['a'] })
    const loaded = loadProfile()
    expect(loaded?.answers?.average).toBe(88)
    expect(loaded?.shortlist).toEqual(['a'])
  })

  it('returns null when nothing is stored', () => {
    expect(loadProfile()).toBeNull()
  })

  it('ignores a corrupted value instead of throwing', () => {
    localStorage.setItem('acceptiversity.profile.v2', '{ not json')
    expect(loadProfile()).toBeNull()
  })

  it('toggles a program on and off the shortlist', () => {
    saveProfile({ ...EMPTY_PROFILE, answers: answers() })
    expect(toggleShortlist('a')?.shortlist).toEqual(['a'])
    expect(toggleShortlist('a')?.shortlist).toEqual([])
  })

  it('creates a profile on demand, so the survey can be skipped', () => {
    expect(loadProfile()).toBeNull()
    const created = toggleShortlist('a')
    expect(created.shortlist).toEqual(['a'])
    // No survey answers yet — that is a valid state, not an error.
    expect(created.answers).toBeNull()
  })

  it('fills in fields a hand-edited record is missing', () => {
    localStorage.setItem('acceptiversity.profile.v2', JSON.stringify({ shortlist: ['a'] }))
    const loaded = loadProfile()!
    expect(loaded.courses).toEqual([])
    expect(loaded.notes).toEqual({})
    expect(loaded.tags).toEqual({})
    expect(loaded.answers).toBeNull()
  })

  it('migrates a v1 record forward and retires the old key', () => {
    localStorage.setItem(
      'acceptiversity.profile.v1',
      JSON.stringify({ answers: answers(), shortlist: ['a', 'b'] }),
    )
    const loaded = loadProfile()!
    expect(loaded.answers?.average).toBe(88)
    expect(loaded.shortlist).toEqual(['a', 'b'])
    expect(loaded.courses).toEqual([])
    expect(localStorage.getItem('acceptiversity.profile.v1')).toBeNull()
  })

  it('keeps notes and drops them when blanked', () => {
    expect(setNote('a', 'ask Mr Patel').notes.a).toBe('ask Mr Patel')
    expect(setNote('a', '   ').notes.a).toBeUndefined()
  })

  it('toggles tags and lists them for filter chips', () => {
    toggleTag('a', 'dream')
    toggleTag('b', 'backup')
    toggleTag('a', 'visited')
    expect(allTags(loadProfile())).toEqual(['backup', 'dream', 'visited'])
    toggleTag('a', 'dream')
    expect(loadProfile()?.tags.a).toEqual(['visited'])
  })

  // Regression: the course toggle used to take the list from React state, so
  // four quick clicks all computed from the same stale array and only the last
  // survived. Reading from storage makes rapid toggling safe.
  it('accumulates rapid course toggles instead of losing all but the last', () => {
    toggleCourse('ENG4U')
    toggleCourse('MHF4U')
    toggleCourse('SCH4U')
    toggleCourse('SPH4U')
    expect(loadProfile()?.courses.sort()).toEqual(['ENG4U', 'MHF4U', 'SCH4U', 'SPH4U'])
    toggleCourse('SCH4U')
    expect(loadProfile()?.courses.sort()).toEqual(['ENG4U', 'MHF4U', 'SPH4U'])
  })

  it('merges a partial update without clobbering the rest', () => {
    saveProfile({ ...EMPTY_PROFILE, answers: answers(), shortlist: ['a'] })
    const next = updateProfile({ courses: ['ENG4U'] })
    expect(next.courses).toEqual(['ENG4U'])
    expect(next.shortlist).toEqual(['a'])
    expect(next.answers?.average).toBe(88)
  })
})

describe('fitFor', () => {
  it('buckets a program against the student, not in the abstract', () => {
    // An 88 average: a 95 median is ambitious, 88 is in range, 80 comfortable.
    expect(fitFor(88, 95)).toBe('ambitious')
    expect(fitFor(88, 88)).toBe('in-range')
    expect(fitFor(88, 80)).toBe('comfortable')
  })

  it('treats a few points either way as in range', () => {
    expect(fitFor(88, 91)).toBe('in-range')
    expect(fitFor(88, 85)).toBe('in-range')
    expect(fitFor(88, 92)).toBe('ambitious')
  })

  it('returns null rather than guessing when there is no median', () => {
    expect(fitFor(88, null)).toBeNull()
    expect(fitFor(88, undefined)).toBeNull()
  })

  it('flips with the student, so the same program reads differently', () => {
    expect(fitFor(75, 90)).toBe('ambitious')
    expect(fitFor(97, 90)).toBe('comfortable')
  })
})

describe('balanceOf', () => {
  it('counts the shape of a list so an all-reach list is visible', () => {
    const list = [
      { accepted: { median: 97 } },
      { accepted: { median: 96 } },
      { accepted: { median: 88 } },
      { accepted: { median: 80 } },
      { accepted: null },
    ]
    expect(balanceOf(88, list)).toEqual({ ambitious: 2, 'in-range': 1, comfortable: 1 })
  })
})
