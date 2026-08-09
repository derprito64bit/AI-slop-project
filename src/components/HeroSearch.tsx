import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { loadCatalogue } from '../lib/dataSource'
import { queryPrograms } from '../lib/search'
import type { Program, University } from '../data/types'

// Hero search with live suggestions.
//
// The catalogue is fetched on first focus, never at module scope: programs.json
// is ~950kB and lazy-loaded on purpose, so a static import here would drag it
// into the Home bundle and undo the chunk split (HANDOFF section 4). By the
// time anyone has typed a character the fetch is usually already done, and
// dataSource caches it for the Explore page they land on next.
//
// Matching reuses queryPrograms from src/lib/search.ts — the same tested code
// Explore runs, so the suggestions can never disagree with the results page.
//
// Keyboard/ARIA follow the combobox pattern: the input keeps focus and owns
// aria-activedescendant while the listbox below shows the options.

const MAX_SUGGESTIONS = 6

export default function HeroSearch() {
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const listboxId = useId()
  const optionId = (i: number) => `${listboxId}-opt-${i}`

  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  const [data, setData] = useState<{ programs: Program[]; universities: University[] } | null>(null)

  const wrapRef = useRef<HTMLDivElement>(null)

  // Debounced copy of the query. Typing "computer science" is 16 renders of a
  // 2,436-program search otherwise.
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 120)
    return () => clearTimeout(t)
  }, [query])

  const warm = () => {
    if (!data) loadCatalogue().then(setData).catch(() => {})
  }

  const suggestions = useMemo(() => {
    const q = debounced.trim()
    if (!data || q.length < 2) return []
    return queryPrograms(data.programs, { query: q }, data.universities).slice(0, MAX_SUGGESTIONS)
  }, [data, debounced])

  const uniName = useMemo(
    () => new Map((data?.universities ?? []).map((u) => [u.id, u.name])),
    [data],
  )

  const open = focused && query.trim().length >= 2
  const hasResults = suggestions.length > 0

  // Reset the highlight whenever the result set changes, so Enter can never
  // fire on a stale row.
  useEffect(() => {
    setActive(-1)
  }, [debounced])

  // Close when focus or a click leaves the whole widget.
  useEffect(() => {
    if (!focused) return
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [focused])

  const goToSearch = () => {
    const q = query.trim()
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore')
  }

  const goToProgram = (p: Program) => {
    navigate(`/program/${p.universityId}/${p.slug}`)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setFocused(false)
      return
    }
    if (!open || !hasResults) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      // Only intercept Enter when a row is highlighted; otherwise the form
      // submits and runs the full search, which is what most people expect.
      e.preventDefault()
      goToProgram(suggestions[active])
    }
  }

  return (
    <div ref={wrapRef} className="relative mt-8 max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          goToSearch()
        }}
        className="glass flex items-center gap-2 rounded-full p-1.5 shadow-sm transition-colors duration-150 focus-within:border-brand-300"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setFocused(true)
            warm()
          }}
          onPointerEnter={warm}
          onKeyDown={onKeyDown}
          placeholder="Search a program or university…"
          aria-label="Search programs or universities"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm text-ink outline-none placeholder:text-slate"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-brand-500 px-5 py-2 text-sm font-600 text-white transition-colors duration-200 hover:bg-brand-600"
        >
          Search
        </button>
      </form>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
            // 180ms sits in the motion table's micro-interaction band. The panel
            // is a response to typing, so anything slower feels laggy.
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            // Glass: the panel floats over the hero artwork, which is exactly
            // the case the style table calls glass's best use — a layer that
            // should read as above the page rather than cut into it.
            className="glass absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl shadow-[0_18px_50px_rgba(20,24,31,0.14)]"
          >
            {!data ? (
              <p className="px-4 py-3 text-sm text-slate">Loading programs…</p>
            ) : hasResults ? (
              <>
                <ul id={listboxId} role="listbox" aria-label="Program suggestions" className="max-h-80 overflow-y-auto py-1">
                  {suggestions.map((p, i) => (
                    <motion.li
                      key={p.id}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === active}
                      initial={reduced ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      // 0.03s/item over <=6 rows: the motion table warns against
                      // more than 0.1s per item, and the whole list should be in
                      // place before the next keystroke lands.
                      transition={{ duration: 0.18, delay: reduced ? 0 : i * 0.03 }}
                      onPointerEnter={() => setActive(i)}
                      onPointerDown={(e) => {
                        e.preventDefault() // keep focus so blur doesn't close first
                        goToProgram(p)
                      }}
                      className={`cursor-pointer px-4 py-2.5 transition-colors duration-150 ${
                        i === active ? 'bg-cloud' : ''
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-600 text-ink">{p.name}</span>
                        {p.accepted && (
                          <span className="shrink-0 text-xs text-slate [font-variant-numeric:tabular-nums]">
                            {p.accepted.median}% median
                          </span>
                        )}
                      </div>
                      <span className="block truncate text-xs text-slate">
                        {uniName.get(p.universityId) ?? p.universityId}
                      </span>
                    </motion.li>
                  ))}
                </ul>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    goToSearch()
                  }}
                  className="block w-full border-t border-line px-4 py-2.5 text-left text-xs font-600 text-brand-600 transition-colors duration-150 hover:bg-cloud"
                >
                  See all results for “{query.trim()}” →
                </button>
              </>
            ) : (
              // A dead end is the failure mode the UX table calls out by name:
              // "No results" must come with somewhere to go.
              <div className="px-4 py-3">
                <p className="text-sm text-ink">No programs match “{query.trim()}”.</p>
                <p className="mt-1 text-xs text-slate">
                  Try a school name like “waterloo”, or a subject like “health sciences”.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
