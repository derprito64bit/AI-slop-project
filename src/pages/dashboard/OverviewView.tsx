import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import UniversityMark from '../../components/UniversityMark'
import Button from '../../components/ui/Button'
import { KeepControl } from '../../components/KeepButton'
import { FetchingNote, ListSkeleton } from '../../components/Skeleton'
import { FitLegend, ListSpread, StackedBar, type Segment } from '../../components/ListCharts'
import { COURSE_NAMES } from '../../lib/courses'
import { bestNextCourse } from '../../lib/courseNeeds'
import { cycleNote, cycleStanding } from '../../lib/cycles'
import { fieldSummaryFor, summarise } from '../../lib/fields'
import { catalogueTotals, featuredCards, startSteps, type StartStep } from '../../lib/overview'
import {
  FIELD_LABELS,
  FIT_LABELS,
  balanceOf,
  isKept,
  toggleShortlist,
  type Fit,
} from '../../lib/profile'
import { useDashboard } from './context'

// The dashboard's front page.
//
// /profile used to redirect straight to My list, which meant the answer to
// "where am I with all this?" was a list of cards and nothing else. This is the
// broad view: the shape of the list in charts, the one thing most worth doing
// next, and a door down into each tool.
//
// IT IS CHARTS NOW, NOT PARAGRAPHS. The previous version stated the same facts
// in prose — "four ambitious, two in range" — which is a summary of a picture
// with the picture thrown away. A list that clusters two points above the
// student's average and one that spreads twenty read identically in words and
// look nothing alike. Every chart here is built from something already tested
// (`balanceOf`, `listNeeds`, the program records themselves); none of them is a
// new claim about the data, and none is a probability.
//
// The charting vocabulary is the site's existing one on purpose: stacked bars
// for parts of a whole rather than pies, one hue stepped down rather than a
// rainbow, and no value drawn without its count printed somewhere. See the
// notes in DecisionMix and ListCharts for why.
//
// It also has to read properly for a student who has skipped everything. The
// empty states are not decoration; skipping is a supported path, and this is
// the page that has to make sense of it.

const ORDER: Fit[] = ['ambitious', 'in-range', 'comfortable']

