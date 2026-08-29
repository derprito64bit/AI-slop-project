import { describe, expect, it } from 'vitest'
import { compareStarters, reportDepth, type ComparableProgram } from './compareStart'

// MIN_SAMPLE in build-data.mjs. Below it the pipeline sets insufficientData,
// and a median that exists is still not one the site may print.
const MIN_SAMPLE = 5

const program = (
  id: string,
  sampleSize: number,
  totalReports = sampleSize,
  median: number | null = 90,
): ComparableProgram => ({
  id,
  sampleSize,
  totalReports,
  accepted: median === null ? null : { median },
  // Mirrors the pipeline rather than being passed in, so a test cannot
  // accidentally describe a program the dataset could never contain.
  insufficientData: sampleSize < MIN_SAMPLE,
})

describe('compareStarters', () => {
  it('offers the two with the most reported averages behind them', () => {
    const pair = compareStarters([program('a', 12), program('b', 210), program('c', 84)])
    expect(pair.map((p) => p.id)).toEqual(['b', 'c'])
  })

  it('prefers a program that has a distribution over a bigger one that has none', () => {
    // The defect this exists for: sorting on sampleSize alone put a program
    // with accepted: null first, so the table opened on "Not enough data" in
    // the median row and two em dashes under it.
    const pair = compareStarters([
      program('thin-but-charted', 40),
      program('thick-but-unreported', 900, 900, null),
      program('also-charted', 30),
    ])
    expect(pair.map((p) => p.id)).toEqual(['thin-but-charted', 'also-charted'])
  })

  it('prefers a charted program over a below-threshold one that still has a median', () => {
    // The case the `accepted !== null` ordering could not see, and the one that
    // actually occurs: 1,935 of the 2,436 programs carry a median the pipeline
    // has ruled too thin to publish. Volume alone is not the test either — 4
    // reports beats 3 and both are still below the threshold.
    const pair = compareStarters([
      program('one-report', 1),
      program('four-reports', 4),
      program('charted', 6),
    ])
    expect(pair.map((p) => p.id)).toEqual(['charted', 'four-reports'])
  })

  it('breaks a tie by id, so the same list always suggests the same pair', () => {
    const forwards = compareStarters([program('zeta', 50), program('alpha', 50)])
    const backwards = compareStarters([program('alpha', 50), program('zeta', 50)])
    expect(forwards.map((p) => p.id)).toEqual(['alpha', 'zeta'])
    expect(backwards.map((p) => p.id)).toEqual(['alpha', 'zeta'])
  })

  it('falls back to total reports when the reported averages tie', () => {
    const pair = compareStarters([program('a', 50, 60), program('b', 50, 300)], 1)
    expect(pair.map((p) => p.id)).toEqual(['b'])
  })

  it('returns what it has when the list is too short to compare', () => {
    expect(compareStarters([])).toEqual([])
    expect(compareStarters([program('only', 10)])).toHaveLength(1)
  })

  it('leaves the caller list alone', () => {
    // `kept` comes straight off the dashboard context, shared by every view.
    const kept = [program('a', 10), program('b', 99)]
    compareStarters(kept)
    expect(kept.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('reportDepth', () => {
  it('names the median and the count it rests on', () => {
    expect(reportDepth(95.9, 210, false)).toBe('median 95.9% · 210 offers with an average')
  })

  it('says so rather than inventing a median when there is none', () => {
    expect(reportDepth(null, 4, true)).toBe('not enough data to chart yet')
  })

  it('refuses a median the pipeline ruled too thin, even though one exists', () => {
    // The whole point. 1,419 programs rest on a single report, and gating on
    // `median === null` published every one of them as a median — one student
    // saying 97.5, in the voice the site uses for a distribution.
    expect(reportDepth(97.5, 1, true)).toBe('not enough data to chart yet')
    expect(reportDepth(91, 4, true)).toBe('not enough data to chart yet')
  })

  it('says "offer" for one and "offers" for the rest', () => {
    expect(reportDepth(95.9, 1, false)).toBe('median 95.9% · 1 offer with an average')
    expect(reportDepth(95.9, 2, false)).toBe('median 95.9% · 2 offers with an average')
  })

  it('never reads as a probability of admission', () => {
    for (const caption of [reportDepth(95.9, 210, false), reportDepth(null, 4, true)]) {
      expect(caption).not.toMatch(/\bodds\b|\bchance\b|\blikely\b|probab|acceptance/i)
    }
  })

  it('never puts a second count beside the first for the eye to divide', () => {
    // "210 of 240" under one label was an acceptance rate to anyone glancing at
    // it. A caption carries one count and no "of", so there is nothing to
    // divide by.
    expect(reportDepth(95.9, 210, false)).not.toMatch(/\bof\s+[\d,]/)
    expect(reportDepth(95.9, 210, false).match(/[\d,]+(\.\d+)?/g)).toEqual(['95.9', '210'])
  })
})
