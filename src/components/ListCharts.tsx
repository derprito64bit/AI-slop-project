import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { DURATION, EASE, chartDelay } from '../lib/motion'
import { FIT_LABELS, fitFor, type Fit } from '../lib/profile'
import type { Program } from '../data/types'

// Charts about ONE STUDENT'S LIST, for the dashboard's front page.
//
// Distinct from the chart components next door, which describe the dataset:
// AverageDistribution is one program's reported averages, CycleTrend is the
// whole corpus over time, DecisionMix is the reporting bias. These two answer
// "what does the list I have built actually look like", which is the question
// the overview page exists to answer and previously answered in prose.
//
// The palette rules from the existing charts are kept, because the site should
// read as one system: a single hue stepped down through `color-mix` for parts
// of a whole, never a rainbow of unrelated colours, and no value on screen
// without the count behind it.
//
// NEITHER OF THESE IS A PROBABILITY. The spread chart plots what admitted
// students reported next to what the student has; nothing on it says what
// happens if they apply, and the axis label says so in words.

/* ------------------------------------------------------------ stacked bar --- */

export type Segment = { key: string; label: string; count: number }

/**
 * Parts of a whole, as one bar with a legend.
 *
 * A 100%-stacked bar rather than a pie, matching DecisionMix: a pie's small
 * slices are unreadable and rate poorly for accessibility, and a shortlist
 * routinely has a category of one. The counts are printed in the legend, so
 * the bar carries the shape and the text carries the value.
 */
