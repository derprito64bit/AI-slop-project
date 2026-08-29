// Getting a student INTO the compare table, rather than describing it to them.
//
// Compare is the one dashboard tool that shows nothing until you have staged
// two programs somewhere else, so the page a new student sees is the page that
// has to sell the page they have never seen. These are the two decisions that
// needed to be testable: which of their own programs to offer as a starting
// pair, and how to caption a program's data depth without the caption reading
// as a rate.
//
// THIS IS A RANKING OF DATA, NOT OF PROGRAMS. `compareStarters` puts the
// best-reported programs first because they are the ones whose rows are filled
// in — it says nothing about a program being better, easier or more open, and
// no copy built on it may imply that it does.

/** The part of a Program that decides which pair best demonstrates the table. */
export type ComparableProgram = {
  id: string
  /** offers that came with a usable average — what the distribution rests on */
  sampleSize: number
  /** every report of any outcome */
  totalReports: number
  /** null only when `sampleSize` is 0 — see `chartable` below, it is NOT the threshold */
  accepted: { median: number } | null
  /** `sampleSize < MIN_SAMPLE` in build-data.mjs. THIS is the threshold. */
  insufficientData: boolean
}

/**
 * Whether this program's median may be shown at all.
 *
 * `accepted !== null` is NOT that test and using it is the mistake this
 * function exists to stop. build-data.mjs sets `accepted` whenever
 * `sampleSize > 0`, and sets `insufficientData` when `sampleSize < MIN_SAMPLE`
 * — so 1,935 of the 2,436 programs carry a median that the pipeline has
 * already ruled too thin to publish, and 1,419 of those rest on a single
 * report. `carleton::architectural-studie-design` is one person saying 97.5.
 *
 * Everything else in the codebase gates on `insufficientData` (build-data's own
 * featured list at :373, the chart counts at :394 and :407). Anything reading
 * `accepted` directly quietly opts out of that and republishes one student's
 * self-report as a median.
 */
function chartable(p: ComparableProgram): boolean {
  return p.accepted !== null && !p.insufficientData
}

/**
 * The programs from a student's own list that open the table with the most in it.
 *
 * Ordered by whether the median may be SHOWN first, and only then by volume.
 * Sorting on `sampleSize` alone looks equivalent and is not, though not for the
 * reason this comment first gave: it claimed a program could carry many reports
 * and still have `accepted: null`, and no record in the dataset does — that
 * ordering was dead code justified by an impossible case.
 *
 * The real one is `insufficientData`. A program with four reports has an
 * `accepted` median and is still below the publishing threshold, so a pair
 * chosen on volume alone can open the table on two rows the rest of the site
 * would refuse to print. `chartable` is the same gate build-data.mjs uses.
 *
 * Structural parameter and a generic return so the node-only test runner can
 * call it with four fields instead of a whole Program, and callers still get
 * their own type back.
 */
export function compareStarters<T extends ComparableProgram>(kept: T[], count = 2): T[] {
  return [...kept]
    .sort(
      (a, b) =>
        Number(chartable(b)) - Number(chartable(a)) ||
        b.sampleSize - a.sampleSize ||
        b.totalReports - a.totalReports ||
        // Ties broken by id so the same list always suggests the same pair.
        // Without it the suggestion depends on shortlist order, and re-keeping
        // a program silently changes what the empty state offers.
        a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(0, count))
}

/**
 * How much data stands behind one program, in one line.
 *
 * ONE COUNT, DELIBERATELY. The table carries two — `sampleSize` (offers that
 * came with a usable average) and `totalReports` (every report of any outcome)
 * — and they do not divide; the comment beside those rows in CompareTable
 * spells out why. A caption is a single line of small grey text, which is
 * exactly the place two numbers get read as one over the other, so this one
 * never carries the second.
 *
 * `insufficientData` IS THE GATE, not `median === null`. An earlier version
 * gated on the median and so printed "median 97.5% · 1 offers with an average"
 * for the 1,419 programs that rest on a single report — one student's
 * self-report, in the voice the site uses for a distribution, in the first
 * thing a new student sees of this tool. See `chartable`.
 */
export function reportDepth(
  median: number | null,
  sampleSize: number,
  insufficientData: boolean,
): string {
  if (median === null || insufficientData) return 'not enough data to chart yet'
  // Singular matters here rather than being tidiness: `sampleSize` of 1 is the
  // single most common value in the catalogue, so "1 offers" would be the
  // version most students saw. It is now unreachable from this branch, and the
  // plural still has to be right for the ones that do print.
  const offers = sampleSize === 1 ? 'offer' : 'offers'
  return `median ${median}% · ${sampleSize.toLocaleString()} ${offers} with an average`
}
