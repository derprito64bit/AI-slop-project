import { describe, expect, it } from 'vitest'
import STATS from '../data/generated/stats.json'
import SUMMARY from '../data/generated/summary.json'
import { cycleForGradYear, cycleNote, cycleStanding, cycleTotals, type CycleTotal } from './cycles'

const CYCLES: CycleTotal[] = [
  { cycle: '2022-2023', reports: 953 },
  { cycle: '2023-2024', reports: 1446 },
  { cycle: '2024-2025', reports: 2068 },
  { cycle: '2025-2026', reports: 5905 },
]

describe('cycleForGradYear', () => {
  it('maps the graduating year back to the year they applied', () => {
    expect(cycleForGradYear(2026)).toBe('2025-2026')
    expect(cycleForGradYear(2027)).toBe('2026-2027')
    expect(cycleForGradYear(2023)).toBe('2022-2023')
  })

  it('refuses anything that is not a plausible year', () => {
    // `undefined` is the one that actually happens: the sweep's seed profile
    // has no gradYear key, and isAnswers does not require one.
    for (const bad of [null, undefined, 0, -1, NaN, 2027.5, 1899, 2201]) {
      expect(cycleForGradYear(bad as number)).toBeNull()
    }
  })

  it('never renders a negative year', () => {
    // The specific shape the integer guard exists for: without it, 0 produced
    // the cycle "-1-0" and rendered it in a sentence.
    expect(cycleForGradYear(0)).not.toBe('-1-0')
  })
})

describe('the ±1 convention, pinned to the dataset', () => {
  const present = new Set((STATS as Array<{ c: string }>).map((r) => r.c))

  it('puts a 2026 graduate in a cycle the data actually holds', () => {
    expect(present.has(cycleForGradYear(2026) as string)).toBe(true)
  })

  it('and a 2027 graduate in one it does not', () => {
    // This is the whole reason the backlog's original idea was dropped. When a
    // 2026-2027 sheet lands this test fails, which is correct — the copy in
    // cycleNote has to be revisited at that point, not silently kept.
    expect(present.has(cycleForGradYear(2027) as string)).toBe(false)
  })

  it('every cycle string is YYYY-YYYY with consecutive years', () => {
    // cycleStanding compares cycle strings lexically. That is only sound while
    // they are fixed-width and chronological.
    for (const c of present) {
      const m = /^(\d{4})-(\d{4})$/.exec(c)
      expect(m, `${c} is not YYYY-YYYY`).not.toBeNull()
      expect(Number((m as RegExpExecArray)[2])).toBe(Number((m as RegExpExecArray)[1]) + 1)
    }
  })
})

describe('summary.cycles agrees with stats.json', () => {
  // DatabaseView keeps counting its own per-cycle totals, because it needs
  // withAverage and a mean in a pass it already makes. This is what stops the
  // two from ever disagreeing.
  const counted = new Map<string, number>()
  for (const r of STATS as Array<{ c: string }>) counted.set(r.c, (counted.get(r.c) ?? 0) + 1)

  it('names the same cycles, oldest first', () => {
    expect(cycleTotals().map((c) => c.cycle)).toEqual([...counted.keys()].sort())
  })

  it('counts each one exactly', () => {
    for (const { cycle, reports } of cycleTotals()) expect(reports).toBe(counted.get(cycle))
  })

  it('does not claim more reports than the summary holds', () => {
    // Not equality: summary.reports is summed from programs.totalReports, and
    // stats.json is the per-report file. They are close but they are not the
    // same denominator, and asserting equality would be asserting a coincidence.
    const total = cycleTotals().reduce((n, c) => n + c.reports, 0)
    expect(total).toBeLessThanOrEqual(SUMMARY.reports)
    expect(total).toBeGreaterThan(0)
  })
})

