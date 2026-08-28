import { useState } from 'react'
import { DURATION, EASE, chartDelay } from '../lib/motion'
import { motion, useReducedMotion } from 'motion/react'
import type { DecisionSlice } from '../lib/analytics'

// Decision mix as one proportional bar.
//
// Not a pie: the ui-ux-pro-max chart table rates pie/donut accessibility "C"
// and warns against slices under 5% — deferred is often 1 report in 200. A
// 100%-stacked bar with a legend and printed counts rates "AA" and stays
// readable at any size.
//
// The shades are steps of the same chart hue, ordered offer -> deferred, so the
// bar reads as one measure split up rather than four competing categories. The
// caveat next to it is doing the real work: this is a mix of who reported, not
// a rate.

const SHADE: Record<string, string> = {
  offer: 'var(--color-chart)',
  rejected: 'color-mix(in oklab, var(--color-chart) 55%, var(--color-surface))',
  waitlisted: 'color-mix(in oklab, var(--color-chart) 32%, var(--color-surface))',
  deferred: 'color-mix(in oklab, var(--color-chart) 16%, var(--color-surface))',
}

export default function DecisionMix({ slices }: { slices: DecisionSlice[] }) {
  const reduced = useReducedMotion()
  const [hover, setHover] = useState<string | null>(null)
  if (!slices.length) return null
  const total = slices.reduce((n, s) => n + s.count, 0)

  return (
    <figure>
      <div
        className="flex h-6 w-full overflow-hidden rounded-full border border-line"
        role="img"
        aria-label={slices.map((s) => `${s.label}: ${s.count}`).join(', ')}
      >
        {slices.map((s, i) => (
          <motion.div
            key={s.key}
            // 2px surface gap between segments rather than a stroke, per the
            // dataviz guidance already followed by the histogram.
            // Width is static and the scale animates: animating the width made
            // every frame a layout pass, which this repo measured at 565ms of
            // style recalculation against 18ms for the transform path.
            style={{
              background: SHADE[s.key],
              marginRight: 2,
              width: `${s.share * 100}%`,
              transformOrigin: 'left',
            }}
            initial={reduced ? false : { scaleX: 0 }}
            animate={{
              scaleX: 1,
              opacity: hover === null || hover === s.key ? 1 : 0.5,
            }}
            // Per property, because the hover dim used to sit in the same
            // transition as the entrance — so the fourth segment did not begin
            // responding to a pointer until 270ms after it arrived.
            transition={
              reduced
                ? { duration: 0 }
                : {
                    scaleX: { duration: DURATION.base, delay: chartDelay(i), ease: EASE.out },
                    opacity: { duration: DURATION.hover, ease: EASE.out },
                  }
            }
            onPointerEnter={() => setHover(s.key)}
            onPointerLeave={() => setHover((k) => (k === s.key ? null : k))}
            title={`${s.label}: ${s.count} of ${total}`}
          />
        ))}
      </div>

      {/* Legend carries the counts directly, so identity is never colour-alone. */}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {slices.map((s) => (
          <li
            key={s.key}
            className="flex items-center gap-2 text-sm"
            onPointerEnter={() => setHover(s.key)}
            onPointerLeave={() => setHover((k) => (k === s.key ? null : k))}
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-sm border border-line"
              style={{ background: SHADE[s.key] }}
            />
            <span className="text-ink">{s.label}</span>
            <span className="text-slate [font-variant-numeric:tabular-nums]">
              {s.count} ({Math.round(s.share * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
