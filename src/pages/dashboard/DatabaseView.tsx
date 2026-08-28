import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DecisionMix from '../../components/DecisionMix'
import { Skeleton, FetchingNote } from '../../components/Skeleton'
import { loadStats } from '../../lib/dataSource'
import { decisionMix } from '../../lib/analytics'
import { FIELD_LABELS } from '../../lib/profile'
import { PROGRAM_INFO } from '../../data/program-info'
import SUMMARY from '../../data/generated/summary.json'
import { useDashboard } from './context'
import type { CommunityStat } from '../../data/types'

// The data itself: where these numbers come from, and what they cannot tell you.
//
// This is the old /about and /community pages merged into one dashboard tool.
// Both were in the top navbar as if they were destinations, and `Global posts`
// duplicated the community idea with mock content — three surfaces for one
// subject, none of which a student went looking for.
//
// Merging them is not just tidying. The two pages were arguing the same point
// from opposite ends: About said "we never tell you your chances" and Community
// showed the 93% offer share that is the *reason*. Split across two URLs, the
// claim and its evidence never appeared together.
//
// EVERY FIGURE IS READ FROM THE DATASET AT RENDER TIME. None is typed by hand.
// That rule is not stylistic — the home page once claimed "120+ programs"
// against a real 2,436, and a page about the integrity of the data cannot
// misstate its own coverage.

/** Programs with hand-researched, cited requirements — counted, not asserted. */
const VERIFIED_PROGRAMS = Object.keys(PROGRAM_INFO).length

type Cycle = { cycle: string; reports: number; withAverage: number; mean: number | null }