describe('summary.decisions agrees with stats.json', () => {
  // OutcomeCompare prints two of these in a sentence a student reads. They used
  // to be typed into the component, and they were right — which is the version
  // that rots silently. This is what stops that.
  const counted = new Map<string, number>()
  for (const r of STATS as Array<{ d: string }>) counted.set(r.d, (counted.get(r.d) ?? 0) + 1)

  it('names the same decisions', () => {
    expect(Object.keys(SUMMARY.decisions).sort()).toEqual([...counted.keys()].sort())
  })

  it('counts each one exactly', () => {
    for (const [decision, n] of Object.entries(SUMMARY.decisions)) {
      expect(n, decision).toBe(counted.get(decision))
    }
  })

  it('accounts for every report', () => {
    const total = Object.values(SUMMARY.decisions).reduce((n, v) => n + v, 0)
    expect(total).toBe((STATS as unknown[]).length)
  })

  it('still holds the two OutcomeCompare prints', () => {
    // Named explicitly: if the pipeline ever stops emitting these keys the
    // component renders "undefined reported offers", which no other test here
    // would catch.
    expect(typeof SUMMARY.decisions.offer).toBe('number')
    expect(typeof SUMMARY.decisions.rejected).toBe('number')
    expect(SUMMARY.decisions.offer).toBeGreaterThan(0)
    expect(SUMMARY.decisions.rejected).toBeGreaterThan(0)
  })
})

describe('cycleStanding', () => {
  it('knows the newest cycle from the rest', () => {
    const s = cycleStanding(2026, CYCLES)
    expect(s).toEqual({
      state: 'covered',
      cycle: '2025-2026',
      reports: 5905,
      newest: CYCLES[3],
      isNewest: true,
    })
  })

  it('places an older graduate in their own cycle, not the newest', () => {
    const s = cycleStanding(2025, CYCLES)
    expect(s.state).toBe('covered')
    if (s.state !== 'covered') return
    expect(s.reports).toBe(2068)
    expect(s.isNewest).toBe(false)
    expect(s.newest.cycle).toBe('2025-2026')
  })

  it('says ahead when their cycle has not been reported on yet', () => {
    expect(cycleStanding(2027, CYCLES)).toEqual({
      state: 'ahead',
      cycle: '2026-2027',
      newest: CYCLES[3],
    })
    expect(cycleStanding(2030, CYCLES).state).toBe('ahead')
  })

  it('says behind for a stale synced year from before the data', () => {
    // sync.ts does not range-check gradYear — it only checks typeof number —
    // so a profile from an older device can carry one.
    const s = cycleStanding(2021, CYCLES)
    expect(s).toEqual({ state: 'behind', cycle: '2020-2021', oldest: CYCLES[0], newest: CYCLES[3] })
  })

  it('is unknown with no year, and with no cycles to compare against', () => {
    expect(cycleStanding(null, CYCLES).state).toBe('unknown')
    expect(cycleStanding(undefined, CYCLES).state).toBe('unknown')
    expect(cycleStanding(2026, []).state).toBe('unknown')
  })
})

describe('cycleNote', () => {
  const lines = [2026, 2025, 2027, 2021].map(
    (y) => (cycleNote(cycleStanding(y, CYCLES)) as { line: string }).line,
  )

  it('says nothing at all when there is no year', () => {
    expect(cycleNote(cycleStanding(null, CYCLES))).toBeNull()
  })

  it('names both their cycle and the newest one, in every state', () => {
    for (const line of lines) expect(line).toMatch(/^Your cycle is \d{4}-\d{4}/)
    expect(lines[0]).toContain('the most recent one here')
    for (const line of lines.slice(1)) expect(line).toMatch(/2025-2026/)
  })

  it('never states a probability of admission', () => {
    const note = (cycleNote(cycleStanding(2026, CYCLES)) as { note: string }).note
    for (const s of [...lines, note]) {
      expect(s).not.toMatch(/\bodds\b|\bchance\b|\blikely\b|probab|acceptance/i)
    }
  })

  it('never attaches a report count to a cycle that holds none', () => {
    // The `ahead` case is the one that could mislead: 5,905 belongs to
    // 2025-2026, and putting it in the same sentence as the student's own
    // empty cycle would read as "this is what you are up against".
    const ahead = (cycleNote(cycleStanding(2027, CYCLES)) as { line: string }).line
    const theirs = ahead.split('. ')[0]
    expect(theirs).toContain('no reports here yet')
    expect(theirs).not.toMatch(/[\d,]{3,}\s*reports/)
    expect(ahead).toMatch(/most recent one is 2025-2026, with 5,905 reports/)
  })

  it('never puts a second count beside the first for the eye to divide', () => {
    // Same rule as reportDepth: "210 of 240" under one label is an acceptance
    // rate to anyone glancing at it.
    for (const line of lines) expect(line).not.toMatch(/\bof\s+[\d,]/)
  })

  it('groups the thousands, so a count does not read as a year', () => {
    expect(lines[0]).toContain('5,905')
    expect(lines[0]).not.toContain('5905')
  })
})
