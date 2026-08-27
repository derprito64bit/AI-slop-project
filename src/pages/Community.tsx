import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Eyebrow from '../components/ui/Eyebrow'
import Reveal from '../components/Reveal'
import DecisionMix from '../components/DecisionMix'
import { Skeleton, LoadingNote } from '../components/Skeleton'
import { loadStats, loadCatalogue } from '../lib/dataSource'
import { decisionMix } from '../lib/analytics'
import { FIELD_LABELS } from '../lib/profile'
import type { CommunityStat, Program, University } from '../data/types'

// What the community actually reported — and why it is not an acceptance rate.
//
// This page exists to make the site's central caveat concrete. Everywhere else
// says "this is not an admission chance" in a note under a chart; here the
// reason is the content: 93% of reports are offers, and the honest reading of
// that number is who chose to answer, not who got in.
//
// Every figure is computed from stats.json at render time. The one thing this
// page deliberately does NOT draw is a trend line through the averages: they
// are flat across four cycles (92.6 -> 93.0) while the volume grew six-fold, so
// a chart of them would invite a story the data does not support. The page says
// that in words instead.

type Cycle = { cycle: string; reports: number; withAverage: number; mean: number | null }

export default function Community() {
  const [stats, setStats] = useState<CommunityStat[] | null>(null)
  const [data, setData] = useState<{ programs: Program[]; universities: University[] } | null>(null)

  useEffect(() => {
    loadStats().then(setStats).catch(() => {})
    loadCatalogue().then(setData).catch(() => {})
  }, [])

  const summary = useMemo(() => {
    if (!stats) return null

    const decisions: Record<string, number> = {}
    const cycles = new Map<string, { reports: number; withAverage: number; total: number }>()
    const byUni: Record<string, number> = {}
    const byField: Record<string, number> = {}
    const programName = new Map((data?.programs ?? []).map((p) => [p.id, p.field]))

    for (const r of stats) {
      decisions[r.d] = (decisions[r.d] ?? 0) + 1

      const c = cycles.get(r.c) ?? { reports: 0, withAverage: 0, total: 0 }
      c.reports += 1
      if (typeof r.a === 'number') {
        c.withAverage += 1
        c.total += r.a
      }
      cycles.set(r.c, c)

      byUni[r.u] = (byUni[r.u] ?? 0) + 1
      const field = programName.get(r.p)
      if (field) byField[field] = (byField[field] ?? 0) + 1
    }

    const uniName = new Map((data?.universities ?? []).map((u) => [u.id, u.name]))
    const offerShare = Math.round(((decisions.offer ?? 0) / stats.length) * 100)

    return {
      total: stats.length,
      offerShare,
      // Same function the program pages use, so the labels, the ordering and
      // the "shares of reports, never a rate" rule are defined once.
      slices: decisionMix(decisions),
      cycles: [...cycles.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map<Cycle>(([cycle, c]) => ({
          cycle,
          reports: c.reports,
          withAverage: c.withAverage,
          mean: c.withAverage ? c.total / c.withAverage : null,
        })),
      topUniversities: Object.entries(byUni)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([id, n]) => ({ name: uniName.get(id) ?? id, n })),
      topFields: Object.entries(byField)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id, n]) => ({ name: FIELD_LABELS[id] ?? id, n })),
    }
  }, [stats, data])

  return (
    <div className="relative">
      <div className="bg-grid pattern-fade pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <section className="container-page max-w-3xl py-20">
        <Eyebrow>Community stats</Eyebrow>
        <h1 className="mt-2 font-display text-display-1 font-600 text-ink">
          What everyone reported.
        </h1>
        <p className="mt-4 text-lead text-slate">
          Every number on this site is built from these reports. So is every caveat — this page is
          the reason we will not tell you your chances.
        </p>

        {!summary ? (
          <div className="mt-12">
            <LoadingNote>Loading the reports…</LoadingNote>
            <Skeleton className="h-6 w-64 rounded" />
            <Skeleton className="mt-6 h-48 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <Reveal>
              <h2 className="mt-14 font-display text-display-3 font-600 text-ink">
                {summary.offerShare}% of reports are offers
              </h2>
              <p className="mt-3 leading-relaxed text-slate">
                Out of {summary.total.toLocaleString()} reports. Read that as a success rate and you
                would conclude almost everyone gets in almost everywhere, which is obviously wrong.
                It is what happens when the people who got good news are the ones who come back to
                share it.
              </p>
              <div className="mt-6">
                <DecisionMix slices={summary.slices} />
              </div>
              <p className="mt-4 rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-ink">
                <strong className="font-600">This is not an acceptance rate.</strong> It is the
                shape of who answered. The averages elsewhere on the site are still useful —{' '}
                <em>what did admitted students have</em> is a question this data can answer. Whether
                you will be admitted is not.
              </p>
            </Reveal>

            <Reveal>
              <h2 className="mt-14 font-display text-display-3 font-600 text-ink">
                Reporting is growing; the averages are not
              </h2>
              <p className="mt-3 leading-relaxed text-slate">
                Reports per cycle, and the mean average reported in each. The volume grows sharply.
                The averages barely move — which is why there is no trend line here: four cycles of
                a flat number is not a story, and drawing it as one would invent a trend the data
                does not contain.
              </p>
              <ul className="mt-6 space-y-2">
                {summary.cycles.map((c) => {
                  const widest = Math.max(...summary.cycles.map((x) => x.reports))
                  return (
                    <li key={c.cycle} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm text-slate [font-variant-numeric:tabular-nums]">
                        {c.cycle}
                      </span>
                      <span className="h-6 flex-1 overflow-hidden rounded-md bg-surface">
                        <span
                          className="block h-full rounded-md bg-chart/70"
                          style={{ width: `${(c.reports / widest) * 100}%` }}
                        />
                      </span>
                      <span className="w-16 shrink-0 text-right text-sm font-600 text-ink [font-variant-numeric:tabular-nums]">
                        {c.reports.toLocaleString()}
                      </span>
                      <span className="w-20 shrink-0 text-right text-sm text-slate [font-variant-numeric:tabular-nums]">
                        {c.mean ? `${c.mean.toFixed(1)}%` : '—'}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 text-xs text-slate">
                Left to right: cycle, reports, mean average reported.
              </p>
            </Reveal>

            <Reveal>
              <h2 className="mt-14 font-display text-display-3 font-600 text-ink">
                Where the reports come from
              </h2>
              <p className="mt-3 leading-relaxed text-slate">
                Coverage is uneven, and that matters when you read a median: a number from 200
                reports is a different thing to one from six.
              </p>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <Ranked title="Most-reported universities" rows={summary.topUniversities} />
                <Ranked title="Most-reported fields" rows={summary.topFields} />
              </div>
            </Reveal>

            <Reveal>
              <p className="mt-14 rounded-lg border border-line bg-surface p-5 leading-relaxed text-slate">
                How the data is collected, and what else it cannot tell you, is written up on the{' '}
                <Link to="/about" className="text-brand-600 hover:text-brand-700">
                  methodology page
                </Link>
                .
              </p>
            </Reveal>
          </>
        )}
      </section>
    </div>
  )
}

function Ranked({ title, rows }: { title: string; rows: Array<{ name: string; n: number }> }) {
  const widest = Math.max(...rows.map((r) => r.n), 1)
  return (
    <div>
      <h3 className="text-sm font-600 uppercase tracking-wider text-slate">{title}</h3>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-ink">{r.name}</span>
              <span className="shrink-0 text-xs text-slate [font-variant-numeric:tabular-nums]">
                {r.n.toLocaleString()}
              </span>
            </div>
            <span className="mt-1 block h-1 rounded-full bg-surface">
              <span
                className="block h-full rounded-full bg-chart/60"
                style={{ width: `${(r.n / widest) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
