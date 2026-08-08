import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Eyebrow from '../components/ui/Eyebrow'
import Tag from '../components/ui/Tag'
import UniversityBanner from '../components/UniversityBanner'
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
      <section className="container-page py-20">
      <Eyebrow>Explore</Eyebrow>
      <h1 className="mt-2 font-display text-display-1 font-600 text-ink">Find your programs.</h1>

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
            className="mt-8 w-full max-w-2xl rounded-full border border-line bg-paper px-5 py-3 text-sm text-ink outline-none placeholder:text-slate focus:border-brand-300"
          />

          {/* Always 3 across on desktop. */}
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p) => {
              const band = difficultyBand(p)
              const school = uniName.get(p.universityId) ?? p.universityId
              return (
                <li key={p.id} className="flex">
                  <Link
                    to={`/program/${p.universityId}/${p.slug}`}
                    className="group flex w-full flex-col overflow-hidden rounded-xl border border-line bg-paper transition-shadow hover:shadow-[0_12px_34px_rgba(20,24,31,0.09)]"
                  >
                    {/* --- image band: the logo fills it edge to edge --- */}
                    <div className="relative">
                      <UniversityBanner
                        id={p.universityId}
                        name={school}
                        className="aspect-[16/9]"
                      />
                      {band && (
                        <div className="absolute left-3 top-3">
                          <Tag tone={band === 'highly-competitive' ? 'reach' : band === 'competitive' ? 'safety' : 'likely'}>
                            {DIFFICULTY_LABELS[band]}
                          </Tag>
                        </div>
                      )}
                    </div>

                    {/* --- text below --- */}
                    <div className="flex flex-1 flex-col p-5">
                      <h2 className="font-600 leading-snug text-ink group-hover:text-brand-600">
                        {p.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate">{school}</p>

                      <div className="mt-auto pt-5">
                        {p.accepted ? (
                          <div className="flex items-baseline gap-2">
                            <span className="font-display text-2xl font-600 leading-none text-brand-600">
                              {p.accepted.median}%
                            </span>
                            <span className="text-xs text-slate">
                              median of {p.sampleSize} offers
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate">Not enough data yet</p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
            {!results.length && (
              <li className="rounded-xl border border-line bg-paper p-6 text-center text-slate sm:col-span-2 lg:col-span-3">
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
