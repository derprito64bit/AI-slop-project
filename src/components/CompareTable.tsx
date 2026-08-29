import { Link } from 'react-router-dom'
import UniversityMark from './UniversityMark'
import Button from './ui/Button'
import { COURSE_NAMES, gapFor } from '../lib/courses'
import { compareStarters, reportDepth } from '../lib/compareStart'
import { catalogueTotals, featuredCards } from '../lib/overview'
import { getProgramInfo, getUniversityInfo } from '../data/program-info'
import type { Program } from '../data/types'

// Up to four programs side by side.
//
// Everything shown is already loaded — no new fetch, no new data source. The
// only judgement here is what belongs in a comparison: the numbers a student
// weighs against each other, plus the facts that decide whether a program is
// even open to them (courses, length, co-op).
//
// Every verified row carries the date its sources were read, because a
// requirement from two years ago is not a requirement.
//
// THREE COURSE ROWS, not one. "Required courses" alone made the table describe
// the programs without ever describing the choice: two engineering programs
// list the same five courses, so the row that was supposed to separate them
// printed the same text twice. What separates them is what the student is
// short of. So the rows are now what the university requires, what it merely
// suggests, and — the useful one — what is still outstanding for this student.
//
// The same rule as everywhere else applies to the middle row: a recommended
// course is never counted as missing, and `gapFor` reads only the required
// list. See lib/courses.ts.

const MAX = 4

/**
 * What the tool is, in one sentence — shared rather than retyped.
 *
 * `CompareEmpty` opens with it and the table's own guard falls back to it. Two
 * copies of a sentence carrying a hard-coded 4 is how the copy ends up
 * disagreeing with MAX.
 */
const WHAT_IT_IS = `Compare puts up to ${MAX} programs in one table: the averages admitted students reported for each, next to what each university requires and what you are still short of. Two is the minimum, and past ${MAX} the columns stop being readable.`

// Hoisted out of the component so the empty state can name the rows a student
// has not seen yet. The alternative was a second hand-written list of the same
// labels sitting in the empty state — the kind that stops matching the first
// time a row is added and never gets noticed, because nobody with a filled
// table ever sees the copy that went stale.
//
// `taking` is a parameter rather than a closure for that reason alone; only the
// outstanding-courses row reads it.
const ROWS: Array<{ label: string; render: (p: Program, taking: string[]) => React.ReactNode }> = [
  {
    label: 'Median reported',
    render: (p) =>
      p.accepted ? (
        <span className="font-display text-xl font-600 text-brand-600 [font-variant-numeric:tabular-nums]">
          {p.accepted.median}%
        </span>
      ) : (
        <span className="text-slate">Not enough data</span>
      ),
  },
  {
    label: 'Middle half',
    render: (p) => (p.accepted ? `${p.accepted.p25}% – ${p.accepted.p75}%` : '—'),
  },
  {
    label: 'Full range',
    render: (p) => (p.accepted ? `${p.accepted.min}% – ${p.accepted.max}%` : '—'),
  },
  // Two labelled numbers, NOT a fraction. This row read "210 of 240" under a
  // bare "Reports" label, which is an acceptance rate to anyone who glances
  // at it — 210 of 240 got in. The two numbers do not divide: sampleSize is
  // offers that came with a usable average, totalReports is every report of
  // any outcome, and the offers without an average are in neither.
  {
    label: 'Offers with an average',
    render: (p) => p.sampleSize.toLocaleString(),
  },
  { label: 'Reports of any outcome', render: (p) => p.totalReports.toLocaleString() },
  { label: 'Cycles', render: (p) => p.cycles.join(', ') },
  {
    label: 'Required courses',
    render: (p) => {
      const info = getProgramInfo(p.id)
      if (!info?.requiredCourses?.length) return <Unverified />
      return (
        <ul className="list-disc pl-4">
          {info.requiredCourses.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )
    },
  },
  {
    label: 'Recommended',
    render: (p) => {
      const info = getProgramInfo(p.id)
      if (!info) return <Unverified />
      // An empty cell, not "not verified yet". Most programs recommend
      // nothing, and a page of amber "unverified" flags against courses that
      // simply do not exist would read as missing research.
      if (!info.recommendedCourses?.length) {
        return <span className="text-slate">&mdash;</span>
      }
      return (
        <ul className="list-disc pl-4 text-slate">
          {info.recommendedCourses.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )
    },
  },
  {
    label: 'You still need',
    render: (p, taking) => {
      const info = getProgramInfo(p.id)
      const gap = gapFor(info?.requiredCourses, taking)
      if (!gap) return <Unverified />
      if (gap.satisfied) {
        return <span className="font-600 text-brand-600">Nothing outstanding</span>
      }
      const bits = [
        ...gap.missing.map((c) => COURSE_NAMES[c] ?? c),
        ...gap.choices.map((c) => `${c.count} of ${c.codes.map((x) => COURSE_NAMES[x] ?? x).join(' / ')}`),
      ]
      return <span className="font-600 text-ink">{bits.join(', ')}</span>
    },
  },
  {
    label: 'Stated average',
    render: (p) => getProgramInfo(p.id)?.statedAverage ?? <Unverified />,
  },
  {
    label: 'Length',
    render: (p) => getProgramInfo(p.id)?.lengthYears ?? <Unverified />,
  },
  {
    label: 'Co-op',
    render: (p) => getProgramInfo(p.id)?.coop ?? <Unverified />,
  },
  {
    label: 'Campus',
    render: (p) => getUniversityInfo(p.universityId)?.campuses?.join(', ') ?? <Unverified />,
  },
  {
    label: 'Sources',
    render: (p) => {
      const info = getProgramInfo(p.id)
      if (!info) return <Unverified />
      return (
        <div className="space-y-1">
          {info.sources.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="block text-brand-600 underline underline-offset-2 hover:text-brand-700"
            >
              {s.label} ↗
            </a>
          ))}
          <span className="block text-xs text-slate">Checked {info.verified}</span>
        </div>
      )
    },
  },
]

