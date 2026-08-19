import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { CyclePoint } from '../lib/analytics'

// Median reported offer average per admission cycle.
//
// Columns rather than a line: with three or four cycles a line implies a
// continuous trend between points that were each measured from a different
// number of reports. Every column prints its own n for the same reason — the
// chart table's rule is that a value never appears without the sample behind it
// when the samples differ this much.

export default function CycleTrend({ points }: { points: CyclePoint[] }) {
  const reduced = useReducedMotion()
  const [hover, setHover] = useState<string | null>(null)
  if (points.length < 2) return null

  // Scale to the observed span, not 0-100: medians sit in a narrow high band
  // and a zero baseline would flatten every column into the same height.
  const values = points.map((p) => p.median)
  const lo = Math.floor((Math.min(...values) - 1) / 2) * 2
  const hi = Math.ceil((Math.max(...values) + 1) / 2) * 2
  const span = Math.max(1, hi - lo)

  return (
    <figure className="mt-4">
      <div className="flex items-end gap-3" style={{ height: 150 }}>
        {points.map((p, i) => {
          const h = ((p.median - lo) / span) * 100
          return (
            <div
              key={p.cycle}
              className="flex h-full flex-1 flex-col justify-end"
              onPointerEnter={() => setHover(p.cycle)}
              onPointerLeave={() => setHover((c) => (c === p.cycle ? null : c))}
            >
              <span className="mb-1 text-center text-xs font-600 text-ink [font-variant-numeric:tabular-nums]">
                {p.median}%
              </span>
              <motion.div
                className="origin-bottom rounded-t-md"
                style={{ background: 'var(--color-chart)' }}
                initial={reduced ? false : { height: 0, opacity: 0.6 }}
                animate={{
                  height: `${Math.max(4, h)}%`,
                  opacity: hover === null || hover === p.cycle ? 1 : 0.55,
                }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }
                }
                title={`${p.cycle}: median ${p.median}% from ${p.n} reports`}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex gap-3 border-t border-line pt-2">
        {points.map((p) => (
          <div key={p.cycle} className="flex-1 text-center">
            <div className="text-xs text-ink">{p.cycle}</div>
            <div className="text-[11px] text-slate [font-variant-numeric:tabular-nums]">
              {p.n} reports
            </div>
          </div>
        ))}
      </div>

      <figcaption className="mt-3 text-sm text-slate">
        Median of reported offer averages per cycle. Cycles with fewer than five reports are left
        out — early years have far fewer submissions, so including them would show a trend in
        reporting volume rather than in admissions.
      </figcaption>
    </figure>
  )
}
