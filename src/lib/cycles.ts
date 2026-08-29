import SUMMARY from '../data/generated/summary.json'

// A student's graduating year, against the application cycles the dataset
// actually holds.
//
// WHY THIS IS NOT WHAT THE BACKLOG ASKED FOR. DASHBOARD-NEXT proposed the
// Overview say "which application cycle describes them and how many reports
// that cycle holds". That cannot be done honestly. The survey offers this year
// plus the next four — 2026 to 2030 — and the newest cycle in the data is
// 2025-2026. So exactly one of the five selectable years maps onto a cycle
// that exists, and the other four map onto nothing. Four students in five
// would be shown either a blank or, worse, another cycle's numbers under the
// word "your".
//
// What IS true for all five, and worth saying, is how recent the data is
// relative to them. That is what `cycleNote` writes: their cycle named, and
// the newest cycle named beside it, with the report count attached to whichever
// sentence it actually belongs to.
//
// NO CLOCK. There is no `now` parameter and the copy never says "last year" or
// "the current cycle" — only "Your cycle is X". That is true whatever the date,
// needs no time-sensitive test, and cannot develop a tense bug when a profile
// synced from an old device arrives carrying a graduating year in the past.
//
// The counts come from `summary.cycles`, which the pipeline emits. stats.json
// is 940kB and this is one sentence; see the note in scripts/build-data.mjs.

export type CycleTotal = { cycle: string; reports: number }

/** Oldest first, as the pipeline sorts them. */
export function cycleTotals(): CycleTotal[] {
  return SUMMARY.cycles
}

/**
 * '2026' -> '2025-2026'. The year they finish, minus the year they apply in.
 *
 * An Ontario student finishing in June of year Y applies during the Y-1 → Y
 * school year. That is not a guess about the convention — `build-data.mjs`
 * labels `applications-2025-2026.xlsx` as cycle `2025-2026`, and those are the
 * applications the class of 2026 submitted. `cycles.test.ts` pins the ±1
 * against the real cycle strings rather than against this comment.
 *
 * Returns null for anything that is not a plausible year, INCLUDING undefined.
 * `undefined` is not hypothetical: the sweep's own seed profile has no
 * `gradYear` key at all, and `isAnswers` only validates `average` and
 * `ambition`, so a stored profile can reach here missing it. Without the
 * integer guard a hand-edited or synced `0` renders the cycle "-1-0".
 */
export function cycleForGradYear(gradYear: number | null | undefined): string | null {
  if (!Number.isInteger(gradYear)) return null
  const y = gradYear as number
  if (y < 1900 || y > 2200) return null
  return `${y - 1}-${y}`
}

export type CycleStanding =
  /** no graduating year, or not a usable one — say nothing */
  | { state: 'unknown' }
  /** their cycle is in the data */
  | { state: 'covered'; cycle: string; reports: number; newest: CycleTotal; isNewest: boolean }
  /** their cycle has not happened yet as far as the data is concerned */
  | { state: 'ahead'; cycle: string; newest: CycleTotal }
  /** their cycle predates everything held */
  | { state: 'behind'; cycle: string; oldest: CycleTotal; newest: CycleTotal }

/**
 * Where a student's cycle sits against the ones the dataset holds.
 *
 * `cycles` is a parameter so the test can drive every branch without depending
 * on which spreadsheets happen to be loaded this month; it defaults to the
 * generated totals, which is what every caller uses.
 */
export function cycleStanding(
  gradYear: number | null | undefined,
  cycles: CycleTotal[] = cycleTotals(),
): CycleStanding {
  const cycle = cycleForGradYear(gradYear)
  if (!cycle || !cycles.length) return { state: 'unknown' }

  const oldest = cycles[0]
  const newest = cycles[cycles.length - 1]
  const mine = cycles.find((c) => c.cycle === cycle)

  if (mine) {
    return { state: 'covered', cycle, reports: mine.reports, newest, isNewest: cycle === newest.cycle }
  }
  // String comparison is safe and total here: every cycle is YYYY-YYYY with a
  // fixed width, so lexical order is chronological order. Parsing the leading
  // year would be the same answer with more ways to be wrong.
  if (cycle > newest.cycle) return { state: 'ahead', cycle, newest }
  return { state: 'behind', cycle, oldest, newest }
}

/**
 * The sentence, as a string rather than as JSX.
 *
 * Same reason `reportDepth` in compareStart.ts returns a string: it is the only
 * way a Rule 1 test can read what a student will actually see. Copy assembled
 * in a component is copy no test can reach.
 *
 * Note where the report count goes in the `ahead` case — attached to the
 * sentence about the NEWEST cycle, never to the sentence about theirs, which
 * says outright that it holds nothing. A count in the student's own sentence
 * would read as "here is what you are up against", which is a claim about
 * competitiveness and is not what the number means.
 */
export function cycleNote(standing: CycleStanding): { line: string; note: string } | null {
  const note =
    'Reporting volume has grown every year, so an older cycle is thinner rather than quieter.'

  switch (standing.state) {
    case 'unknown':
      return null
    case 'covered':
      return {
        line: standing.isNewest
          ? `Your cycle is ${standing.cycle} — the most recent one here, with ${fmt(standing.reports)} reports.`
          : `Your cycle is ${standing.cycle}, with ${fmt(standing.reports)} reports. The most recent one here is ${standing.newest.cycle}.`,
        note,
      }
    case 'ahead':
      return {
        line:
          `Your cycle is ${standing.cycle}, which has no reports here yet. ` +
          `The most recent one is ${standing.newest.cycle}, with ${fmt(standing.newest.reports)} reports.`,
        note,
      }
    case 'behind':
      return {
        line:
          `Your cycle is ${standing.cycle}, which is earlier than anything here. ` +
          `The reports here start at ${standing.oldest.cycle} and run to ${standing.newest.cycle}.`,
        note,
      }
  }
}

/** Grouped, because 5905 in a sentence reads as a year. */
function fmt(n: number): string {
  return n.toLocaleString('en-CA')
}
