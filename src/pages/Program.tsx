import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Eyebrow from '../components/ui/Eyebrow'
import Tag from '../components/ui/Tag'
import Button from '../components/ui/Button'
import Tabs from '../components/Tabs'
import UniversityMark from '../components/UniversityMark'
import AverageDistribution from '../components/AverageDistribution'
import { loadPrograms, loadUniversities, loadStats } from '../lib/dataSource'
import { findProgram, similarPrograms, difficultyBand, DIFFICULTY_LABELS } from '../lib/search'
import { getProgramInfo, getUniversityInfo, type ProgramInfo, type Source } from '../data/program-info'
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
    return <Shell><p className="text-slate">Couldn’t load program data. Try refreshing.</p></Shell>
  }
  if (!data) {
    return <Shell><p className="text-slate">Loading…</p></Shell>
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
        <Button to="/explore" className="mt-6">Browse all programs</Button>
      </Shell>
    )
  }

  const uni = data.universities.find((u) => u.id === program.universityId)
  const school = uni?.name ?? program.universityId
  const band = difficultyBand(program)
  const similar = similarPrograms(data.programs, program)
  const info = getProgramInfo(program.id)
  const uniInfo = getUniversityInfo(program.universityId)

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

      <Tabs
        className="mt-10"
        tabs={[
          {
            id: 'general',
            label: 'General',
            content: (
              <GeneralTab
                program={program}
                school={school}
                city={uni?.city}
                province={uni?.province}
                info={info}
                uniInfo={uniInfo}
                cycleRange={cycleRange}
              />
            ),
          },
          {
            id: 'analytics',
            label: 'Analytics',
            content: (
              <AnalyticsTab program={program} offerAverages={offerAverages} cycleRange={cycleRange} />
            ),
          },
          {
            id: 'requirements',
            label: 'Requirements',
            content: <RequirementsTab program={program} info={info} />,
          },
          { id: 'extras', label: 'Extras', content: <ExtrasTab /> },
        ]}
      />

      {similar.length > 0 && (
        <section className="mt-14">
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

/* ------------------------------------------------------------------ tabs */

function GeneralTab({
  program, school, city, province, info, uniInfo, cycleRange,
}: {
  program: ProgramType
  school: string
  city?: string
  province?: string
  info: ProgramInfo | null
  uniInfo: ReturnType<typeof getUniversityInfo>
  cycleRange: string
}) {
  return (
    <>
      <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="University" value={school} />
        <Fact label="Location" value={city ? `${city}${province ? `, ${province}` : ''}` : undefined} />
        <Fact label="Field" value={program.field.replace(/-/g, ' ')} />
        <Fact label="Length" value={info?.lengthYears} />
        <Fact label="Co-op" value={info?.coop} />
        <Fact label="Tuition" value={uniInfo?.tuition ? `${uniInfo.tuition.summary} (${uniInfo.tuition.year})` : undefined} />
        <Fact label="Campuses" value={uniInfo?.campuses?.join(', ')} />
        <Fact label="Admissions contact" value={uniInfo?.admissionsEmail ?? uniInfo?.admissionsPhone} />
        <Fact label="Student reports" value={`${program.totalReports}, covering ${cycleRange}`} />
      </dl>

      {info?.notes?.length ? (
        <ul className="mt-6 space-y-2">
          {info.notes.map((n) => (
            <li key={n} className="text-sm leading-relaxed text-slate">— {n}</li>
          ))}
        </ul>
      ) : null}

      <Provenance sources={[...(info?.sources ?? []), ...(uniInfo?.sources ?? [])]} verified={info?.verified ?? uniInfo?.verified} />
    </>
  )
}

function AnalyticsTab({
  program, offerAverages, cycleRange,
}: {
  program: ProgramType
  offerAverages: number[]
  cycleRange: string
}) {
  if (program.insufficientData) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6">
        <h2 className="font-600 text-ink">Not enough data yet</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate">
          Only {program.totalReports} student{program.totalReports === 1 ? ' has' : 's have'}{' '}
          reported on this program so far — too few to describe a typical accepted average
          without being misleading. We show a range once at least five students have reported
          an offer.
        </p>
        <Link to="/community" className="mt-4 inline-block text-sm font-600 text-brand-600 hover:text-brand-700">
          Applied here? Add your result →
        </Link>
      </div>
    )
  }

  const a = program.accepted!
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-display-1 font-600 leading-none text-brand-600">{a.median}%</span>
        <span className="text-slate">median of {program.sampleSize} reported offers</span>
      </div>

      <AverageDistribution values={offerAverages} median={a.median} p25={a.p25} p75={a.p75} />

      <h3 className="mt-10 font-display text-display-3 font-600 text-ink">The range</h3>
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
        {([['Lowest', a.min], ['25th pct', a.p25], ['Median', a.median], ['75th pct', a.p75], ['Highest', a.max]] as const).map(
          ([label, value]) => (
            <div key={label} className="bg-paper p-4">
              <dt className="text-xs uppercase tracking-wider text-slate">{label}</dt>
              <dd className="mt-1 font-display text-xl font-600 text-ink [font-variant-numeric:tabular-nums]">{value}%</dd>
            </div>
          ),
        )}
      </dl>
      <p className="mt-3 text-sm text-slate">
        Half of reported offers sat between {a.p25}% and {a.p75}%.
      </p>

      <h3 className="mt-10 font-display text-display-3 font-600 text-ink">What students reported</h3>
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
        <strong className="font-600 text-ink">This is not an acceptance rate.</strong> Students who
        get in are far more likely to report than students who don’t, so offers are heavily
        over-represented here. Use the averages above to see what admitted students had — not to
        estimate your chances.
      </p>
      <p className="mt-4 text-sm text-slate">
        Based on {program.totalReports} anonymous student report
        {program.totalReports === 1 ? '' : 's'} covering {cycleRange}.
      </p>
    </>
  )
}

