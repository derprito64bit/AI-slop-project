import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import Eyebrow from '../components/ui/Eyebrow'
import Tag from '../components/ui/Tag'
import Button from '../components/ui/Button'
import Tabs from '../components/Tabs'
import UniversityMark from '../components/UniversityMark'
import KeepButton from '../components/KeepButton'
import Reveal from '../components/Reveal'
import AverageDistribution from '../components/AverageDistribution'
import { loadProfile } from '../lib/profile'
import { DURATION, EASE } from '../lib/motion'
import { ProgramPageSkeleton, LoadingNote } from '../components/Skeleton'
import DecisionMix from '../components/DecisionMix'
import OutcomeCompare from '../components/OutcomeCompare'
import CycleTrend from '../components/CycleTrend'
import {
  averagesFor,
  summarise,
  medianByCycle,
  decisionMix,
  type Summary,
  type CyclePoint,
  type DecisionSlice,
} from '../lib/analytics'
import { loadPrograms, loadUniversities, loadStats, loadUniversityContent } from '../lib/dataSource'
import { findProgram, similarPrograms, difficultyBand, DIFFICULTY_LABELS } from '../lib/search'
import { getProgramInfo, getUniversityInfo, type ProgramInfo, type Source } from '../data/program-info'
import type { UniversityContent } from '../lib/api'
import type { CommunityStat, Program as ProgramType, University } from '../data/types'

