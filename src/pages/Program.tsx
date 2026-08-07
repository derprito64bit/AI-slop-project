import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Eyebrow from '../components/ui/Eyebrow'
import Tag from '../components/ui/Tag'
import Button from '../components/ui/Button'
import UniversityMark from '../components/UniversityMark'
import AverageDistribution from '../components/AverageDistribution'
import { loadPrograms, loadUniversities, loadStats } from '../lib/dataSource'
import { findProgram, similarPrograms, difficultyBand, DIFFICULTY_LABELS } from '../lib/search'
import type { CommunityStat, Program as ProgramType, University } from '../data/types'

const DECISION_LABELS: Record<string, string> = {
  offer: 'Offers',
  rejected: 'Rejections',
  waitlisted: 'Waitlisted',
  deferred: 'Deferred',
}

export default function Program() {
  const { universityId = '', slug = '' } = useParams()
  const [data, setData] = useState<{
    programs: ProgramType[]
    universities: University[]
    stats: CommunityStat[]
  } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([loadPrograms(), loadUniversities(), loadStats()])
      .then(([programs, universities, stats]) => setData({ programs, universities, stats }))
      .catch(() => setError(true))
  }, [])

  if (error) {
    return (
      <Shell>
        <p className="text-slate">Couldn’t load program data. Try refreshing.</p>
      </Shell>
    )
  }
  if (!data) {
    return (
      <Shell>
        <p className="text-slate">Loading…</p>
      </Shell>
    )
  }

  const program = findProgram(data.programs, universityId, slug)
  if (!program) {
    return (
      <Shell>
        <h1 className="font-display text-display-2 font-600 text-ink">Program not found</h1>
        <p className="mt-3 max-w-md text-slate">
          We don’t have a program at that address. It may have been renamed as the data was
          cleaned up.
        </p>
        <Button to="/explore" className="mt-6">
          Browse all programs
        </Button>
      </Shell>
    )
  }

  const uni = data.universities.find((u) => u.id === program.universityId)
  const school = uni?.name ?? program.universityId
  const band = difficultyBand(program)
  const similar = similarPrograms(data.programs, program)

  // Only offers with a reported average feed the distribution.
  const offerAverages = data.stats
    .filter((s) => s.p === program.id && s.d === 'offer' && s.a !== null)
    .map((s) => s.a as number)

  const cycleRange =
    program.cycles.length > 1
      ? `${program.cycles[0]} to ${program.cycles[program.cycles.length - 1]}`
      : program.cycles[0]

  return (
    <Shell>
      <Link to="/explore" className="text-sm font-600 text-brand-600 hover:text-brand-700">
        ← All programs
      </Link>

      {/* ---------- header ---------- */}
      <header className="mt-5 flex flex-wrap items-start gap-5">
        <UniversityMark id={program.universityId} name={school} size={72} />
        <div className="min-w-0 flex-1">
          <Eyebrow>{school}{uni?.city ? ` · ${uni.city}` : ''}</Eyebrow>
          <h1 className="mt-1.5 font-display text-display-2 font-600 text-ink">{program.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {band && (
              <Tag tone={band === 'highly-competitive' ? 'reach' : band === 'competitive' ? 'safety' : 'likely'}>
                {DIFFICULTY_LABELS[band]}
              </Tag>
            )}
            <Tag>{program.field.replace(/-/g, ' ')}</Tag>
          </div>
        </div>
      </header>

      {program.insufficientData ? (
        /* ---------- not enough data ---------- */
        <section className="mt-10 rounded-xl border border-line bg-surface p-6">
          <h2 className="font-600 text-ink">Not enough data yet</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate">
            Only {program.totalReports} student{program.totalReports === 1 ? ' has' : 's have'}{' '}
            reported on this program so far — too few to describe a typical accepted average
            without being misleading. We show a range once at least five students have reported
            an offer.
          </p>
          <Link
            to="/community"
            className="mt-4 inline-block text-sm font-600 text-brand-600 hover:text-brand-700"
          >
            Applied here? Add your result →
          </Link>
        </section>
      ) : (
        <>
          {/* ---------- headline stat + distribution ---------- */}
          <section className="mt-10">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-display-1 font-600 leading-none text-brand-600">
                {program.accepted!.median}%
              </span>
              <span className="text-slate">
                median of {program.sampleSize} reported offers
              </span>
            </div>

            <AverageDistribution
              values={offerAverages}
              median={program.accepted!.median}
              p25={program.accepted!.p25}
              p75={program.accepted!.p75}
            />
          </section>

          {/* ---------- range readout ---------- */}
          <section className="mt-10">
            <h2 className="font-display text-display-3 font-600 text-ink">The range</h2>
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
              {(
                [
                  ['Lowest', program.accepted!.min],
                  ['25th pct', program.accepted!.p25],
                  ['Median', program.accepted!.median],
                  ['75th pct', program.accepted!.p75],
                  ['Highest', program.accepted!.max],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="bg-paper p-4">
                  <dt className="text-xs uppercase tracking-wider text-slate">{label}</dt>
                  <dd className="mt-1 font-display text-xl font-600 text-ink [font-variant-numeric:tabular-nums]">
                    {value}%
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-slate">
              Half of reported offers sat between {program.accepted!.p25}% and{' '}
              {program.accepted!.p75}%.
            </p>
          </section>
        </>
      )}

      {/* ---------- outcomes ---------- */}
      <section className="mt-12">
        <h2 className="font-display text-display-3 font-600 text-ink">What students reported</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(['offer', 'rejected', 'waitlisted', 'deferred'] as const).map((k) => (
            <div key={k} className="rounded-xl border border-line bg-paper p-4">
              <dt className="text-xs uppercase tracking-wider text-slate">{DECISION_LABELS[k]}</dt>
              <dd className="mt-1 font-display text-2xl font-600 text-ink [font-variant-numeric:tabular-nums]">
                {program.counts[k]}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-2xl rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-slate">
          <strong className="font-600 text-ink">This is not an acceptance rate.</strong> Students
          who get in are far more likely to report than students who don’t, so offers are heavily
          over-represented here. Use the averages above to see what admitted students had — not to
          estimate your chances.
        </p>
      </section>

      {/* ---------- coverage ---------- */}
      <section className="mt-12">
        <h2 className="font-display text-display-3 font-600 text-ink">Where this comes from</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate">
          {program.totalReports} student report{program.totalReports === 1 ? '' : 's'} covering{' '}
          {cycleRange}, submitted to community spreadsheets and reviewed before publishing. Reports
          are anonymous — we never store who submitted them.
        </p>
      </section>

      {/* ---------- similar ---------- */}
      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-display-3 font-600 text-ink">Similar programs</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((p) => {
              const u = data.universities.find((x) => x.id === p.universityId)
              return (
                <li key={p.id}>
                  <Link
                    to={`/program/${p.universityId}/${p.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-line bg-paper p-3 transition-shadow hover:shadow-[0_8px_24px_rgba(20,24,31,0.07)]"
                  >
                    <UniversityMark id={p.universityId} name={u?.name ?? p.universityId} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-600 text-ink">{p.name}</span>
                      <span className="block truncate text-xs text-slate">{u?.name}</span>
                    </span>
                    <span className="shrink-0 font-display text-sm font-600 text-brand-600 [font-variant-numeric:tabular-nums]">
                      {p.accepted?.median}%
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="bg-grid pattern-fade pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <section className="container-page py-16">{children}</section>
    </div>
  )
}
