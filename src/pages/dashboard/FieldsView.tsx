import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ListSkeleton, LoadingNote } from '../../components/Skeleton'
import { FIELD_LABELS } from '../../lib/profile'
import { useDashboard } from './context'
import type { Program } from '../../data/types'

// The way in for a student who does not yet know what to search for.
//
// Search only helps once you have a word to type. This is the other door:
// thirteen subject areas, each with the size of the field and the range of
// averages admitted students reported inside it, so "how competitive is
// engineering, really" has an answer before you have picked a single program.
//
// Every card links into Programs with the field pre-selected, which works
// because that view keeps its filters in the URL.

type FieldSummary = {
  key: string
  label: string
  programs: number
  withData: number
  /** median of the per-program medians — the middle of the field */
  midMedian: number | null
  lowMedian: number | null
  highMedian: number | null
  top: Program[]
}

function summarise(programs: Program[]): FieldSummary[] {
  const byField = new Map<string, Program[]>()
  for (const p of programs) {
    const list = byField.get(p.field)
    if (list) list.push(p)
    else byField.set(p.field, [p])
  }

  return Object.keys(FIELD_LABELS)
    .map((key) => {
      const list = byField.get(key) ?? []
      // Only programs with a usable median can describe a range. A field's
      // spread built from programs below the reporting threshold would be a
      // number with nothing behind it.
      const medians = list
        .filter((p) => !p.insufficientData && typeof p.accepted?.median === 'number')
        .map((p) => p.accepted!.median)
        .sort((a, b) => a - b)

      return {
        key,
        label: FIELD_LABELS[key],
        programs: list.length,
        withData: medians.length,
        midMedian: medians.length ? medians[Math.floor(medians.length / 2)] : null,
        lowMedian: medians.length ? medians[0] : null,
        highMedian: medians.length ? medians[medians.length - 1] : null,
        top: [...list].sort((a, b) => b.totalReports - a.totalReports).slice(0, 3),
      }
    })
    .filter((f) => f.programs > 0)
    .sort((a, b) => b.programs - a.programs)
}

export default function FieldsView() {
  const { data, uniName } = useDashboard()
  const fields = useMemo(() => (data ? summarise(data.programs) : []), [data])

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-display-2 font-600 text-ink">Fields</h1>
        <p className="mt-2 max-w-2xl text-slate">
          Thirteen subject areas, and what admitted students reported inside each one. A place to
          start when you don&rsquo;t have a program name to search for yet.
        </p>
      </header>

      {!data ? (
        <>
          <LoadingNote>Loading fields…</LoadingNote>
          <ListSkeleton rows={4} />
        </>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {fields.map((f) => (
            // min-w-0: grid items default to min-width:auto, and the program
            // names below are nowrap-truncated, so without it the longest one
            // sets the width of the whole page on a phone.
            <li key={f.key} className="min-w-0 rounded-xl border border-line bg-paper p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-600 text-ink">{f.label}</h2>
                <span className="text-sm text-slate [font-variant-numeric:tabular-nums]">
                  {f.programs.toLocaleString()} program{f.programs === 1 ? '' : 's'}
                </span>
              </div>

              {f.midMedian !== null ? (
                <>
                  <p className="mt-3 text-sm text-slate">
                    Typical reported median{' '}
                    <strong className="font-600 text-ink [font-variant-numeric:tabular-nums]">
                      {f.midMedian}%
                    </strong>
                    , across {f.lowMedian}–{f.highMedian}% for the {f.withData} programs with
                    enough reports.
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
                <p className="mt-3 text-sm text-slate">
                  No program in this field has enough reports yet to describe a range.
                </p>
              )}

              {f.top.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {f.top.map((p) => (
                    <li key={p.id} className="truncate text-sm">
                      <Link
                        to={`/program/${p.universityId}/${p.slug}`}
                        className="text-slate hover:text-brand-600"
                      >
                        {p.name}{' '}
                        <span className="text-xs">
                          · {uniName.get(p.universityId) ?? p.universityId}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
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