export default function Program() {
  const { universityId = '', slug = '' } = useParams()
  const [data, setData] = useState<{
    programs: ProgramType[]
    universities: University[]
    stats: CommunityStat[]
  } | null>(null)
  const [error, setError] = useState(false)
  // Editable prose about the school, if the server had any and was awake.
  // Deliberately a SEPARATE state and a separate await from the dataset above:
  // this comes from a free-tier service that is asleep most of the time, and
  // the program page must not wait on it or fail with it. It arrives late or
  // never, and either is fine.
  const [content, setContent] = useState<Record<string, UniversityContent>>({})

  useEffect(() => {
    Promise.all([loadPrograms(), loadUniversities(), loadStats()])
      .then(([programs, universities, stats]) => setData({ programs, universities, stats }))
      .catch(() => setError(true))
    loadUniversityContent().then(setContent)
  }, [])

  // These sit above the early returns so the hook order never changes between
  // renders. Both are memoised: offerAverages scans all 10,372 stat records,
  // and without this it re-ran on every render — including each tab switch.
  const program = useMemo(
    () => (data ? findProgram(data.programs, universityId, slug) : null),
    [data, universityId, slug],
  )

  const offerAverages = useMemo(
    () => (data && program ? averagesFor(data.stats, program.id, 'offer') : []),
    [data, program],
  )

  // Offers vs rejections, only where both groups clear MIN_GROUP. Just 22 of
  // 2,436 programs have five or more reported rejection averages, so this is
  // absent on most pages by design rather than rendered thin.
  const outcome = useMemo(() => {
    if (!data || !program) return null
    const offers = summarise(offerAverages)
    const rejections = summarise(averagesFor(data.stats, program.id, 'rejected'))
    return offers && rejections ? { offers, rejections } : null
  }, [data, program, offerAverages])

  const cyclePoints = useMemo(
    () => (data && program ? medianByCycle(data.stats, program.id) : []),
    [data, program],
  )

  const mix = useMemo(() => (program ? decisionMix(program.counts) : []), [program])

  if (error) {
    return <Shell><p className="text-slate">Couldn’t load program data. Try refreshing.</p></Shell>
  }
  if (!data) {
    // Shaped like the page that replaces it. The bare "Loading…" line measured
    // CLS 0.14 here — the chart panel and the two detail columns all arrived
    // at once and pushed everything below them down.
    return (
      <Shell>
        <LoadingNote>Loading this program…</LoadingNote>
        <ProgramPageSkeleton />
      </Shell>
    )
  }

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

  const cycleRange =
    program.cycles.length > 1
      ? `${program.cycles[0]} to ${program.cycles[program.cycles.length - 1]}`
      : program.cycles[0]

  return (
    <Shell>
      <Link to="/explore" className="text-sm font-600 text-brand-600 hover:text-brand-700">
        ← All programs
      </Link>

      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.reveal, ease: EASE.out }}
        className="mt-5 flex flex-wrap items-start gap-5"
      >
        <UniversityMark id={program.universityId} name={school} size={72} />
        <div className="min-w-0 flex-1">
          <Eyebrow>{school}{uni?.city ? ` · ${uni.city}` : ''}</Eyebrow>
          <h1 className="mt-1.5 font-display text-display-2 font-600 text-ink">{program.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {band && (
              <Tag tone={band === 'highly-competitive' ? 'high' : band === 'competitive' ? 'medium' : 'low'}>
                {DIFFICULTY_LABELS[band]}
              </Tag>
            )}
            <Tag>{program.field.replace(/-/g, ' ')}</Tag>
            <KeepButton programId={program.id} size="md" className="ml-1" />
          </div>
        </div>
      </motion.header>

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
                content={content[program.universityId]}
              />
            ),
          },
          {
            id: 'analytics',
            label: 'Analytics',
            content: (
              <AnalyticsTab
                program={program}
                offerAverages={offerAverages}
                cycleRange={cycleRange}
                outcome={outcome}
                cyclePoints={cyclePoints}
                mix={mix}
              />
            ),
          },
          {
            id: 'requirements',
            label: 'Requirements',
            content: <RequirementsTab program={program} info={info} />,
          },
        ]}
      />

      {similar.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-display-3 font-600 text-ink">Similar programs</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((p, i) => {
              const u = data.universities.find((x) => x.id === p.universityId)
              return (
                <Reveal as="li" key={p.id} delay={i * 0.04}>
                  <Link
                    to={`/program/${p.universityId}/${p.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-line bg-paper p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
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
                </Reveal>
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
  program, school, city, province, info, uniInfo, cycleRange, content,
}: {
  program: ProgramType
  school: string
  city?: string
  province?: string
  info: ProgramInfo | null
  uniInfo: ReturnType<typeof getUniversityInfo>
  cycleRange: string
  /** editable prose from the admin panel, when a person has written some */
  content?: UniversityContent
}) {
  return (
    <>
      {/* WRITTEN BY A PERSON, and labelled as such.
          Everything else on this page is derived — a median, a count, a
          requirement read off an official page with the date attached. This is
          somebody's prose, so it is visually separate and says whose it is. It
          can hold no number: the server's schema has no field for one, which is
          what stops an edit here ever contradicting the dataset.
          Absent for most schools, and that is the ordinary state. */}
      {/* `> 0`, not a bare `.length`. `'' || 0` is `0`, and React renders a
          numeric child as text — so the falsy-length form printed a literal "0"
          above the facts table for any school whose record has a blurb and
          nothing else. That is not a contrived state: the blurb is the first
          field in the admin form and the only one the map uses. */}
      {content && (content.description !== '' || content.links.length > 0) && (
        <section className="mb-6 rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-600 uppercase tracking-wider text-slate">About {school}</h2>
          {content.description && (
            <p className="mt-2 whitespace-pre-line leading-relaxed text-slate">
              {content.description}
            </p>
          )}
          {content.links.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {content.links.map((l) => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand-600 underline underline-offset-2 hover:text-brand-700"
                  >
                    {l.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
  program, offerAverages, cycleRange, outcome, cyclePoints, mix,
}: {
  program: ProgramType
  offerAverages: number[]
  cycleRange: string
  outcome: { offers: Summary; rejections: Summary } | null
  cyclePoints: CyclePoint[]
  mix: DecisionSlice[]
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
        <Link to="/profile/database" className="mt-4 inline-block text-sm font-600 text-brand-600 hover:text-brand-700">
          How the reporting works →
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

      {/* The student's own average, if they have given one. Read from storage
          rather than passed down: this page is reachable without a profile, and
          the chart is unchanged when there is nothing to mark. */}
      <AverageDistribution
        values={offerAverages}
        median={a.median}
        p25={a.p25}
        p75={a.p75}
        you={loadProfile()?.answers?.average ?? null}
      />

      <Reveal delay={0.05}>
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
      </Reveal>

      {cyclePoints.length >= 2 && (
        <Reveal delay={0.1}>
          <h3 className="mt-10 font-display text-display-3 font-600 text-ink">By admission cycle</h3>
          <CycleTrend points={cyclePoints} />
        </Reveal>
      )}

      {outcome && (
        <Reveal delay={0.15}>
          <h3 className="mt-10 font-display text-display-3 font-600 text-ink">
            Offers vs rejections
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-slate">
            What each group reported as their average. Shown only where at least five students
            reported a rejection average — for most programs there are too few to say anything.
          </p>
          <OutcomeCompare offers={outcome.offers} rejections={outcome.rejections} />
        </Reveal>
      )}

      <Reveal delay={0.2}>
      <h3 className="mt-10 font-display text-display-3 font-600 text-ink">What students reported</h3>
      <DecisionMix slices={mix} />
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
      </Reveal>
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