export function StackedBar({ segments, label }: { segments: Segment[]; label: string }) {
  const reduced = useReducedMotion()
  const shown = segments.filter((s) => s.count > 0)
  const total = shown.reduce((n, s) => n + s.count, 0)
  if (!total) return null

  return (
    <div>
      <div
        className="flex h-5 w-full overflow-hidden rounded-full border border-line"
        role="img"
        aria-label={`${label}. ${shown.map((s) => `${s.label}: ${s.count}`).join(', ')}`}
      >
        {/* The width is a STATIC style and the scale is what animates.
            Animating the width itself made every frame a layout pass: this repo
            measured that pattern at 565ms of style recalculation against 18ms
            for the transform path. A transform runs on the compositor and the
            main thread does nothing per frame. */}
        {shown.map((s, i) => (
          <motion.div
            key={s.key}
            style={{
              width: `${(s.count / total) * 100}%`,
              background: shade(i, shown.length),
              marginRight: i < shown.length - 1 ? 2 : 0,
              transformOrigin: 'left',
            }}
            initial={reduced ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: DURATION.base, ease: EASE.out, delay: chartDelay(i) }
            }
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1">
        {shown.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: shade(i, shown.length) }}
            />
            <span className="min-w-0 flex-1 truncate text-slate">{s.label}</span>
            <span className="shrink-0 font-600 text-ink [font-variant-numeric:tabular-nums]">
              {s.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Steps of the one chart hue, darkest first.
 *
 * Mixing toward --color-surface rather than toward white keeps the steps
 * legible in both themes — mixing to white produces near-invisible segments on
 * a dark background.
 */
function shade(i: number, of: number): string {
  if (i === 0) return 'var(--color-chart)'
  const pct = Math.round(70 - (i / Math.max(1, of - 1)) * 50)
  return `color-mix(in oklab, var(--color-chart) ${pct}%, var(--color-surface))`
}

/* ------------------------------------------------------------ list spread --- */

// A real coordinate space, scaled uniformly by the viewBox. An earlier version
// used a 100-wide box stretched to height with preserveAspectRatio="none",
// which turns every circle into an ellipse — the marks are round here because
// the aspect ratio is preserved.
const W = 800
const H = 130
const PAD_X = 44
/** where the axis line sits; dots stack upward from it */
const BASE = 96

/**
 * Every kept program plotted by the median admitted students reported, with the
 * student's own average marked on the same axis.
 *
 * This is the chart the overview was missing. "Four ambitious, two in range" is
 * a summary of this picture, and the picture carries what the summary throws
 * away: whether the ambitious ones are just above the line or twelve points
 * clear of it, and whether the list clusters or spreads.
 *
 * Programs below the reporting threshold are NOT plotted. A dot at a median
 * built from two reports would sit on the axis looking exactly as solid as one
 * built from two hundred; how many are left out is stated under the chart.
 */
export function ListSpread({
  programs,
  average,
}: {
  programs: Program[]
  /** the student's average, or null when the question was skipped */
  average: number | null
}) {
  const reduced = useReducedMotion()
  const [active, setActive] = useState<string | null>(null)

  const points = programs
    .filter((p) => !p.insufficientData && typeof p.accepted?.median === 'number')
    .map((p) => ({ p, median: p.accepted!.median }))
    .sort((a, b) => a.median - b.median)

  const omitted = programs.length - points.length
  if (!points.length) return null

  // The axis has to hold the programs AND the student's average, or the marker
  // for "you" lands outside the frame — which is exactly the case that matters
  // most, a list that sits entirely above where they are.
  const values = [...points.map((d) => d.median), ...(average !== null ? [average] : [])]
  const lo = Math.floor((Math.min(...values) - 1.5) / 2) * 2
  const hi = Math.ceil((Math.max(...values) + 1.5) / 2) * 2
  const span = Math.max(1, hi - lo)
  const x = (v: number) => PAD_X + ((v - lo) / span) * (W - PAD_X * 2)

  const shown = points.find((d) => d.p.id === active) ?? null

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label={`${points.length} programs plotted by reported median, from ${lo}% to ${hi}%${
          average !== null ? `, your average ${average}%` : ''
        }`}
      >
        {/* Baseline. Hairline and solid, like the other charts here. */}
        <line x1={PAD_X} y1={BASE} x2={W - PAD_X} y2={BASE} stroke="var(--color-line)" strokeWidth="1" />

        {average !== null && (
          <line
            x1={x(average)} y1={18} x2={x(average)} y2={BASE + 6}
            stroke="var(--color-accent)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}

        {points.map((d, i) => {
          // Stack vertically so two programs with the same median are both
          // visible. Deterministic — index parity, not randomness, so the chart
          // does not rearrange itself on every render.
          const y = BASE - 14 - (i % 3) * 15
          const fit = average !== null ? fitFor(average, d.median) : null
          return (
            <g key={d.p.id}>
              <motion.circle
                cx={x(d.median)}
                cy={y}
                r={6}
                fill={fit ? FIT_FILL[fit] : 'var(--color-chart)'}
                stroke="var(--color-paper)"
                strokeWidth="1.5"
                style={{ transformOrigin: `${x(d.median)}px ${y}px`, pointerEvents: 'none' }}
                initial={reduced ? false : { opacity: 0 }}
                // The radius used to jump 6 to 8 as a plain attribute, which is
                // the one state change on this chart that never animated. A
                // scale does the same thing on the compositor.
                animate={{ opacity: 1, scale: active === d.p.id ? 1.35 : 1 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : {
                        opacity: { duration: DURATION.base, delay: chartDelay(i), ease: EASE.out },
                        scale: { duration: DURATION.hover, ease: EASE.out },
                      }
                }
              />
              {/* A SEPARATE HIT TARGET, and a focusable one.
                  The dot is r=6 — a 12px mark, which the dataviz anti-patterns
                  name outright as a pinpoint target nobody lands on reliably;
                  the floor is ~24px. And the dot was pointer-only, so a keyboard
                  user got no readout at all, on the one chart whose values live
                  in a caption rather than on the marks. Focus now does exactly
                  what hover does. */}
              <circle
                cx={x(d.median)}
                cy={y}
                r={13}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${d.p.name}, ${d.median}% median`}
                style={{ cursor: 'pointer' }}
                onPointerEnter={() => setActive(d.p.id)}
                onPointerLeave={() => setActive((c) => (c === d.p.id ? null : c))}
                onFocus={() => setActive(d.p.id)}
                onBlur={() => setActive((c) => (c === d.p.id ? null : c))}
              >
                <title>{`${d.p.name} — ${d.median}% median`}</title>
              </circle>
            </g>
          )
        })}

        <text x={PAD_X} y={BASE + 20} fontSize="12" textAnchor="middle" fill="var(--color-slate)">
          {lo}%
        </text>
        <text x={W - PAD_X} y={BASE + 20} fontSize="12" textAnchor="middle" fill="var(--color-slate)">
          {hi}%
        </text>
        {average !== null && (
          <text
            x={x(average)} y={12}
            fontSize="12"
            textAnchor="middle"
            fill="var(--color-accent)"
            style={{ fontWeight: 600 }}
          >
            you · {average}%
          </text>
        )}
      </svg>

      {/* The readout sits below rather than floating over the marks, the same
          rule the map and the distribution chart follow: a panel that covers
          what you are pointing at is worse than one that stays still. */}
      <figcaption className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-slate">
        {shown ? (
          <>
            <span className="font-600 text-ink">{shown.p.name}</span> — {shown.median}% median from{' '}
            {shown.p.sampleSize} reported offers.
          </>
        ) : (
          <>
            Each dot is one program on your list, placed at the median average admitted students
            reported for it
            {average !== null ? ', against yours' : ''}. Not a chance of admission.
            {omitted > 0 && ` ${omitted} program${omitted === 1 ? '' : 's'} left off — not enough reports yet.`}
          </>
        )}
      </figcaption>
    </figure>
  )
}

const FIT_FILL: Record<Fit, string> = {
  ambitious: 'var(--color-chart)',
  'in-range': 'color-mix(in oklab, var(--color-chart) 55%, var(--color-surface))',
  comfortable: 'color-mix(in oklab, var(--color-chart) 28%, var(--color-surface))',
}

/** Legend for the spread chart's fills, so the colours mean something. */
export function FitLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {(['ambitious', 'in-range', 'comfortable'] as Fit[]).map((k) => (
        <li key={k} className="flex items-center gap-1.5 text-xs text-slate">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ background: FIT_FILL[k] }}
          />
          {FIT_LABELS[k].label}
        </li>
      ))}
    </ul>
  )
}