export default function OverviewView() {
  const { profile, setProfile, data, kept, average, compare, gapCount, needs, uniName } =
    useDashboard()

  // Has this student done anything yet? `kept` cannot answer that.
  //
  // `kept` resolves shortlist ids against the catalogue, and the catalogue
  // arrives in a lazy chunk — DashboardShell:97-105 builds it from
  // `data?.programs ?? []`, so `kept` is [] on the first paint of every visit,
  // including a returning student with a full list. `shortlist` is plain
  // strings read straight off the profile, so it is right immediately. Gate the
  // empty state on this and it never flashes; gate it on `kept.length` and it
  // flashes at everyone, every load.
  const listEmpty = profile.shortlist.length === 0

  const counts = average !== null ? balanceOf(average, kept) : null
  const total = counts ? ORDER.reduce((n, k) => n + counts[k], 0) : 0

  // The most useful sentence on the page: the course that would clear the most
  // programs. One, not a list — the list lives in Courses.
  //
  // Read off the shared rollup rather than walked here. The previous version
  // mapped the ENTIRE shortlist through gapFor before `.find()` could
  // short-circuit, unmemoised, on every render — and it named whichever program
  // happened to be first rather than the course that does the most work.
  const nextCourse = bestNextCourse(needs)

  /** The list broken down by subject — is it one bet or several? */
  const fieldMix = useMemo<Segment[]>(() => {
    const by = new Map<string, number>()
    for (const p of kept) by.set(p.field, (by.get(p.field) ?? 0) + 1)
    return [...by.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, label: FIELD_LABELS[key] ?? key, count }))
  }, [kept])

  /**
   * Prerequisite status across the list.
   *
   * Three states, not two, because "we have not researched this program yet" is
   * not the same as "you are clear" and the site's whole rule is not to blur
   * them. Unverified is drawn last and lightest for the same reason.
   */
  const courseMix = useMemo<Segment[]>(
    () => [
      { key: 'blocked', label: 'Missing a prerequisite', count: needs.blocked },
      { key: 'covered', label: 'Prerequisites covered', count: needs.covered },
      { key: 'unverified', label: 'Requirements not researched yet', count: needs.unverified },
    ],
    [needs],
  )

  /** Schools on the list, most-kept first — the marks row under the charts. */
  const schools = useMemo(() => {
    const by = new Map<string, number>()
    for (const p of kept) by.set(p.universityId, (by.get(p.universityId) ?? 0) + 1)
    return [...by.entries()].sort((a, b) => b[1] - a[1])
  }, [kept])

  const recent = [...kept].reverse().slice(0, 4)

  /**
   * The charts below are gated on `hasList`, and that is deliberate.
   *
   * `ListSpread` and both `StackedBar`s are pictures OF THE STUDENT'S LIST.
   * With nothing kept they do not render as "an empty chart" — the spread is an
   * axis with no marks on it and a stacked bar of three zeros is a bare grey
   * rail, both of which read as a broken component rather than as "nothing here
   * yet". The answer to a blank dashboard is not to draw a list that does not
   * exist; it is to show what the DATASET knows, which is what the start path
   * and "Worth a look" do above.
   *
   * Note this uses `kept.length` while the empty-state gate above uses
   * `profile.shortlist.length`. Two questions, two signals: a chart needs
   * resolved Program records and must wait for the catalogue, while "has this
   * student done anything" has to be answered synchronously on the first paint.
   */
  const hasList = kept.length > 0

  // ---------------------------------------------------------- empty state ---

  const steps = useMemo(() => startSteps(profile), [profile])
  const featured = useMemo(() => featuredCards(), [])
  const totals = catalogueTotals()

  // Only walked for a student who has kept nothing — it is a pass over all
  // 2,436 programs, and the populated dashboard has no use for it.
  const myField = useMemo(() => {
    if (!listEmpty || !data) return null
    return fieldSummaryFor(summarise(data.programs, uniName), profile.answers?.field ?? '')
  }, [listEmpty, data, uniName, profile.answers?.field])

  // Reads summary.json, which is a static import — no catalogue, no lazy chunk,
  // so it is right on the first paint and cannot flash like `kept` does.
  const cycle = cycleNote(cycleStanding(profile.answers?.gradYear))

  // Distinguishes "no field to show" from "the field is still loading", so the
  // dataset-wide fallback does not flash before the field summary replaces it.
  const fieldPending = listEmpty && !data && Boolean(profile.answers?.field)

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-display-2 font-600 text-ink">Your dashboard</h1>
        <p className="mt-2 max-w-2xl text-slate">
          Everything you&rsquo;ve kept, checked and compared — and what&rsquo;s worth doing next.
        </p>
        {/* Their graduating year, finally read by something.
            
            It says how RECENT the data is relative to them, not what their
            cycle holds — for four of the five graduating years the survey
            offers, their cycle holds nothing at all. See the note at the top of
            lib/cycles.ts for why the backlog's original wording was dropped.

            In the header rather than in a card: it is context for the whole
            page, it is true whether or not anything is kept, and sitting above
            the empty/populated swap keeps it clear of the sweep check that
            asserts the empty overview has no row of zeros. */}
        {cycle !== null && (
          <div className="mt-4 max-w-2xl border-l-2 border-line pl-4">
            <p className="text-sm leading-relaxed text-slate">{cycle.line}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate">{cycle.note}</p>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------- numbers --- */}
      {/* The whole <dl> is what swaps, not its children: Stat emits <dt>/<dd>
          and is only valid inside a definition list, and a step on a path is
          not a term/definition pair. */}
      {listEmpty ? (
        <StartPath steps={steps} />
      ) : (
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* shortlist.length, not kept.length: this is a count of the
              student's own actions, and reading it off the profile means it is
              right on the first paint instead of showing 0 until the catalogue
              lands — which, one click after keeping something, reads as the
              site having lost it. */}
          <Stat label="Programs kept" value={profile.shortlist.length} to="/profile/list" />
          <Stat
            label="Courses ticked"
            value={profile.courses.length}
            to="/profile/courses"
            // A denominator that MEANS something. "N with a gap" counted
            // programs while the number above it counted courses, so the tile
            // and its note were about different things. This one is the same
            // unit as the value: of the courses your list actually names, how
            // many do you have. Falls back to the program count when nothing on
            // the list has been researched, because then there is no real
            // denominator to give.
            note={
              needs.requiredCodes.length > 0
                ? `${needs.heldCodes.length} of the ${needs.requiredCodes.length} your list needs`
                : gapCount
                  ? `${gapCount} with a gap`
                  : undefined
            }
          />
          <Stat label="Staged to compare" value={compare.length} to="/profile/compare" />
          <Stat
            label="Your average"
            value={average !== null ? `${average}%` : '—'}
            to="/survey"
            note={average === null ? 'not given' : undefined}
          />
        </dl>
      )}

      {/* ----------------------------------------------------- next step --- */}
      {/* Both cards are pure apology while the list is empty: the only two
          branches reachable are "answer the questions" and "nothing kept yet",
          which the start path above now says better, with progress attached.
          They are right the moment there IS a list, so they are hidden here
          rather than reworded. */}
      {!listEmpty && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-line bg-paper p-5">
            <h2 className="font-600 text-ink">Worth doing next</h2>
            {!profile.answers ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-slate">
                  You haven&rsquo;t answered the questions yet. They only narrow what you get shown —
                  every one is skippable.
                </p>
                <Button to="/survey" className="mt-4">
                  Answer the questions
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
            ) : nextCourse ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-slate">
                  {nextCourse.programIds.length === 1
                    ? 'One program on your list needs '
                    : `${nextCourse.programIds.length} programs on your list need `}
                  <span className="font-600 text-ink">
                    {COURSE_NAMES[nextCourse.code] ?? nextCourse.code}
                  </span>
                  , and you haven&rsquo;t ticked it.
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
                <div className="mt-4">
                  <StackedBar
                    label="Balance of your list"
                    segments={ORDER.map((k) => ({
                      key: k,
                      label: FIT_LABELS[k].label,
                      count: counts[k],
                    }))}
                  />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate">
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
      )}

      {/* ---------------------------------------------------- what we hold --- */}
      {/* The other half of the empty state. The charts below describe the
          student's list and cannot run before there is one; these two sections
          describe the DATASET, which is the same on a student's first second as
          on their hundredth. Every figure is read from the generated summary or
          computed from the catalogue — none is typed in. */}
      {listEmpty && (
        <>
          <section className="mt-6 rounded-xl border border-line bg-paper p-5">
            {fieldPending ? (
              <>
                <h2 className="font-600 text-ink">What the site holds</h2>
                <div className="mt-3">
                  <FetchingNote>Reading the catalogue…</FetchingNote>
                </div>
              </>
            ) : myField ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-600 text-ink">{myField.label}, in the data</h2>
                  <Link
                    to={`/profile/programs?field=${myField.key}`}
                    className="text-sm text-brand-600 hover:text-brand-700"
                  >
                    Browse
                  </Link>
                </div>
                {/* Same figures, same wording as the Fields card. Both read
                    summarise(), so the two pages cannot print different
                    answers to "how competitive is this, really". */}
                {myField.midMedian !== null ? (
                  <>
                    <p className="mt-3 flex items-baseline gap-2">
                      <span className="font-display text-3xl font-600 text-brand-600 [font-variant-numeric:tabular-nums]">
                        {myField.midMedian}%
                      </span>
                      <span className="text-xs text-slate">typical reported median</span>
                    </p>
                    <p className="mt-1 text-xs text-slate [font-variant-numeric:tabular-nums]">
                      {myField.lowMedian}–{myField.highMedian}% across {myField.withData} of{' '}
                      {myField.programs.toLocaleString()} programs ·{' '}
                      {myField.reports.toLocaleString()} reports
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate">
                    {myField.programs.toLocaleString()} program
                    {myField.programs === 1 ? '' : 's'}, and no single one has enough reports yet
                    to describe a range.
                  </p>
                )}
                <p className="mt-3 text-xs leading-relaxed text-slate">
                  Medians reported by students who received offers — a description of who
                  answered, not a cutoff.
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="font-600 text-ink">What the site holds</h2>
                  <Link
                    to="/profile/database"
                    className="text-sm text-brand-600 hover:text-brand-700"
                  >
                    How it was collected
                  </Link>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate">
                  <Figure>{totals.reports.toLocaleString()}</Figure> reports from students, across{' '}
                  <Figure>{totals.programs.toLocaleString()}</Figure> programs at{' '}
                  <Figure>{totals.universities}</Figure> universities.{' '}
                  <Figure>{totals.programsWithCharts.toLocaleString()}</Figure> of those have
                  enough reports to show the spread of averages admitted students reported.
                </p>
                <p className="mt-3 text-xs leading-relaxed text-slate">
                  Tell us a subject in the questions and this narrows to your field.
                </p>
              </>
            )}
          </section>

          {/* -------------------------------------------------- worth a look --- */}
          <section className="mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-display-3 font-600 text-ink">Worth a look</h2>
              <Link to="/profile/programs" className="text-sm text-brand-600 hover:text-brand-700">
                All {totals.programs.toLocaleString()} programs
              </Link>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate">
              The programs students have reported on most, one from each school. Keep one and the
              rest of this page has something to work with.
            </p>
            <ul className="mt-4 grid gap-3">
              {featured.map((f) => {
                const on = isKept(profile, f.id)
                return (
                  // min-w-0: a grid item defaults to min-width:auto, so without
                  // it the longest program name sets the width of the page.
                  <li
                    key={f.id}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-paper p-3"
                  >
                    {/* 48 rather than the dashboard's usual 40: below 48px
                        UniversityMark draws a monogram instead of the crest for
                        every school without a CREST_MARKS entry. The school name
                        is visible in the row beneath, so the mark stays
                        aria-hidden with no sr-only duplicate. */}
                    <UniversityMark id={f.universityId} name={f.school} size={48} />
                    <Link to={`/program/${f.universityId}/${f.slug}`} className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-600 text-ink">{f.name}</span>
                      <span className="block truncate text-xs text-slate">
                        {f.school} · {f.median}% median of {f.sampleSize.toLocaleString()} reported
                        offers
                      </span>
                    </Link>
                    {/* Wired to setProfile, not the self-contained KeepButton:
                        that one writes to localStorage behind the shell's back,
                        so the page would still say "kept nothing" after a click. */}
                    <KeepControl kept={on} onToggle={() => setProfile(toggleShortlist(f.id))} />
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}

      {/* -------------------------------------------------------- spread --- */}
      {hasList && (
        <section className="mt-6 rounded-xl border border-line bg-paper p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-600 text-ink">Where your list sits</h2>
            {average !== null && <FitLegend />}
          </div>
          <div className="mt-4">
            <ListSpread programs={kept} average={average} />
          </div>
        </section>
      )}

      {/* ----------------------------------------------------- breakdown --- */}
      {hasList && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-line bg-paper p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-600 text-ink">What you&rsquo;re applying to</h2>
              <Link to="/profile/fields" className="text-sm text-brand-600 hover:text-brand-700">
                Fields
              </Link>
            </div>
            <div className="mt-4">
              <StackedBar label="Your list by field" segments={fieldMix} />
            </div>
            {schools.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-[11px] font-600 uppercase tracking-wider text-slate">
                  {schools.length} school{schools.length === 1 ? '' : 's'}
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {schools.map(([id, n]) => (
                    <li
                      key={id}
                      title={`${uniName.get(id) ?? id} — ${n} program${n === 1 ? '' : 's'}`}
                      className="flex items-center gap-1"
                    >
                      <UniversityMark id={id} name={uniName.get(id) ?? id} size={24} />
                      <span className="text-xs text-slate [font-variant-numeric:tabular-nums]">
                        {n}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-line bg-paper p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-600 text-ink">Prerequisites</h2>
              <Link to="/profile/courses" className="text-sm text-brand-600 hover:text-brand-700">
                Open
              </Link>
            </div>
            <div className="mt-4">
              <StackedBar label="Prerequisite status across your list" segments={courseMix} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate">
              A missing prerequisite is the one hard gate here — an average is a comparison, a
              closed door is not. Programs we haven&rsquo;t researched say so rather than counting
              as clear.
            </p>
          </section>
        </div>
      )}

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

/** A figure inside a sentence — tabular so a re-render cannot jitter the line. */
function Figure({ children }: { children: ReactNode }) {
  return <strong className="font-600 text-ink [font-variant-numeric:tabular-nums]">{children}</strong>
}

/**
 * The first three things worth doing, in place of a row of zeros.
 *
 * The tiles this replaces were a scoreboard of failure — 0, 0, 0, — for every
 * student on their first visit, on the one page meant to orient them. The same
 * facts as a path read as progress instead, and each row is a door rather than
 * a number.
 *
 * An <ol> and not a <dl>: these are ordered steps, not term/definition pairs,
 * which is also why `Stat` cannot be reused here. The tick is decorative and
 * aria-hidden — the state a screen reader needs is in the value beside it
 * ("Not yet", "0 of 1", "2 of 9"), which says more than a checkmark would.
 */
function StartPath({ steps }: { steps: StartStep[] }) {
  const done = steps.filter((s) => s.done).length

  return (
    <section className="rounded-xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-600 text-ink">Where to start</h2>
        <p className="text-sm text-slate [font-variant-numeric:tabular-nums]">
          {done} of {steps.length} done
        </p>
      </div>
      <p className="mt-1 text-sm text-slate">
        None of it is required. Each one turns on more of this page.
      </p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.key} className="min-w-0">
            <Link
              to={s.to}
              className="flex h-full min-w-0 items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:border-brand-300"
            >
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-600 ${
                  s.done
                    ? 'border-brand-500 bg-brand-50 text-brand-600'
                    : 'border-line text-transparent'
                }`}
              >
                ✓
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-600 leading-tight text-ink">{s.label}</span>
                <span className="block text-xs text-slate [font-variant-numeric:tabular-nums]">
                  {s.value}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
