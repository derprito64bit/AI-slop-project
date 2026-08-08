import { describe, expect, it } from 'vitest'
import { summarise, averagesFor, medianByCycle, decisionMix, MIN_GROUP } from './analytics'
import type { CommunityStat } from '../data/types'

const stat = (p: string, d: string, a: number | null, c = '2025-2026'): CommunityStat =>
  ({ p, u: 'x', d, a, c }) as CommunityStat

describe('summarise', () => {
  it('returns null below the minimum group size', () => {
    expect(summarise([90, 91, 92, 93])).toBeNull()
    expect(summarise([90, 91, 92, 93, 94])).not.toBeNull()
  })

  it('reports a five-number summary', () => {
    const s = summarise([80, 85, 90, 95, 100])!
    expect(s.n).toBe(5)
    expect(s.min).toBe(80)
    expect(s.max).toBe(100)
    expect(s.median).toBe(90)
    expect(s.p25).toBeLessThanOrEqual(s.median)
    expect(s.p75).toBeGreaterThanOrEqual(s.median)
  })

  it('does not care about input order', () => {
    expect(summarise([100, 80, 95, 85, 90])).toEqual(summarise([80, 85, 90, 95, 100]))
  })

  it('handles every value being identical', () => {
    const s = summarise([92, 92, 92, 92, 92])!
    expect([s.min, s.p25, s.median, s.p75, s.max]).toEqual([92, 92, 92, 92, 92])
  })

  // Regression: this interpolates like percentile() in scripts/normalize.mjs.
  // A nearest-rank version made McMaster Engineering read 95.9% in the page
  // header (from the ETL) and 95.8% in the offers-vs-rejections strip.
  it('interpolates between neighbours, matching the ETL', () => {
    // (n-1)*0.5 = 2.5 -> halfway between the 3rd and 4th values.
    const s = summarise([90, 92, 94, 96, 98, 100])!
    expect(s.median).toBe(95)
    // (n-1)*0.25 = 1.25 -> a quarter of the way from 92 to 94.
    expect(s.p25).toBe(92.5)
  })
})

describe('averagesFor', () => {
  const stats = [
    stat('a', 'offer', 95),
    stat('a', 'offer', null), // no average reported
    stat('a', 'rejected', 88),
    stat('b', 'offer', 70),
  ]

  it('filters by program and decision, dropping nulls', () => {
    expect(averagesFor(stats, 'a', 'offer')).toEqual([95])
    expect(averagesFor(stats, 'a', 'rejected')).toEqual([88])
    expect(averagesFor(stats, 'zzz', 'offer')).toEqual([])
  })
})

describe('medianByCycle', () => {
  it('drops cycles below the minimum so thin years cannot imply a trend', () => {
    const stats = [
      ...Array.from({ length: 6 }, () => stat('a', 'offer', 90, '2024-2025')),
      ...Array.from({ length: 2 }, () => stat('a', 'offer', 99, '2022-2023')),
    ]
    const points = medianByCycle(stats, 'a')
    expect(points.map((p) => p.cycle)).toEqual(['2024-2025'])
    expect(points[0]).toMatchObject({ median: 90, n: 6 })
  })

  it('returns cycles oldest first', () => {
    const stats = [
      ...Array.from({ length: MIN_GROUP }, () => stat('a', 'offer', 95, '2025-2026')),
      ...Array.from({ length: MIN_GROUP }, () => stat('a', 'offer', 90, '2023-2024')),
    ]
    expect(medianByCycle(stats, 'a').map((p) => p.cycle)).toEqual(['2023-2024', '2025-2026'])
  })

  it('ignores rejections — the line is offers only', () => {
    const stats = Array.from({ length: MIN_GROUP }, () => stat('a', 'rejected', 70))
    expect(medianByCycle(stats, 'a')).toEqual([])
  })
})

describe('decisionMix', () => {
  it('produces shares that sum to 1 and drops empty categories', () => {
    const mix = decisionMix({ offer: 80, rejected: 20, waitlisted: 0, deferred: 0 })
    expect(mix.map((d) => d.key)).toEqual(['offer', 'rejected'])
    expect(mix.reduce((n, d) => n + d.share, 0)).toBeCloseTo(1)
    expect(mix[0]).toMatchObject({ count: 80, share: 0.8 })
  })

  it('returns nothing when there are no reports at all', () => {
    expect(decisionMix({ offer: 0, rejected: 0, waitlisted: 0, deferred: 0 })).toEqual([])
  })
})
