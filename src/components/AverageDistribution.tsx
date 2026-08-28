import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { DURATION, EASE, chartDelay } from '../lib/motion'

// Distribution of reported accepted averages for one program.
//
// Single-series magnitude comparison, so: one hue (never a value-ramp across
// bars), hairline solid gridlines, 2px surface gaps rather than strokes between
// bars, and only the median directly labelled — a number on every bar is noise.
// Every value is also reachable in the table view, so the tooltip never gates
// anything.
//
// The fill is --color-chart, which is validated against each theme's surface
// (see the note in index.css). Don't swap it for a UI token without re-running
// the palette validator.

export type Bucket = { from: number; to: number; count: number }

/**
 * Bucket width for an observed range. A fixed 2-point width looks fine on a
 * tight range but falls apart on a wide one: Waterloo CS spans 42–100 because
 * of a single outlier, which at width 2 is 29 buckets of which 22 are empty.
 * Scaling the width keeps the bar count in a readable 12–20 band without
 * dropping any data.
 */
export function chooseWidth(range: number): number {
  if (range <= 10) return 1
  if (range <= 24) return 2
  if (range <= 45) return 3
  if (range <= 70) return 5
  return 10
}

/** Group averages into buckets spanning the observed range. */
export function bucketize(values: number[], width?: number): Bucket[] {
  if (!values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  width = width ?? chooseWidth(max - min)
  const lo = Math.floor(min / width) * width
  // When every value is identical, or they all land on one boundary, lo and hi
  // collapse and the loop below would emit nothing — the chart would silently
  // disappear. Always leave at least one bucket's worth of range.
  const hi = Math.max(Math.ceil(max / width) * width, lo + width)
  const buckets: Bucket[] = []
  for (let from = lo; from < hi; from += width) {
    const to = from + width
    // Final bucket is inclusive of its upper edge so a perfect 100 is counted.
    const isLast = to >= hi
    const count = values.filter((v) => v >= from && (isLast ? v <= to : v < to)).length
    buckets.push({ from, to, count })
  }
  return buckets
}

/**
 * Where one student's average sits within the reported distribution, in words.
 *
 * This is a statement about OTHER PEOPLE'S NUMBERS and must stay one. It says
 * where a value falls among reported averages; it never says what that means
 * for an application. No "competitive", no "strong", no "likely" — those are
 * all probability by another name, and the dataset cannot support any of them.
 *
 * Exported and tested because the wording is the part that would drift.
 */
export function percentileReading(
  you: number,
  q: { p25: number; median: number; p75: number; min: number; max: number },
): string {
  const y = `Your ${you}%`
  if (you < q.min) return `${y} is below every average reported for this program.`
  if (you < q.p25) return `${y} sits in the lowest quarter of the averages reported here.`
  if (you < q.median) return `${y} sits between the 25th and 50th percentile of the averages reported here.`
  if (you < q.p75) return `${y} sits between the 50th and 75th percentile of the averages reported here.`
  if (you <= q.max) return `${y} sits in the top quarter of the averages reported here.`
  return `${y} is above every average reported for this program.`
}

type Props = {
  /** reported averages of students who received an offer */
  values: number[]
  median: number
  p25: number
  p75: number
  /** the student's own average, marked on the chart. null = not given */
  you?: number | null
}

export default function AverageDistribution({ values, median, p25, p75, you }: Props) {
  const [showTable, setShowTable] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const reduced = useReducedMotion()
  const titleId = useId()
  const buckets = useMemo(() => bucketize(values), [values])

  // The viewBox tracks the container's real pixel width so 1 user unit = 1 CSS
  // px. With a fixed viewBox the whole drawing scales down on narrow screens
  // and the 10px axis labels render at ~4.5px on a phone — illegible.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(720)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (w > 0) setW(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!buckets.length) return null

  const H = W < 420 ? 186 : 216
  // top reserves a label band ABOVE the plot. The median label used to be drawn
  // at PAD.top + 6 — inside the plot — so any full-height bar ran straight
  // through the text. The median sits where the tallest bars are by definition,
  // so that collided on nearly every program.
  const PAD = { top: 32, right: 10, bottom: 30, left: 34 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const maxCount = Math.max(...buckets.map((b) => b.count))
  const lo = buckets[0].from
  const hi = buckets[buckets.length - 1].to
  const xFor = (v: number) => PAD.left + ((v - lo) / (hi - lo)) * plotW
  const bandW = plotW / buckets.length

  // Y ticks at clean round numbers.
  const step = maxCount <= 4 ? 1 : Math.ceil(maxCount / 4 / 5) * 5
  const ticks: number[] = []
  for (let t = 0; t <= maxCount; t += step) ticks.push(t)

  return (
    <figure className="mt-6">
      <figcaption id={titleId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-slate">
        <span>Reported averages of students who received an offer ({values.length} reports)</span>
        {/* Live readout for the hovered bucket. Reserves its own row rather than
            floating over the plot, so it can never cover the bars — the mistake
            the median label used to make. aria-live keeps it useful to a screen
            reader driving the chart by keyboard. */}
        <span
          aria-live="polite"
          className="[font-variant-numeric:tabular-nums] min-h-[1.25rem] font-600 text-ink"
        >
          {hover !== null && buckets[hover]
            ? `${buckets[hover].from}–${buckets[hover].to}% · ${buckets[hover].count} report${
                buckets[hover].count === 1 ? '' : 's'
              } (${Math.round((buckets[hover].count / values.length) * 100)}%)`
            : ''}
        </span>
      </figcaption>

      <div ref={wrapRef} className="mt-3 w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-labelledby={titleId}
      >
        {/* p25–p75 band — where the middle half of offers sat */}
        <rect
          x={xFor(p25)}
          y={PAD.top}
          width={Math.max(0, xFor(p75) - xFor(p25))}
          height={plotH}
          fill="var(--color-chart)"
          opacity="0.10"
        />

        {/* gridlines: hairline, solid, recessive */}
        {ticks.map((t) => {
          const y = PAD.top + plotH - (t / maxCount) * plotH
          return (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--color-line)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="var(--color-slate)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {t}
              </text>
            </g>
          )
        })}

        {/* bars — one hue, 2px surface gap, 4px rounded top, square at baseline.
            They grow from the baseline on first paint: a distribution is a shape,
            and drawing it in makes the shape read rather than just appear. */}
        {buckets.map((b, i) => {
          const h = maxCount ? (b.count / maxCount) * plotH : 0
          const x = PAD.left + ((b.from - lo) / (hi - lo)) * plotW
          const w = Math.max(1, bandW - 2)
          const y = PAD.top + plotH - h
          if (h <= 0) return null
          const r = Math.min(4, h, w / 2)
          const isHot = hover === i
          return (
            <motion.path
              key={b.from}
              d={`M${x},${PAD.top + plotH} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${PAD.top + plotH} Z`}
              fill="var(--color-chart)"
              // Scale about the baseline so bars rise instead of fading in place.
              style={{ transformOrigin: `${x + w / 2}px ${PAD.top + plotH}px` }}
              initial={reduced ? false : { scaleY: 0, opacity: 0.6 }}
              animate={{ scaleY: 1, opacity: isHot ? 1 : 0.92 }}
              // The hover highlight has its own transition. It used to share
              // this one, so highlighting a bar ran at 1.0s plus up to 0.5s of
              // stagger delay — a pointer response arriving a second and a half
              // late, on the chart with the most marks to hover.
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      scaleY: { duration: DURATION.base, delay: chartDelay(i), ease: EASE.out },
                      opacity: { duration: DURATION.hover, ease: EASE.out },
                    }
              }
            />
          )
        })}

        {/* Hover layer: full-height hit targets, so you do not have to land on a
            short bar to read it. The dataviz skill treats this as standard for
            bar charts, not an extra. */}
        {buckets.map((b, i) => {
          const x = PAD.left + ((b.from - lo) / (hi - lo)) * plotW
          return (
            <rect
              key={`hit-${b.from}`}
              x={x}
              y={PAD.top}
              width={Math.max(1, bandW)}
              height={plotH}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
            >
              <title>{`${b.from}–${b.to}%: ${b.count} report${b.count === 1 ? '' : 's'}`}</title>
            </rect>
          )
        })}

        {/* baseline */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="var(--color-line)"
          strokeWidth="1"
        />

        {/* median — the one direct label on the chart */}
        <line
          x1={xFor(median)}
          x2={xFor(median)}
          y1={PAD.top - 10}
          y2={PAD.top + plotH}
          stroke="var(--color-ink)"
          strokeWidth="2"
        />
        {/* Label lives in the reserved band above the plot, so it can never
            overlap a bar. Still flips side near the right edge rather than
            clamping flush against it. */}
        {(() => {
          const label = `median ${median}%`
          const est = label.length * 5.8 + 4 // ~11px semibold
          const flip = xFor(median) + 6 + est > W - PAD.right
          return (
            <text
              x={flip ? xFor(median) - 6 : xFor(median) + 6}
              y={PAD.top - 14}
              textAnchor={flip ? 'end' : 'start'}
              fontSize="11"
              fill="var(--color-ink)"
              style={{ fontWeight: 600 }}
            >
              {label}
            </text>
          )
        })()}

        {/* The student's own average.
            Deliberately styled the same wherever it lands: a colour that changed
            with position would be scoring them, and this chart reports what
            other people wrote down rather than judging anyone. Dashed, so it
            reads as "you" against the solid median rather than as a second
            statistic. */}
        {typeof you === 'number' && (() => {
          // An average outside the reported range still has to be shown, pinned
          // to the edge — silently dropping it would be the one case where the
          // marker matters most.
          const clamped = Math.min(hi, Math.max(lo, you))
          const x = xFor(clamped)
          const label = `you ${you}%`
          const est = label.length * 5.8 + 4
          // The median label already owns the band above the plot. When the two
          // are close, drop to a second row rather than overprinting it.
          const near = Math.abs(x - xFor(median)) < est + 16
          const flip = x + 6 + est > W - PAD.right
          return (
            <g>
              <line
                x1={x}
                x2={x}
                y1={near ? PAD.top - 2 : PAD.top - 10}
                y2={PAD.top + plotH}
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              <text
                x={flip ? x - 6 : x + 6}
                y={near ? PAD.top - 26 : PAD.top - 14}
                textAnchor={flip ? 'end' : 'start'}
                fontSize="11"
                fill="var(--color-accent)"
                style={{ fontWeight: 600 }}
              >
                {label}
              </text>
            </g>
          )
        })()}

        {/* x axis. Interior ticks as well as the ends — two labels alone made it
            hard to read a bar's value off the axis. Spaced by width so they
            never collide on a narrow container. */}
        {(() => {
          const span = hi - lo
          const want = W < 420 ? 3 : 5
          const raw = span / (want - 1)
          const nice = [1, 2, 5, 10, 20, 25, 50].find((n) => n >= raw) ?? 50
          const ticks: number[] = []
          for (let v = Math.ceil(lo / nice) * nice; v <= hi; v += nice) ticks.push(v)
          if (!ticks.includes(lo)) ticks.unshift(lo)
          if (!ticks.includes(hi)) ticks.push(hi)
          return ticks.map((v) => {
            const atStart = v === lo
            const atEnd = v === hi
            return (
              <g key={`x-${v}`}>
                <line
                  x1={xFor(v)}
                  x2={xFor(v)}
                  y1={PAD.top + plotH}
                  y2={PAD.top + plotH + 4}
                  stroke="var(--color-line)"
                  strokeWidth="1"
                />
                <text
                  x={xFor(v)}
                  y={H - 10}
                  textAnchor={atStart ? 'start' : atEnd ? 'end' : 'middle'}
                  fontSize="10"
                  fill="var(--color-slate)"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {v}%
                </text>
              </g>
            )
          })
        })()}
      </svg>
      </div>

      {/* The reading, in words. The marker alone invites the viewer to supply
          their own interpretation, and the interpretation people reach for is
          "am I good enough" — so the sentence states the only thing the data
          actually says, and stops there. */}
      {typeof you === 'number' && (
        <p className="mt-3 rounded-lg border border-line bg-surface p-3 text-sm leading-relaxed text-ink">
          {percentileReading(you, {
            p25,
            median,
            p75,
            min: Math.min(...values),
            max: Math.max(...values),
          })}{' '}
          <span className="text-slate">
            That describes the averages students reported after they were admitted — it is not a
            measure of whether you would be.
          </span>
        </p>
      )}

      {/* Table view — the chart's WCAG-clean twin, so no value is tooltip-only. */}
      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="mt-2 text-xs font-600 text-brand-600 underline underline-offset-2"
        aria-expanded={showTable}
      >
        {showTable ? 'Hide table' : 'Show as table'}
      </button>

      {showTable && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Reported offer averages by range</caption>
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-slate">
                <th scope="col" className="py-2 pr-4 font-600">Average</th>
                <th scope="col" className="py-2 font-600">Reports</th>
              </tr>
            </thead>
            <tbody className="[font-variant-numeric:tabular-nums]">
              {buckets.filter((b) => b.count > 0).map((b) => (
                <tr key={b.from} className="border-b border-line/60">
                  <td className="py-1.5 pr-4 text-ink">{b.from}–{b.to}%</td>
                  <td className="py-1.5 text-slate">{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}
