import { Link } from 'react-router-dom'
import UniversityMark from '../../components/UniversityMark'
import Button from '../../components/ui/Button'
import { ListSkeleton } from '../../components/Skeleton'
import { gapFor, type Gap } from '../../lib/courses'
import { getProgramInfo } from '../../data/program-info'
import { FIT_LABELS, balanceOf, type Fit } from '../../lib/profile'
import { useDashboard } from './context'

// The dashboard's front page.
//
// /profile used to redirect straight to My list, which meant the answer to
// "where am I with all this?" was a list of cards and nothing else. This is the
// broad view: a few honest numbers, the one thing most worth doing next, and a
// door down into each tool. Nothing here is a new capability — every figure is
// computed by something already tested, and every card links to the tool that
// owns it.
//
// It also has to read properly for a student who has skipped everything. The
// empty states are not decoration; skipping is a supported path, and this is
// the page that has to make sense of it.

const ORDER: Fit[] = ['ambitious', 'in-range', 'comfortable']

/**
 * What is outstanding, in words.
 *
 * A gap can be named courses, an unmet choice group ("two of SCH4U/SPH4U/SBI4U"),
 * or both — `missing` alone would print an empty sentence for a program whose
 * only shortfall is a choice.
 */
function gapPhrase(gap: Gap): string {
  const bits = [...gap.missing]
  for (const c of gap.choices) bits.push(`${c.count} of ${c.codes.join(' / ')}`)
  return bits.join(', ')
}

export default function OverviewView() {
  const { profile, data, kept, average, compare, gapCount, uniName } = useDashboard()

  const counts = average !== null ? balanceOf(average, kept) : null
  const total = counts ? ORDER.reduce((n, k) => n + counts[k], 0) : 0

  // The most useful sentence on the page: the next prerequisite that is not
  // ticked off. One, not a list — the list lives in Courses.
  const nextGap = kept
    .map((p) => ({ program: p, gap: gapFor(getProgramInfo(p.id)?.requiredCourses, profile.courses) }))
    .find((x) => x.gap && !x.gap.satisfied)

  const recent = [...kept].reverse().slice(0, 4)

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-display-2 font-600 text-ink">Your dashboard</h1>
        <p className="mt-2 max-w-2xl text-slate">
          Everything you&rsquo;ve kept, checked and compared — and what&rsquo;s worth doing next.
        </p>
      </header>

      {/* ------------------------------------------------------- numbers --- */}
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Programs kept" value={kept.length} to="/profile/list" />
        <Stat
          label="Courses ticked"
          value={profile.courses.length}
          to="/profile/courses"
          note={gapCount ? `${gapCount} with a gap` : undefined}
        />
        <Stat label="Staged to compare" value={compare.length} to="/profile/compare" />
        <Stat
          label="Your average"
          value={average !== null ? `${average}%` : '—'}
          to="/survey"
          note={average === null ? 'not given' : undefined}
        />
      </dl>

      {/* ----------------------------------------------------- next step --- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-paper p-5">
          <h2 className="font-600 text-ink">Worth doing next</h2>
          {!profile.answers ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                You haven&rsquo;t answered the four questions. They only narrow what you get shown
                — every one is skippable, and your average never leaves this device.
              </p>
              <Button to="/survey" className="mt-4">
                Answer four questions
              </Button>
            </>
          ) : kept.length === 0 ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                Nothing kept yet. Open a program and press Keep — the rest of this dashboard is
                built out of that list.
              </p>
              <Button to="/profile/programs" className="mt-4">
                Browse programs
              </Button>
            </>
          ) : nextGap ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                <Link
                  to={`/program/${nextGap.program.universityId}/${nextGap.program.slug}`}
                  className="font-600 text-ink hover:text-brand-600"
                >
                  {nextGap.program.name}
                </Link>{' '}
                needs {gapPhrase(nextGap.gap!)}, which you haven&rsquo;t ticked off.
              </p>
              <Link
                to="/profile/courses"
                className="mt-4 inline-block text-sm font-600 text-brand-600 hover:text-brand-700"
              >
                Check my courses →
              </Link>
            </>
          ) : average === null ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                Your list is taking shape. Adding your average turns it into a balance check —
                which of these sit above, near and below what admitted students reported.
              </p>
              <Button to="/survey" className="mt-4">
                Add my average
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                Prerequisites all ticked off for what you&rsquo;ve kept. Compare the ones
                you&rsquo;re torn between, side by side.
              </p>
              <Link
                to="/profile/compare"
                className="mt-4 inline-block text-sm font-600 text-brand-600 hover:text-brand-700"
              >
                Compare programs →
              </Link>
            </>
          )}
        </section>

        {/* ------------------------------------------------------ balance --- */}
        <section className="rounded-xl border border-line bg-paper p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-600 text-ink">Balance</h2>
            <Link to="/profile/balance" className="text-sm text-brand-600 hover:text-brand-700">
              Open
            </Link>
          </div>
          {counts && total > 0 ? (
            <>
              <ul className="mt-4 space-y-2">
                {ORDER.map((k) => (
                  <li key={k} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm text-slate">{FIT_LABELS[k].label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                      <span
                        className="block h-full rounded-full bg-brand-500"
                        style={{ width: `${(counts[k] / total) * 100}%` }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right text-sm font-600 text-ink [font-variant-numeric:tabular-nums]">
                      {counts[k]}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-slate">
                Against the median average admitted students reported — not a chance of admission.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-slate">
              {average === null
                ? 'Needs your average to compare your list against.'
                : 'Keep a few programs and this shows the shape of your list.'}
            </p>
          )}
        </section>
      </div>

      {/* ------------------------------------------------------ recently --- */}
      <section className="mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-display-3 font-600 text-ink">Recently kept</h2>
          {kept.length > recent.length && (
            <Link to="/profile/list" className="text-sm text-brand-600 hover:text-brand-700">
              See all {kept.length}
            </Link>
          )}
        </div>

        {!data ? (
          <div className="mt-4">
            <ListSkeleton rows={2} />
          </div>
        ) : recent.length === 0 ? (
          <p className="mt-2 text-sm text-slate">
            Nothing yet — programs you keep show up here in the order you kept them.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {recent.map((p) => (
              <li
                key={p.id}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-paper p-3"
              >
                <UniversityMark
                  id={p.universityId}
                  name={uniName.get(p.universityId) ?? p.universityId}
                  size={32}
                />
                <Link to={`/program/${p.universityId}/${p.slug}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-600 text-ink">{p.name}</span>
                  <span className="block truncate text-xs text-slate">
                    {uniName.get(p.universityId)}
                    {p.accepted ? ` · ${p.accepted.median}% median` : ' · not enough data yet'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

/** One number, and the tool it belongs to. */
function Stat({
  label,
  value,
  to,
  note,
}: {
  label: string
  value: string | number
  to: string
  note?: string
}) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-line bg-paper p-4 transition-colors hover:border-brand-300"
    >
      <dt className="text-sm text-slate">{label}</dt>
      <dd className="mt-1 font-display text-3xl font-600 text-ink [font-variant-numeric:tabular-nums]">
        {value}
      </dd>
      {note && <p className="mt-1 text-xs text-slate">{note}</p>}
    </Link>
  )
}
