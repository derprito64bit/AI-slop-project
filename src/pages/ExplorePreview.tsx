import { useEffect, useState } from 'react'
import Eyebrow from '../components/ui/Eyebrow'
import Tag from '../components/ui/Tag'
import UniversityMark from '../components/UniversityMark'
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
    <div className="relative">
      {/* graph-paper texture, decorative only */}
      <div className="bg-grid pattern-fade pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <section className="mx-auto max-w-6xl px-6 py-20">
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

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p) => {
              const band = difficultyBand(p)
              const school = uniName.get(p.universityId) ?? p.universityId
              return (
                <li key={p.id} className="flex">
                  <article className="flex w-full flex-col rounded-lg border border-line bg-paper p-5 transition-shadow hover:shadow-[0_10px_30px_rgba(20,24,31,0.07)]">
                    <div className="flex items-start gap-3">
                      <UniversityMark id={p.universityId} name={school} size={40} />
                      <div className="min-w-0 flex-1">
                        <h2 className="font-600 leading-snug text-ink">{p.name}</h2>
                        <p className="mt-0.5 text-sm text-slate">{school}</p>
                      </div>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3 border-t border-line pt-4">
                      {p.accepted ? (
                        <div>
                          <p className="font-display text-2xl font-600 leading-none text-brand-600">
                            {p.accepted.median}%
                          </p>
                          <p className="mt-1 text-xs text-slate">
                            median of {p.sampleSize} offers
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate">Not enough data yet</p>
                      )}
                      {band && (
                        <Tag tone={band === 'highly-competitive' ? 'reach' : band === 'competitive' ? 'safety' : 'likely'}>
                          {DIFFICULTY_LABELS[band]}
                        </Tag>
                      )}
                    </div>
                  </article>
                </li>
              )
            })}
            {!results.length && (
              <li className="rounded-lg border border-line bg-paper p-6 text-center text-slate sm:col-span-2 lg:col-span-3">
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
    </div>
  )
}
