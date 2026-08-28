import { motion, useReducedMotion } from 'motion/react'
import { DURATION, EASE, chartDelay } from '../lib/motion'
import { FIT_LABELS, balanceOf, fitFor, type Fit } from '../lib/profile'
import type { Program } from '../data/types'

// "Is my list realistic?" — the shape of a shortlist against one student's
// average.
//
// Every number here is a comparison of two reported averages. It is not a
// chance of admission and must never be worded as one; the copy says what the
// data says, which is what *other people who got in* reported.

const ORDER: Fit[] = ['ambitious', 'in-range', 'comfortable']

const BAR: Record<Fit, string> = {
  ambitious: 'var(--color-chart)',
  'in-range': 'color-mix(in oklab, var(--color-chart) 55%, var(--color-surface))',
  comfortable: 'color-mix(in oklab, var(--color-chart) 28%, var(--color-surface))',
}

export default function BalanceCheck({
  average,
  programs,
}: {
  average: number
  programs: Program[]
}) {
  // Above the early return, without exception: a hook after it changes the hook
  // order the moment `total` goes from 0 to non-zero.
  const reduced = useReducedMotion()

  const counts = balanceOf(average, programs)
  const total = ORDER.reduce((n, k) => n + counts[k], 0)
  if (!total) return null

  // A list that is entirely one bucket is worth pointing out — that is the
  // whole reason to show this.
  const only = ORDER.find((k) => counts[k] === total)

  return (
    <section>
      <div
        className="flex h-6 w-full overflow-hidden rounded-full border border-line"
        role="img"
        aria-label={ORDER.map((k) => `${FIT_LABELS[k].label}: ${counts[k]}`).join(', ')}
      >
        {/* This bar was the one on the site that never animated, so the same
            stacked shape arrived differently depending on which page you were
            on. Same scaleX growth as StackedBar and DecisionMix. */}
        {ORDER.filter((k) => counts[k] > 0).map((k, i) => (
          <motion.div
            key={k}
            style={{
              width: `${(counts[k] / total) * 100}%`,
              background: BAR[k],
              marginRight: 2,
              transformOrigin: 'left',
            }}
            initial={reduced ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: DURATION.base, ease: EASE.out, delay: chartDelay(i) }
            }
            title={`${FIT_LABELS[k].label}: ${counts[k]}`}
          />
        ))}
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        {ORDER.map((k) => (
          <div key={k} className="rounded-xl border border-line bg-paper p-4">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-sm border border-line"
                style={{ background: BAR[k] }}
              />
              <dt className="text-sm font-600 text-ink">{FIT_LABELS[k].label}</dt>
              <dd className="ml-auto font-display text-xl font-600 text-ink [font-variant-numeric:tabular-nums]">
                {counts[k]}
              </dd>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate">{FIT_LABELS[k].blurb}</p>
          </div>
        ))}
      </dl>

      {only && total > 2 && (
        <p className="mt-5 rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-ink">
          Every program on your list is <strong className="font-600">{FIT_LABELS[only].label.toLowerCase()}</strong>.
          {only === 'ambitious'
            ? ' Worth adding a few where admitted averages sit closer to yours, so the list has somewhere to land.'
            : only === 'comfortable'
              ? " Nothing wrong with that — but if there's a program you actually want, add it even if the averages look high."
              : ' A little spread either way gives you more to work with.'}
        </p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-slate">
        Buckets compare your average with the median average admitted students reported. Because
        people who get in are likelier to report, these describe who reported — not your chances.
      </p>
    </section>
  )
}

/** The single-program version, for a card. */
export function FitTag({ average, program }: { average: number; program: Program }) {
  const fit = fitFor(average, program.accepted?.median)
  if (!fit) return null
  return (
    <span
      className="rounded-full border border-line px-2 py-0.5 text-[11px] font-600 text-slate"
      title={FIT_LABELS[fit].blurb}
    >
      {FIT_LABELS[fit].label}
    </span>
  )
}