export default function DatabaseView() {
  const { data } = useDashboard()
  const [stats, setStats] = useState<CommunityStat[] | null>(null)

  useEffect(() => {
    loadStats().then(setStats).catch(() => {})
  }, [])

  const summary = useMemo(() => {
    if (!stats) return null

    const decisions: Record<string, number> = {}
    const cycles = new Map<string, { reports: number; withAverage: number; total: number }>()
    const byUni: Record<string, number> = {}
    const byField: Record<string, number> = {}
    const programField = new Map((data?.programs ?? []).map((p) => [p.id, p.field]))

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
      const field = programField.get(r.p)
      if (field) byField[field] = (byField[field] ?? 0) + 1
    }

    const uniName = new Map((data?.universities ?? []).map((u) => [u.id, u.name]))

    return {
      total: stats.length,
      offerShare: Math.round(((decisions.offer ?? 0) / stats.length) * 100),
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
    <>
      <header className="mb-8">
        <h1 className="font-display text-display-2 font-600 text-ink">The data</h1>
        <p className="mt-2 max-w-2xl text-slate">
          Where every number on this site comes from, what it is built out of, and the things it
          cannot tell you however much you would like it to.
        </p>
      </header>

      {/* --------------------------------------------------- what it is --- */}
      <section className="rounded-xl border border-line bg-paper p-6">
        <h2 className="font-600 text-ink">What the data is</h2>
        <p className="mt-3 leading-relaxed text-slate">
          {/* No typed cycle count here: summary.json carries no cycle total and
              stats.json gains one every year. The exact number is stated in the
              cycles section below, where it is computed. */}
          {SUMMARY.reports.toLocaleString()} anonymous reports from students across every
          application cycle we hold, covering {SUMMARY.programs.toLocaleString()} programs at{' '}
          {SUMMARY.universities} universities. Each record is one student saying what they applied
          to, what they heard back, and — usually — the average they applied with.
        </p>
        <p className="mt-3 leading-relaxed text-slate">
          The reports are collected and moderated by the team, cleaned by a build script, and
          published as static files. Nothing here is generated, estimated or inferred: if a number
          is on screen, some student wrote it down.
        </p>
      </section>

      {/* ---------------------------------------------------- the bias --- */}
      {!summary ? (
        <div className="mt-6">
          <FetchingNote>Loading the reports…</FetchingNote>
          <Skeleton className="mt-4 h-48 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-xl border border-line bg-paper p-6">
            <h2 className="font-display text-display-3 font-600 text-ink">
              {summary.offerShare}% of reports are offers
            </h2>
            <p className="mt-3 leading-relaxed text-slate">
              Out of {summary.total.toLocaleString()} reports. Read that as a success rate and you
              would conclude almost everyone gets in almost everywhere, which is obviously wrong. It
              is what happens when the people who got good news are the ones who come back to share
              it.
            </p>
            <div className="mt-6">
              <DecisionMix slices={summary.slices} />
            </div>
            <p className="mt-4 rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-ink">
              <strong className="font-600">This is not an acceptance rate.</strong> It is the shape
              of who answered. The averages elsewhere on the site are still useful —{' '}
              <em>what did admitted students have</em> is a question this data can answer. Whether
              you will be admitted is not.
            </p>
          </section>

          {/* -------------------------------------------------- cycles --- */}
          <section className="mt-6 rounded-xl border border-line bg-paper p-6">
            <h2 className="font-display text-display-3 font-600 text-ink">
              Reporting is growing; the averages are not
            </h2>
            <p className="mt-3 leading-relaxed text-slate">
              Reports per cycle, and the mean average reported in each. The volume grows sharply.
              The averages barely move — which is why there is no trend line here:{' '}
              {summary.cycles.length} cycles of a flat number is not a story, and drawing it as one
              would invent a trend the data does not contain.
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
          </section>

          {/* ------------------------------------------------- coverage --- */}
          <section className="mt-6 rounded-xl border border-line bg-paper p-6">
            <h2 className="font-display text-display-3 font-600 text-ink">
              Where the reports come from
            </h2>
            <p className="mt-3 leading-relaxed text-slate">
              Coverage is uneven, and that matters when you read a median: a number from 200 reports
              is a different thing to one from six.
            </p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <Ranked title="Most-reported universities" rows={summary.topUniversities} />
              <Ranked title="Most-reported fields" rows={summary.topFields} />
            </div>
          </section>
        </>
      )}

      {/* ------------------------------------------------------- rules --- */}
      <h2 className="mt-12 font-display text-display-3 font-600 text-ink">
        Two rules we do not bend
      </h2>

      <div className="mt-5 rounded-xl border border-line bg-paper p-6">
        <h3 className="font-600 text-ink">1. We never tell you your chances.</h3>
        <p className="mt-2 leading-relaxed text-slate">
          {/* Was "Around 93%", typed by hand, in the file whose own banner says
              every figure is read from the dataset at render time. It had
              already drifted — the real share is 92.6%. Not interpolated
              unconditionally because `summary` is null until stats.json
              resolves, and this section sits outside that gate. */}
          {summary
            ? `${summary.offerShare}% of the reports we hold are offers.`
            : 'The overwhelming majority of the reports we hold are offers.'}{' '}
          That is not because almost everyone gets in — it is because students who get in are far
          more likely to come back and say so. Any
          &ldquo;acceptance rate&rdquo; calculated from this data would be measuring who answers a
          survey, and dressing it up as a probability. The chart above is that bias, drawn.
        </p>
        <p className="mt-3 leading-relaxed text-slate">
          What the data does support is the distribution of averages admitted students reported: a
          median, a spread, and how many people it came from.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-paper p-6">
        <h3 className="font-600 text-ink">2. We never publish personal data.</h3>
        <p className="mt-2 leading-relaxed text-slate">
          The audience here is mostly under 18. One of the source spreadsheets contains a username
          column; the build script has never read it, and the published records carry outcome fields
          only — no names, no schools, no ages.
        </p>
        <p className="mt-3 leading-relaxed text-slate">
          {/* Led with "live in your browser" flatly, which is the sentence a
              skimmer takes away and is not true once signed in — the exact
              average included. The account clause now comes first so the
              stronger claim is never the standalone one. */}
          The same applies to you. Signed out, your answers, your list and your notes stay in this
          browser; an account stores them so they follow you to another device, and asks for a
          username and a password and nothing else.{' '}
          <Link to="/profile/account" className="text-brand-600 hover:text-brand-700">
            Your account page
          </Link>{' '}
          says exactly what is held.
        </p>
      </div>

      {/* -------------------------------------------------- research --- */}
      <h2 className="mt-12 font-display text-display-3 font-600 text-ink">
        How requirements get researched
      </h2>
      <p className="mt-3 leading-relaxed text-slate">
        Course requirements are read off the university&rsquo;s own admissions pages, one program at
        a time, and recorded with a link and the date they were checked. You can see both on any
        program page that has them.
      </p>
      <p className="mt-3 leading-relaxed text-slate">
        <strong className="font-600 text-ink">Never from a search result.</strong> Two summaries
        were caught contradicting the official page outright — one claimed McMaster Engineering
        wanted Calculus &amp; Vectors plus two sciences at 90%, where the page says English,
        Calculus &amp; Vectors, Chemistry and Physics at 87%+; another claimed York Engineering
        accepted Chemistry <em>or</em> Physics, where Lassonde asks for both. Both discrepancies are
        recorded in the source so nobody &ldquo;corrects&rdquo; them back.
      </p>

      {/* ---------------------------------------------------- limits --- */}
      <h2 className="mt-12 font-display text-display-3 font-600 text-ink">
        What this site cannot tell you
      </h2>
      <ul className="mt-4 space-y-3">
        <Limit
          stat={`${SUMMARY.programsWithCharts} of ${SUMMARY.programs.toLocaleString()}`}
          label="programs have enough reports to chart"
          detail="The rest are real programs that nobody has reported on yet. They say so rather than showing an average built from three people."
        />
        <Limit
          stat={`${VERIFIED_PROGRAMS} programs`}
          label="have verified course requirements"
          detail="Concentrated in the most-reported programs, which is what a shortlist tends to surface. Everywhere else the requirements tab is honest about being empty."
        />
        <Limit
          stat="No deadlines"
          label="are published here"
          detail="They change between cycles and a wrong one could cost you a year. Track lets you record the dates you find, with a link back to the page you read them on."
        />
      </ul>

      <p className="mt-8 rounded-lg border border-line bg-surface p-5 leading-relaxed text-slate">
        Found something wrong? That is worth more to us than anything else — a number that
        contradicts an official page is a bug, and it gets fixed with a citation.
      </p>
    </>
  )
}

/** One measure, ranked, with a bar for the shape and the count for the value. */
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

function Limit({ stat, label, detail }: { stat: string; label: string; detail: string }) {
  return (
    <li className="rounded-xl border border-line bg-paper p-5">
      <p className="font-600 text-ink">
        <span className="font-display text-xl [font-variant-numeric:tabular-nums]">{stat}</span>{' '}
        <span className="font-400 text-slate">{label}</span>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate">{detail}</p>
    </li>
  )
}