/** Every row the filled table holds, for the empty state to name. */
const ROW_LABELS = ROWS.map((r) => r.label)

export default function CompareTable({
  programs,
  taking,
  uniName,
  onRemove,
}: {
  programs: Program[]
  /** the Grade 12 courses the student ticked, for the outstanding-courses row */
  taking: string[]
  uniName: Map<string, string>
  onRemove: (id: string) => void
}) {
  const shown = programs.slice(0, MAX)

  // One program staged is its own state, not the same sentence as none. This
  // used to be a single `< 2` branch, so a student who had deliberately staged
  // one program was shown the copy written for someone who had staged nothing —
  // no count, no acknowledgement, and the staged program invisible on the page.
  // It reads as "that did nothing", and the obvious response is to stage the
  // program you already staged.
  if (shown.length === 1) {
    return (
      <p className="rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed text-slate">
        <span className="font-600 text-ink">{shown[0].name}</span> is staged. Add one more from
        your list and they appear side by side — up to {MAX} at once, after which the columns stop
        being readable.
      </p>
    )
  }

  // A GUARD, not the empty state a student is meant to read. CompareView shows
  // <CompareEmpty> for zero, because the useful version of that state needs the
  // shortlist and the stage action, and a table handed nothing but `programs`
  // has neither. This branch stays so that no caller — this one or a later one
  // — can get fourteen rows of labels with no columns beside them.
  if (shown.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed text-slate">
        {WHAT_IT_IS}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-36 border-b border-line p-3 text-left align-bottom text-xs uppercase tracking-wider text-slate">
              Comparing
            </th>
            {shown.map((p) => (
              <th key={p.id} className="border-b border-line p-3 text-left align-bottom">
                <div className="flex items-start gap-2">
                  <UniversityMark
                    id={p.universityId}
                    name={uniName.get(p.universityId) ?? p.universityId}
                    size={32}
                  />
                  <div className="min-w-0">
                    <Link
                      to={`/program/${p.universityId}/${p.slug}`}
                      className="block font-600 leading-snug text-ink hover:text-brand-600"
                    >
                      {p.name}
                    </Link>
                    <span className="block text-xs font-400 text-slate">
                      {uniName.get(p.universityId)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(p.id)}
                      className="mt-1 text-xs font-400 text-slate underline-offset-2 hover:text-ink hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="align-top">
              <th
                scope="row"
                className="border-b border-line p-3 text-left text-xs font-500 uppercase tracking-wider text-slate"
              >
                {row.label}
              </th>
              {shown.map((p) => (
                <td key={p.id} className="border-b border-line p-3 text-ink">
                  {row.render(p, taking)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Unverified() {
  return <span className="text-slate">Not verified yet</span>
}

/* ------------------------------------------------------- nothing staged --- */

/**
 * What Compare looks like before it has ever been used.
 *
 * This was one sentence telling the student to go to another page and come
 * back, which is the reason nobody found out what the table contains: the only
 * description of the tool lived inside the tool, behind the two clicks that
 * were being asked for. So the zero state does the staging itself. Everything
 * it offers is a real program out of the dataset — the student's own kept ones
 * where there are any, and the generated summary's most-reported ones where
 * there are not. Nothing here is a placeholder or an example.
 *
 * It lives beside the table rather than in CompareView so that the list of rows
 * it advertises is `ROW_LABELS`, taken from the rows themselves.
 */
export function CompareEmpty({
  kept,
  hasList,
  loaded,
  uniName,
  onStage,
}: {
  /** the student's kept programs, resolved — empty until the catalogue loads */
  kept: Program[]
  /** their shortlist is non-empty, which is known before the catalogue resolves */
  hasList: boolean
  /** the catalogue has resolved, so a staged id will actually find a program */
  loaded: boolean
  uniName: Map<string, string>
  onStage: (id: string) => void
}) {
  const starters = compareStarters(kept)

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="font-600 text-ink">Nothing staged yet.</p>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate">{WHAT_IT_IS}</p>

      {starters.length === 2 ? (
        <FromYourList
          kept={kept}
          starters={starters}
          uniName={uniName}
          onStage={onStage}
        />
      ) : kept.length === 1 ? (
        <p className="mt-5 max-w-prose text-sm leading-relaxed text-slate">
          One program kept — <span className="font-600 text-ink">{kept[0].name}</span>. A table of
          one is just the program page, so{' '}
          <Link to="/explore" className="font-600 text-brand-600 hover:text-brand-700">
            find a second
          </Link>{' '}
          and keep it; both will be waiting here.
        </p>
      ) : hasList && !loaded ? (
        // A student WITH a shortlist looks identical to one without until
        // programs.json resolves, because `kept` is derived from it. Showing the
        // "you have kept nothing" branch for that second would tell them their
        // list was gone.
        <p className="mt-5 text-sm text-slate">Loading your list…</p>
      ) : (
        <FromTheDataset loaded={loaded} onStage={onStage} />
      )}

      <div className="mt-6 border-t border-line pt-4">
        <p className="text-xs uppercase tracking-wider text-slate">The rows it holds</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {ROW_LABELS.map((label) => (
            <li
              key={label}
              className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs text-slate"
            >
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-slate">
          The rows a university states — courses, length, co-op, campus — carry the date their
          source was read. Where nobody has read one yet, the cell says so rather than guessing.
        </p>
      </div>
    </div>
  )
}

/** They have a list. Stage two of it from here rather than sending them back. */
function FromYourList({
  kept,
  starters,
  uniName,
  onStage,
}: {
  kept: Program[]
  starters: Program[]
  uniName: Map<string, string>
  onStage: (id: string) => void
}) {
  return (
    <div className="mt-5">
      <p className="text-sm leading-relaxed text-slate">
        {/* "These two" only earns its keep when there is a third to have not
            picked. At exactly two it implies a selection nobody made. */}
        {kept.length} kept.{' '}
        {kept.length > 2
          ? 'These two have the most reported averages behind them:'
          : 'Both of them:'}
      </p>
      <ul className="mt-3 space-y-2">
        {starters.map((p) => (
          <ProgramLine
            key={p.id}
            universityId={p.universityId}
            slug={p.slug}
            name={p.name}
            school={uniName.get(p.universityId) ?? p.universityId}
            caption={reportDepth(p.accepted?.median ?? null, p.sampleSize, p.insufficientData)}
          />
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {/* Both in one handler. Staging them one at a time would land on the
            single-program state in between, which reads as the click having
            gone wrong. */}
        <Button size="sm" onClick={() => starters.forEach((p) => onStage(p.id))}>
          Compare these two
        </Button>
        <Link
          to="/profile/list"
          className="text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
        >
          or pick from your list
        </Link>
      </div>
    </div>
  )
}

/**
 * They have kept nothing. Show them the data instead of an instruction.
 *
 * `featuredCards()` is the generated summary's six — build-data.mjs sorts by
 * report volume, drops anything below the reporting threshold and keeps one
 * program per school. Same source as the Home page band, so a student who
 * arrived from there recognises them.
 *
 * Staging one of these puts a program in the table that is not on the
 * student's list, and that is fine: `compare` is view state in DashboardShell,
 * never written to the profile, and Remove clears it. It is a demonstration
 * they can throw away, not an edit to their list.
 */
function FromTheDataset({ loaded, onStage }: { loaded: boolean; onStage: (id: string) => void }) {
  const featured = featuredCards()
  const totals = catalogueTotals()
  const pair = featured.slice(0, 2)

  return (
    <div className="mt-5">
      <p className="max-w-prose text-sm leading-relaxed text-slate">
        Nothing kept yet either. There are {totals.programs.toLocaleString()} programs here and{' '}
        {totals.reports.toLocaleString()} student reports behind them — these are six of the
        most-reported, one per school:
      </p>
      <ul className="mt-3 space-y-2">
        {featured.map((f) => (
          <ProgramLine
            key={f.id}
            universityId={f.universityId}
            slug={f.slug}
            name={f.name}
            school={f.school}
            // `false`: SUMMARY.featured is built from a list build-data.mjs has
            // already filtered on `!insufficientData` (:373), so every one of
            // the six is chartable by construction. FeaturedCard carries no
            // such field to pass, and adding one would imply the six are
            // sometimes not.
            caption={reportDepth(f.median, f.sampleSize, false)}
          />
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {/* Disabled until the catalogue is in memory: `compare` holds ids, and
            CompareView resolves them through `byId`. Staging before that
            resolves puts two ids in the badge and leaves this same empty state
            on screen, which looks like the button is broken. */}
        <Button size="sm" disabled={!loaded} onClick={() => pair.forEach((f) => onStage(f.id))}>
          {loaded ? 'Put the first two in the table' : 'Loading programs…'}
        </Button>
        <Link
          to="/explore"
          className="text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
        >
          or go and find your own
        </Link>
      </div>
    </div>
  )
}

/**
 * One program, offered rather than displayed.
 *
 * No `truncate` on the name. The dashboard's content column is about 560px and
 * these sit inside a card within it; truncating turned "Smith Engineering -
 * Common First Year" into two letters on the narrowest layout. It wraps.
 */
function ProgramLine({
  universityId,
  slug,
  name,
  school,
  caption,
}: {
  universityId: string
  slug: string
  name: string
  school: string
  caption: string
}) {
  return (
    <li>
      <Link
        to={`/program/${universityId}/${slug}`}
        className="card-lift flex items-start gap-3 rounded-lg border border-line bg-paper p-3"
      >
        <UniversityMark id={universityId} name={school} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block font-600 leading-snug text-ink">{name}</span>
          <span className="block text-xs leading-relaxed text-slate">
            {school} · {caption}
          </span>
        </span>
      </Link>
    </li>
  )
}
