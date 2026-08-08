// Pure maths for the Analytics tab. Kept out of the components so it can be
// tested directly, and so the honesty gates live in one reviewable place rather
// than being scattered through JSX.
//
// The gates matter more than the maths. 95.8% of all reports in the dataset are
// offers (9,607 of 10,372), so any view that puts offers next to rejections can
// be misread as a success rate. These helpers return null rather than render
// something thin, and every caller shows the sample size it is working from.

import type { CommunityStat } from '../data/types'

/** Minimum reports before a group gets its own summary. */
export const MIN_GROUP = 5

export type Summary = {
  n: number
  min: number
  p25: number
  median: number
  p75: number
  max: number
}

/**
 * Percentile on an already-sorted ascending array.
 *
 * This mirrors `percentile()` in scripts/normalize.mjs exactly — linear
 * interpolation between neighbours, not nearest-rank. They must agree: the ETL
 * computes the median shown in the page header, this computes the one shown in
 * the offers-vs-rejections strip, and an earlier nearest-rank version made the
 * same program read 95.9% at the top and 95.8% lower down.
 *
 * `p` is a fraction (0.5 = median), matching normalize.mjs.
 */
function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const val = lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  return Math.round(val * 10) / 10
}

/** Five-number summary, or null when there is too little to summarise. */
export function summarise(values: number[], min = MIN_GROUP): Summary | null {
  if (values.length < min) return null
  const s = [...values].sort((a, b) => a - b)
  const round = (n: number) => Math.round(n * 10) / 10
  return {
    n: s.length,
    min: round(s[0]),
    p25: pct(s, 0.25),
    median: pct(s, 0.5),
    p75: pct(s, 0.75),
    max: round(s[s.length - 1]),
  }
}

/** Reported averages for one program and one decision, nulls dropped. */
export function averagesFor(
  stats: CommunityStat[],
  programId: string,
  decision: string,
): number[] {
  const out: number[] = []
  for (const s of stats) {
    if (s.p === programId && s.d === decision && typeof s.a === 'number') out.push(s.a)
  }
  return out
}

export type CyclePoint = { cycle: string; median: number; n: number }

/**
 * Median offer average per admission cycle, oldest first.
 *
 * Cycles below `min` are dropped rather than plotted thin, because reporting
 * volume grew sharply over time — McMaster Engineering has n=2 for 2022-23
 * against n=153 for 2025-26. Plotting all of them would show a "trend" that is
 * really a change in who was submitting.
 */
export function medianByCycle(
  stats: CommunityStat[],
  programId: string,
  min = MIN_GROUP,
): CyclePoint[] {
  const byCycle = new Map<string, number[]>()
  for (const s of stats) {
    if (s.p !== programId || s.d !== 'offer' || typeof s.a !== 'number') continue
    const list = byCycle.get(s.c)
    if (list) list.push(s.a)
    else byCycle.set(s.c, [s.a])
  }

  return [...byCycle.entries()]
    .filter(([, v]) => v.length >= min)
    .map(([cycle, v]) => {
      const s = summarise(v, min)!
      return { cycle, median: s.median, n: s.n }
    })
    .sort((a, b) => a.cycle.localeCompare(b.cycle))
}

export type DecisionSlice = { key: string; label: string; count: number; share: number }

/**
 * Decision mix as proportions.
 *
 * Deliberately returns shares of *reports*, never a rate — the labels and the
 * caveat beside it carry that distinction, and nothing here should be read as
 * a probability of admission.
 */
export function decisionMix(counts: Record<string, number>): DecisionSlice[] {
  const LABELS: Record<string, string> = {
    offer: 'Offers',
    rejected: 'Rejections',
    waitlisted: 'Waitlisted',
    deferred: 'Deferred',
  }
  const total = Object.values(counts).reduce((n, c) => n + c, 0)
  if (!total) return []
  return (['offer', 'rejected', 'waitlisted', 'deferred'] as const)
    .map((key) => ({
      key,
      label: LABELS[key],
      count: counts[key] ?? 0,
      share: (counts[key] ?? 0) / total,
    }))
    .filter((d) => d.count > 0)
}
