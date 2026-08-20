import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Eyebrow from '../components/ui/Eyebrow'
import Tag from '../components/ui/Tag'
import UniversityBanner from '../components/UniversityBanner'
import KeepButton from '../components/KeepButton'
import { Skeleton, ProgramGridSkeleton, LoadingNote } from '../components/Skeleton'
import { useRevealOnScroll } from '../lib/revealOnScroll'
import { loadCatalogue } from '../lib/dataSource'
import { queryPrograms, difficultyBand, DIFFICULTY_LABELS } from '../lib/search'
import type { Program, University } from '../data/types'

// Interim Explore page: proves the data pipeline end-to-end (lazy load →
// search → render) while the full filtered browse UI is built. Deliberately
// minimal — search box and a result list, nothing else.
export default function ExplorePreview() {
  const [data, setData] = useState<{ programs: Program[]; universities: University[] } | null>(null)
  const [error, setError] = useState(false)

  // Seed from ?q=. The Home hero has always navigated to /explore?q=… but this
  // page never read the param, so every search from the landing page was
  // silently thrown away and you arrived at an unfiltered list.
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const setQuery = (next: string) => {
    // replace: typing should not push a history entry per keystroke.
    setSearchParams(next ? { q: next } : {}, { replace: true })
  }

  // How many results are rendered. Everything matching is reachable via "Show
  // more" — this only bounds the DOM, it never hides a program the way the old
  // hard .slice(0, 20) did.
  const PAGE = 30
  const [shown, setShown] = useState(PAGE)
  const revealRef = useRevealOnScroll()

  useEffect(() => {
    loadCatalogue().then(setData).catch(() => setError(true))
  }, [])

  // Reset paging whenever the query changes, so a new search starts at the top
  // of its own list rather than inheriting the last one's expansion.
  useEffect(() => {
    setShown(PAGE)
  }, [query])

  // No withDataOnly filter: programs below the reporting threshold are real
  // programs and students search for them. The card renders an honest
  // "not enough data yet" state for them rather than inventing a median.
  //
  // Memoised because this searches and sorts 2,436 programs; without it every
  // "Show more" click re-runs the whole query just to render 30 more cards.
  const matches = useMemo(
    () => (data ? queryPrograms(data.programs, { query }, data.universities) : []),
    [data, query],
  )
  const results = matches.slice(0, shown)
  const uniName = useMemo(
    () => new Map((data?.universities ?? []).map((u) => [u.id, u.name])),
    [data],
  )

  return (
    <div className="relative">
      {/* graph-paper texture, decorative only */}
      <div className="bg-grid pattern-fade pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <section className="container-page py-20">
      <Eyebrow>Explore</Eyebrow>
      <h1 className="mt-2 font-display text-display-1 font-600 text-ink">Find your programs.</h1>

      {error && <p className="mt-6 text-slate">Couldn’t load the program data. Try refreshing.</p>}

      {/* The loading state mirrors the real one block for block — count line,
          search box, result line, then a grid of cards. It replaced the single
          line "Loading programs…", which occupied one row and then let several
          hundred cards shove the footer a screen and a half down the page:
          measured CLS 0.34. Same page, same shapes, 0.001. */}
      {!data && !error && (
        <>
          <LoadingNote>Loading programs…</LoadingNote>
          <Skeleton className="mt-3 h-5 w-80 max-w-full rounded" />
          <Skeleton className="mt-8 h-12 w-full max-w-2xl rounded-full" />
          <Skeleton className="mt-4 h-4 w-48 rounded" />
          <ProgramGridSkeleton />
        </>
      )}

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

          {/* Result count, so the catalogue figure above is verifiable rather
              than a claim — and so it is obvious when a search narrows things. */}
          <p className="mt-4 text-sm text-slate" role="status">
            Showing {results.length.toLocaleString()} of {matches.length.toLocaleString()}
            {query ? ' matching programs' : ' programs'}
          </p>

          {/* Always 3 across on desktop. */}
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p, i) => {
              const band = difficultyBand(p)
              const school = uniName.get(p.universityId) ?? p.universityId
              // content-visibility lets the browser skip layout and paint for
              // cards scrolled out of view. The list runs to hundreds now that
              // paging replaced the 20-result cap; contain-intrinsic-size is the
              // placeholder height, so the scrollbar stays honest.
              //
              // The reveal goes on an inner wrapper, never on the <li>: the li
              // is what carries content-visibility and the intrinsic size, and
              // animating it would fight the browser's own skip-rendering.
              return (
                <li
                  key={p.id}
                  className="flex [content-visibility:auto] [contain-intrinsic-size:auto_360px]"
                >
                  {/* CSS-driven, not motion-driven, and this is the one list
                      where that distinction is worth the inconsistency: a JS
                      reveal writes inline styles to every animating card every
                      frame, which measured 565ms of style recalculation over
                      one scroll of this page against 18ms without. See
                      lib/revealOnScroll.ts. Same rise, same curve, same
                      stagger — the tokens are shared. */}
                  <div ref={revealRef(i)} className="reveal-item flex w-full">
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
                      {/* Keep works without a survey — that is what lets a
                          student build a list by browsing. */}
                      <div className="absolute right-3 top-3">
                        <KeepButton programId={p.id} />
                      </div>
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
                  </div>
                </li>
              )
            })}
            {!results.length && (
              <li className="rounded-xl border border-line bg-paper p-6 text-center text-slate sm:col-span-2 lg:col-span-3">
                No programs match that search.
              </li>
            )}
          </ul>

          {matches.length > results.length && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="rounded-full border border-line bg-paper px-6 py-3 text-sm font-600 text-ink transition-colors hover:border-brand-300 hover:text-brand-600"
              >
                Show more ({(matches.length - results.length).toLocaleString()} left)
              </button>
            </div>
          )}

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
