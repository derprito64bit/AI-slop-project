import { useEffect, useState } from 'react'
import Eyebrow from '../components/ui/Eyebrow'
import Tag from '../components/ui/Tag'
import { loadCatalogue } from '../lib/dataSource'
import { queryPrograms, difficultyBand, DIFFICULTY_LABELS } from '../lib/search'
import type { Program, University } from '../data/types'

// Interim Explore page: proves the data pipeline end-to-end (lazy load →
// search → render) while the full filtered browse UI is built. Deliberately
// minimal — search box and a result list, nothing else.
export default function ExplorePreview() {
  const [data, setData] = useState<{ programs: Program[]; universities: University[] } | null>(null)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadCatalogue().then(setData).catch(() => setError(true))
  }, [])

  const results = data
    ? queryPrograms(data.programs, { query, filters: { withDataOnly: true } }, data.universities).slice(0, 20)
    : []
  const uniName = new Map((data?.universities ?? []).map((u) => [u.id, u.name]))

  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <Eyebrow>Explore</Eyebrow>
      <h1 className="mt-2 font-display text-4xl font-600 text-ink">Find your programs.</h1>

      {error && <p className="mt-6 text-slate">Couldn’t load the program data. Try refreshing.</p>}
      {!data && !error && <p className="mt-6 text-slate">Loading programs…</p>}

      {data && (
        <>
          <p className="mt-3 text-slate">
            {data.programs.length.toLocaleString()} programs across {data.universities.length}{' '}
            universities, from {data.programs.reduce((n, p) => n + p.totalReports, 0).toLocaleString()}{' '}
            student reports.
          </p>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try “waterloo cs” or “health sciences”…"
            aria-label="Search programs"
            className="mt-8 w-full rounded-full border border-line bg-paper px-5 py-3 text-sm text-ink outline-none placeholder:text-slate focus:border-brand-300"
          />

          <ul className="mt-8 space-y-3">
            {results.map((p) => {
              const band = difficultyBand(p)
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-line bg-paper p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-600 text-ink">{p.name}</p>
                    <p className="text-sm text-slate">{uniName.get(p.universityId)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {p.accepted && (
                      <p className="font-display text-xl font-600 text-brand-600">
                        {p.accepted.median}%
                      </p>
                    )}
                    <p className="text-xs text-slate">median · {p.sampleSize} reports</p>
                    {band && (
                      <Tag tone={band === 'highly-competitive' ? 'reach' : band === 'competitive' ? 'safety' : 'likely'} className="mt-1">
                        {DIFFICULTY_LABELS[band]}
                      </Tag>
                    )}
                  </div>
                </li>
              )
            })}
            {!results.length && (
              <li className="rounded-lg border border-line bg-paper p-6 text-center text-slate">
                No programs with enough reported data match that search yet.
              </li>
            )}
          </ul>

          <p className="mt-8 text-xs leading-relaxed text-slate">
            Medians reflect the averages of students who reported an offer. Because people who
            get in are more likely to submit, these are <em>not</em> admission rates.
          </p>
        </>
      )}
    </section>
  )
}
