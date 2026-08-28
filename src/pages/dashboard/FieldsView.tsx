import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import UniversityMark from '../../components/UniversityMark'
import { ListSkeleton, FetchingNote } from '../../components/Skeleton'
import { summarise } from '../../lib/fields'
import { useDashboard } from './context'

// The way in for a student who does not yet know what to search for.
//
// Search only helps once you have a word to type. This is the other door:
// subject areas, each with the size of the field and the range of averages
// admitted students reported inside it, so "how competitive is engineering,
// really" has an answer before you have picked a single program.
//
// ORDERED BY HOW MUCH DATA WE HOLD, not by how many programs exist. Program
// count ranked the fields by how many rows a university calendar happens to
// contain, which put Business above Health on 118 fewer reports and told a
// student to start where the site knows least. Reports are the honest measure
// of which card is worth opening.
//
// THE SCHOOLS ARE SHOWN AS MARKS, not as three truncated program names. The
// old card printed the same size of grey text four times over and a student had
// to read all of it to learn anything; a row of logos answers "is my school in
// here" at a glance, and that is the actual question. Marks come from
// UniversityMark, which draws crest art at this size and a monogram otherwise —
// so every school renders, with or without a logo file.
//
// Every card links into Programs with the field pre-selected, which works
// because that view keeps its filters in the URL.

/** Schools shown as marks before the row becomes a crowd. */
const MAX_MARKS = 8

export default function FieldsView() {
  const { data, uniName } = useDashboard()
  const fields = useMemo(
    () => (data ? summarise(data.programs, uniName) : []),
    [data, uniName],
  )

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-display-2 font-600 text-ink">Fields</h1>
        <p className="mt-2 max-w-2xl text-slate">
          Subject areas, ordered by how much students have reported in each — so the first card is
          the one we can tell you most about. A place to start when you don&rsquo;t have a program
          name to search for yet.
        </p>
      </header>

      {!data ? (
        <>
          <FetchingNote>Loading fields…</FetchingNote>
          <ListSkeleton rows={4} />
        </>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {fields.map((f) => (
            // min-w-0: grid items default to min-width:auto, and the marks row
            // below scrolls, so without it the widest row sets the width of the
            // whole page on a phone.
            <li key={f.key} className="min-w-0 rounded-xl border border-line bg-paper p-5">
              {/* The hierarchy is the point of this card. One thing is large
                  (the field), one number is large (the median, which is what
                  you came for), and everything else is small and grey. The
                  previous version set all four lines at the same size, which is
                  why it read as a paragraph rather than a summary. */}
              <h2 className="font-display text-lg font-600 text-ink">{f.label}</h2>

              {f.midMedian !== null ? (
                <>
                  <p className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-600 text-brand-600 [font-variant-numeric:tabular-nums]">
                      {f.midMedian}%
                    </span>
                    <span className="text-xs text-slate">typical reported median</span>
                  </p>
                  <p className="mt-1 text-xs text-slate [font-variant-numeric:tabular-nums]">
                    {f.lowMedian}–{f.highMedian}% across {f.withData} of{' '}
                    {f.programs.toLocaleString()} programs · {f.reports.toLocaleString()} reports
                  </p>
                  {/* Where the middle sits within the field's own range. Not a
                      chart, just a mark on a line — enough to see whether a
                      field clusters high or spreads wide. */}
                  <div className="relative mt-3 h-1.5 rounded-full bg-surface">
                    <span
                      className="absolute -top-1 h-3.5 w-1 rounded-full bg-brand-500"
                      style={{
                        left: `${
                          f.highMedian === f.lowMedian
                            ? 50
                            : ((f.midMedian - f.lowMedian!) / (f.highMedian! - f.lowMedian!)) * 100
                        }%`,
                      }}
                    />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate">
                  {f.programs.toLocaleString()} program{f.programs === 1 ? '' : 's'}, and no single
                  one has enough reports yet to describe a range.
                </p>
              )}

              {f.schools.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-600 uppercase tracking-wider text-slate">
                    {f.schools.length} school{f.schools.length === 1 ? '' : 's'} with data here
                  </p>
                  {/* Overflow scrolls rather than wrapping to a third line: the
                      cards sit in a two-up grid and one tall card drags its
                      whole row taller. */}
                  <ul className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                    {f.schools.slice(0, MAX_MARKS).map((s) => (
                      // shrink-0: the row is meant to SCROLL past MAX_MARKS, and
                      // without it the flex items compress instead, which is
                      // half of why the marks were rendering tiny.
                      <li
                        key={s.id}
                        title={`${s.name} — ${s.reports.toLocaleString()} reports`}
                        className="shrink-0"
                      >
                        <Link to={`/profile/programs?field=${f.key}&uni=${s.id}`}>
                          <UniversityMark id={s.id} name={s.name} size={28} />
                          <span className="sr-only">{s.name}</span>
                        </Link>
                      </li>
                    ))}
                    {f.schools.length > MAX_MARKS && (
                      <li className="flex items-center pl-1 text-xs text-slate">
                        +{f.schools.length - MAX_MARKS}
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Absolute, not relative: a relative link from /profile/fields
                  resolves under it (/profile/fields/programs), which is not a
                  route. */}
              <Link
                to={`/profile/programs?field=${f.key}`}
                className="mt-4 inline-block text-sm font-600 text-brand-600 hover:text-brand-700"
              >
                Browse {f.label.toLowerCase()} →
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs leading-relaxed text-slate">
        Ranges describe the averages admitted students reported, not admission requirements and not
        a chance of getting in. A field with few reports will look narrower than it is.
      </p>
    </>
  )
}
