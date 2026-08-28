import { describe, it, expect } from 'vitest'
import { fieldSummaryFor, summarise } from './fields'
import { FIELD_LABELS } from './profile'
import type { Program } from '../data/types'

const uniName = new Map([
  ['waterloo', 'University of Waterloo'],
  ['mcmaster', 'McMaster University'],
])

const mk = (over: Partial<Program> & Pick<Program, 'id' | 'universityId' | 'name'>): Program => ({
  slug: over.name.toLowerCase().replace(/\s+/g, '-'),
  field: 'engineering',
  totalReports: 10,
  counts: { offer: 10, rejected: 0, waitlisted: 0, deferred: 0 },
  sampleSize: 10,
  insufficientData: false,
  cycles: ['2025-2026'],
  accepted: { min: 80, p25: 85, median: 90, p75: 94, max: 99 },
  ...over,
})

const median = (n: number) => ({ min: n - 5, p25: n - 2, median: n, p75: n + 2, max: n + 5 })

describe('summarise', () => {
  it('orders fields by reports, not by program count', () => {
    // Two small-but-heavily-reported programs must outrank three quiet ones.
    // Ranking by program count once put a field the site knows least about at
    // the top of the page.
    const out = summarise(
      [
        mk({ id: 'a', universityId: 'waterloo', name: 'Eng A', field: 'engineering', totalReports: 200 }),
        mk({ id: 'b', universityId: 'waterloo', name: 'Eng B', field: 'engineering', totalReports: 150 }),
        mk({ id: 'c', universityId: 'mcmaster', name: 'Bus A', field: 'business', totalReports: 10 }),
        mk({ id: 'd', universityId: 'mcmaster', name: 'Bus B', field: 'business', totalReports: 10 }),
        mk({ id: 'e', universityId: 'mcmaster', name: 'Bus C', field: 'business', totalReports: 10 }),
      ],
      uniName,
    )
    expect(out.map((f) => f.key)).toEqual(['engineering', 'business'])
    expect(out[0].programs).toBe(2)
    expect(out[1].programs).toBe(3)
  })

  it('counts insufficient-data programs but never charts them', () => {
    // The invariant the whole "110 of 422 programs" sentence rests on: a
    // program below the reporting threshold is part of the field's size and
    // its report count, and no part of its median, range or school marks.
    const [eng] = summarise(
      [
        mk({ id: 'a', universityId: 'waterloo', name: 'Solid', totalReports: 40, accepted: median(92) }),
        mk({
          id: 'b',
          universityId: 'mcmaster',
          name: 'Thin',
          totalReports: 2,
          sampleSize: 1,
          insufficientData: true,
          accepted: median(70),
        }),
      ],
      uniName,
    )

    expect(eng.programs).toBe(2)
    expect(eng.reports).toBe(42)
    expect(eng.withData).toBe(1)
    expect(eng.midMedian).toBe(92)
    expect(eng.lowMedian).toBe(92)
    expect(eng.highMedian).toBe(92)
    expect(eng.schools.map((s) => s.id)).toEqual(['waterloo'])
  })

  it('takes the upper median of the per-program medians', () => {
    // Pinned because FieldsView and the Overview both print this number and
    // a nearest-rank change would make the same field read differently on the
    // two pages.
    const [eng] = summarise(
      [80, 85, 90, 95].map((m, i) =>
        mk({ id: `p${i}`, universityId: 'waterloo', name: `P${i}`, accepted: median(m) }),
      ),
      uniName,
    )
    expect(eng.midMedian).toBe(90)
    expect(eng.lowMedian).toBe(80)
    expect(eng.highMedian).toBe(95)
  })

  it('drops empty fields and any field key the labels do not know', () => {
    const out = summarise(
      [mk({ id: 'a', universityId: 'waterloo', name: 'Ghost', field: 'underwater-basket-weaving' })],
      uniName,
    )
    expect(out).toEqual([])
  })

  it('names schools through uniName, most-reported first, falling back to the id', () => {
    const [eng] = summarise(
      [
        mk({ id: 'a', universityId: 'mcmaster', name: 'A', totalReports: 30 }),
        mk({ id: 'b', universityId: 'waterloo', name: 'B', totalReports: 50 }),
        mk({ id: 'c', universityId: 'queens', name: 'C', totalReports: 40 }),
      ],
      uniName,
    )
    expect(eng.schools).toEqual([
      { id: 'waterloo', name: 'University of Waterloo', reports: 50 },
      { id: 'queens', name: 'queens', reports: 40 },
      { id: 'mcmaster', name: 'McMaster University', reports: 30 },
    ])
  })

  it('never emits a label that reads as a probability', () => {
    // Rule 1, made permanent. The data supports distributions of reported
    // averages and nothing that sounds like a chance of getting in.
    const out = summarise(
      Object.keys(FIELD_LABELS).map((field, i) =>
        mk({ id: `p${i}`, universityId: 'waterloo', name: `P${i}`, field }),
      ),
      uniName,
    )
    expect(out).not.toHaveLength(0)
    for (const f of out) expect(f.label).not.toMatch(/\bodds\b|\bchance\b|\blikely\b|probab/i)
  })
})

describe('fieldSummaryFor', () => {
  const fields = summarise(
    [
      mk({ id: 'a', universityId: 'waterloo', name: 'Eng', field: 'engineering' }),
      mk({ id: 'b', universityId: 'mcmaster', name: 'Bus', field: 'business' }),
    ],
    uniName,
  )

  it('finds the field the student named', () => {
    expect(fieldSummaryFor(fields, 'business')?.key).toBe('business')
  })

  it('misses on the empty string rather than matching the first field', () => {
    // '' is what a skipped subject question stores, and it is a real answer.
    // Matching it to whatever sorted first would tell a student the site knew
    // something about them that it does not.
    expect(fieldSummaryFor(fields, '')).toBeNull()
  })

  it('misses on a field key that is not in the results', () => {
    expect(fieldSummaryFor(fields, 'health')).toBeNull()
    expect(fieldSummaryFor(fields, 'not-a-field')).toBeNull()
  })
})
