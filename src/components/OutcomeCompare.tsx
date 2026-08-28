import { DURATION, EASE } from '../lib/motion'
import { motion, useReducedMotion } from 'motion/react'
import type { Summary } from '../lib/analytics'

// Offer vs rejection averages, as two range strips on a shared scale.
//
// NOT a box plot, despite that being the chart table's first choice for
// distributions: it also says a box plot needs 20+ points per group, and only
// three programs in the dataset clear that for rejections. A median marker on a
// p25-p75 strip says exactly as much as the data supports and no more.
//
// This view is the closest thing on the site to something that could be
// misread as odds, so the sample sizes are printed on the strips themselves and
// the caveat is not optional.

type Props = {
  offers: Summary
  rejections: Summary
}

const ROWS = [
  { key: 'offers', label: 'Offers', fill: 'var(--color-chart)' },
  {
    key: 'rejections',
    label: 'Rejections',
    fill: 'color-mix(in oklab, var(--color-chart) 45%, var(--color-surface))',
  },
] as const

/**
 * Where the median sits inside the p25-p75 strip, as a percentage of its width.
 *
 * That point is the strip's transform origin, so it grows outwards from the
 * median exactly as the old `left` + `width` animation did. Guarded because a
 * degenerate strip (p25 === p75) would divide by zero.
 */
function medianOrigin(p25: number, median: number, p75: number): number {
  const span = p75 - p25
  if (span <= 0) return 50
  return Math.max(0, Math.min(100, ((median - p25) / span) * 100))
}

export default function OutcomeCompare({ offers, rejections }: Props) {
  const reduced = useReducedMotion()
  // Shared scale across both rows, padded so end caps are never flush.
  const lo = Math.floor(Math.min(offers.min, rejections.min) / 5) * 5
  const hi = Math.ceil(Math.max(offers.max, rejections.max) / 5) * 5
  const span = Math.max(1, hi - lo)
  const pos = (v: number) => ((v - lo) / span) * 100

  const data = { offers, rejections }

  return (
    <figure className="mt-4">
      <ul className="space-y-5">
        {ROWS.map((row) => {
          const s = data[row.key]
          return (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-600 text-ink">{row.label}</span>
                <span className="text-slate [font-variant-numeric:tabular-nums]">
                  median {s.median}% · {s.n} reports
                </span>
              </div>

              <div
                className="relative mt-2 h-8"
                role="img"
                aria-label={`${row.label}: median ${s.median}%, middle half ${s.p25}% to ${s.p75}%, range ${s.min}% to ${s.max}%, from ${s.n} reports`}
              >
                {/* full observed range — recessive */}
                <div
                  className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-line"
                  style={{ left: `${pos(s.min)}%`, width: `${pos(s.max) - pos(s.min)}%` }}
                />
                {/* p25–p75, where the middle half sat. Grows from the median
                    outwards, so the eye lands on the median first. */}
                {/* `left` and `width` are static and the scale animates. This
                    animated BOTH of them at once, which is the most expensive
                    thing on the page: two layout properties, per frame, per row.
                    Scaling from the median's own position inside the strip gives
                    the identical "grows outwards from the median" movement on
                    the compositor instead. */}
                <motion.div
                  className="absolute top-1/2 h-4 -translate-y-1/2 rounded-md"
                  style={{
                    background: row.fill,
                    left: `${pos(s.p25)}%`,
                    width: `${Math.max(0.6, pos(s.p75) - pos(s.p25))}%`,
                    transformOrigin: `${medianOrigin(pos(s.p25), pos(s.median), pos(s.p75))}% center`,
                  }}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          duration: DURATION.base,
                          delay: row.key === 'offers' ? 0.07 : 0.2,
                          ease: EASE.out,
                        }
                  }
                />
                {/* median — the one direct marker */}
                <motion.div
                  className="absolute top-1/2 h-6 w-0.5 -translate-y-1/2 bg-ink"
                  style={{ left: `${pos(s.median)}%` }}
                  initial={reduced ? false : { scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  // Carried no `ease` at all and fell back to the library default,
                  // so it was the one mark on the page not on the site's curve.
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: DURATION.base, delay: 0.34, ease: EASE.out }
                  }
                />
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 flex justify-between text-xs text-slate [font-variant-numeric:tabular-nums]">
        <span>{lo}%</span>
        <span>{hi}%</span>
      </div>

      <figcaption className="mt-4 rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-slate">
        <strong className="font-600 text-ink">These two groups are not comparable in size.</strong>{' '}
        Students who get in report far more often than students who don’t — across the whole
        dataset there are 9,607 reported offers against 434 rejections. Read this as “what averages
        each group reported”, never as a chance of admission.
      </figcaption>
    </figure>
  )
}
