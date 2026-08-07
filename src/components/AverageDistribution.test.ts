import { describe, it, expect } from 'vitest'
import { bucketize } from './AverageDistribution'

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