function RequirementsTab({ program, info }: { program: ProgramType; info: ProgramInfo | null }) {
  if (!info?.requiredCourses?.length) {
    return (
      <Unverified
        what="course requirements"
        detail={`We haven’t verified the required courses for ${program.name} against the university’s official pages yet. Rather than guess, we’re leaving this blank — check the university’s own admissions page in the meantime.`}
      />
    )
  }

  return (
    <>
      <h2 className="font-display text-display-3 font-600 text-ink">Required Grade 12 courses</h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {info.requiredCourses.map((c) => (
          <li key={c} className="flex items-center gap-2.5 rounded-lg border border-line bg-paper px-4 py-3">
            <span className="text-success" aria-hidden="true">✓</span>
            <span className="text-sm font-600 text-ink">{c}</span>
          </li>
        ))}
      </ul>

      {info.recommendedCourses?.length ? (
        <>
          <h3 className="mt-8 text-sm font-600 uppercase tracking-wider text-slate">
            Recommended, not required
          </h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {info.recommendedCourses.map((c) => (
              <li key={c} className="flex items-center gap-2.5 rounded-lg border border-dashed border-line px-4 py-3">
                <span className="text-slate" aria-hidden="true">+</span>
                <span className="text-sm text-ink">{c}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <dl className="mt-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
        <Fact label="Minimum grade" value={info.minCourseGrade} />
        <Fact label="Stated admission range" value={info.statedAverage} />
        <Fact label="Supplementary application" value={info.supplementary} />
        <Fact label="Length" value={info.lengthYears} />
      </dl>

      {/* Caveats the university itself attaches to these numbers belong beside
          them, not only on the General tab. */}
      {info.notes?.length ? (
        <ul className="mt-6 space-y-2">
          {info.notes.map((n) => (
            <li key={n} className="text-sm leading-relaxed text-slate">— {n}</li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate">
        These are the university’s own stated requirements — separate from the community-reported
        averages under Analytics. Requirements change year to year, so confirm against the
        official page before you apply.
      </p>

      <Provenance sources={info.sources} verified={info.verified} />
    </>
  )
}

function ExtrasTab() {
  return (
    <Unverified
      what="extracurriculars"
      detail="Recommended activities, competitions and supplementary-application tips will live here. We’re holding this back until we can base it on what admitted students actually reported, rather than generic advice."
    />
  )
}

/* --------------------------------------------------------------- pieces */

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="bg-paper p-4">
      <dt className="text-xs uppercase tracking-wider text-slate">{label}</dt>
      <dd className={`mt-1 text-sm ${value ? 'text-ink' : 'text-slate/70'}`}>
        {value ?? 'Not verified yet'}
      </dd>
    </div>
  )
}

function Unverified({ what, detail }: { what: string; detail: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h2 className="font-600 text-ink">No verified {what} yet</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate">{detail}</p>
    </div>
  )
}

/** Sources + the date they were read. Shown wherever researched facts appear. */
function Provenance({ sources, verified }: { sources: Source[]; verified?: string }) {
  if (!sources.length) return null
  const seen = new Set<string>()
  const unique = sources.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
  return (
    <div className="mt-8 border-t border-line pt-4">
      <p className="text-xs uppercase tracking-wider text-slate">
        Sources{verified ? ` · checked ${verified}` : ''}
      </p>
      <ul className="mt-2 space-y-1">
        {unique.map((s) => (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-600 underline underline-offset-2 hover:text-brand-700"
            >
              {s.label} ↗
            </a>
          </li>
        ))}
      </ul>
    </div>
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
