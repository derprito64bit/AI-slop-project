import { useId, useMemo, useState } from 'react'

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

/** Group averages into fixed-width buckets spanning the observed range. */
export function bucketize(values: number[], width = 2): Bucket[] {
  if (!values.length) return []
  const lo = Math.floor(Math.min(...values) / width) * width
  // When every value is identical, or they all land on one boundary, lo and hi
  // collapse and the loop below would emit nothing — the chart would silently
  // disappear. Always leave at least one bucket's worth of range.
  const hi = Math.max(Math.ceil(Math.max(...values) / width) * width, lo + width)
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

type Props = {
  /** reported averages of students who received an offer */
  values: number[]
  median: number
  p25: number
  p75: number
}

export default function AverageDistribution({ values, median, p25, p75 }: Props) {
  const [showTable, setShowTable] = useState(false)
  const titleId = useId()
  const buckets = useMemo(() => bucketize(values), [values])

  if (!buckets.length) return null

  // Geometry in SVG user units; the viewBox scales to the container.
  const W = 720
  const H = 200
  const PAD = { top: 16, right: 8, bottom: 30, left: 34 }
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
      <figcaption id={titleId} className="text-sm text-slate">
        Reported averages of students who received an offer ({values.length} reports)
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-labelledby={titleId}
        style={{ height: 'auto' }}
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

        {/* bars — one hue, 2px surface gap, 4px rounded top, square at baseline */}
        {buckets.map((b) => {
          const h = maxCount ? (b.count / maxCount) * plotH : 0
          const x = PAD.left + ((b.from - lo) / (hi - lo)) * plotW
          const w = Math.max(1, bandW - 2)
          const y = PAD.top + plotH - h
          if (h <= 0) return null
          const r = Math.min(4, h, w / 2)
          return (
            <path
              key={b.from}
              d={`M${x},${PAD.top + plotH} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${PAD.top + plotH} Z`}
              fill="var(--color-chart)"
            >
              <title>{`${b.from}–${b.to}%: ${b.count} report${b.count === 1 ? '' : 's'}`}</title>
            </path>
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
          y1={PAD.top - 4}
          y2={PAD.top + plotH}
          stroke="var(--color-ink)"
          strokeWidth="2"
        />
        <text
          x={Math.min(xFor(median) + 6, W - PAD.right - 68)}
          y={PAD.top + 6}
          fontSize="11"
          fill="var(--color-ink)"
          style={{ fontWeight: 600 }}
        >
          median {median}%
        </text>

        {/* x axis: only the two ends, so labels never collide */}
        <text x={PAD.left} y={H - 10} fontSize="10" fill="var(--color-slate)" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {lo}%
        </text>
        <text x={W - PAD.right} y={H - 10} textAnchor="end" fontSize="10" fill="var(--color-slate)" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {hi}%
        </text>
      </svg>

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
