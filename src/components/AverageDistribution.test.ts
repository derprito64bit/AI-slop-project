import { describe, it, expect } from 'vitest'
import { bucketize, percentileReading } from './AverageDistribution'

describe('bucketize', () => {
  it('groups values into fixed-width buckets across the observed range', () => {
    const b = bucketize([80, 81, 83, 84, 85], 2)
    expect(b[0]).toEqual({ from: 80, to: 82, count: 2 })
    expect(b.map((x) => x.from)).toEqual([80, 82, 84])
  })

  it('counts every value exactly once', () => {
    const values = [82.4, 91, 93.5, 95.9, 96, 97.3, 99, 100]
    const total = bucketize(values).reduce((n, b) => n + b.count, 0)
    expect(total).toBe(values.length)
  })

  it('includes the top of the final bucket, so a perfect 100 is not dropped', () => {
    const b = bucketize([96, 98, 100], 2)
    expect(b.reduce((n, x) => n + x.count, 0)).toBe(3)
    expect(b[b.length - 1].to).toBe(100)
  })

  it('snaps bucket edges to the width, not to the min value', () => {
    expect(bucketize([83.7, 84.2], 2)[0].from).toBe(82)
  })

  it('handles a single value and an empty set', () => {
    expect(bucketize([90]).reduce((n, b) => n + b.count, 0)).toBe(1)
    expect(bucketize([])).toEqual([])
  })
})

describe('percentileReading', () => {
  const q = { p25: 90, median: 93, p75: 96, min: 82, max: 100 }

  it('places a value in each quarter of the reported range', () => {
    expect(percentileReading(85, q)).toMatch(/lowest quarter/)
    expect(percentileReading(91, q)).toMatch(/25th and 50th/)
    expect(percentileReading(94, q)).toMatch(/50th and 75th/)
    expect(percentileReading(98, q)).toMatch(/top quarter/)
  })

  it('handles a value outside the reported range rather than dropping it', () => {
    expect(percentileReading(70, q)).toMatch(/below every average/)
    expect(percentileReading(100.5, q)).toMatch(/above every average/)
  })

  it('treats the quartile boundaries consistently', () => {
    // On a boundary the value belongs to the band it opens, not the one it closes.
    expect(percentileReading(90, q)).toMatch(/25th and 50th/)
    expect(percentileReading(93, q)).toMatch(/50th and 75th/)
    expect(percentileReading(96, q)).toMatch(/top quarter/)
  })

  it('never states a probability, a chance, or a judgement', () => {
    const forbidden = /chance|odds|likel|competitive|strong|good|weak|chances/i
    for (const v of [70, 85, 90, 91, 93, 94, 96, 98, 101]) {
      expect(percentileReading(v, q)).not.toMatch(forbidden)
    }
  })

  it('always names the student’s own number', () => {
    expect(percentileReading(88, q)).toContain('88%')
  })
})
