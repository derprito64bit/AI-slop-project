import { Link } from 'react-router-dom'
import UniversityMark from './UniversityMark'
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

const MAX = 4

export default function CompareTable({
  programs,
  uniName,
  onRemove,
}: {
  programs: Program[]
  uniName: Map<string, string>
  onRemove: (id: string) => void
}) {
  const shown = programs.slice(0, MAX)

  if (shown.length < 2) {
    return (
      <p className="rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed text-slate">
        Pick at least two programs from your list to compare them side by side. Up to {MAX} at once
        — more than that and the columns stop being readable.
      </p>
    )
  }

  const rows: Array<{ label: string; render: (p: Program) => React.ReactNode }> = [
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
    { label: 'Reports', render: (p) => `${p.sampleSize} of ${p.totalReports}` },
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
          {rows.map((row) => (
            <tr key={row.label} className="align-top">
              <th
                scope="row"
                className="border-b border-line p-3 text-left text-xs font-500 uppercase tracking-wider text-slate"
              >
                {row.label}
              </th>
              {shown.map((p) => (
                <td key={p.id} className="border-b border-line p-3 text-ink">
                  {row.render(p)}
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
