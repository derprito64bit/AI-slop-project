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
  if (!slices.length) return null
  const total = slices.reduce((n, s) => n + s.count, 0)

  return (
    <figure>
      <div
        className="flex h-6 w-full overflow-hidden rounded-full border border-line"
        role="img"
        aria-label={slices.map((s) => `${s.label}: ${s.count}`).join(', ')}
      >
        {slices.map((s) => (
          <div
            key={s.key}
            // 2px surface gap between segments rather than a stroke, per the
            // dataviz guidance already followed by the histogram.
            style={{ width: `${s.share * 100}%`, background: SHADE[s.key], marginRight: 2 }}
            title={`${s.label}: ${s.count} of ${total}`}
          />
        ))}
      </div>

      {/* Legend carries the counts directly, so identity is never colour-alone. */}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
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
