import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import UniversityMark from '../../components/UniversityMark'
import { KeepControl } from '../../components/KeepButton'
import Tag from '../../components/ui/Tag'
import Combobox from '../../components/ui/Combobox'
import { FitTag } from '../../components/BalanceCheck'
import { ListSkeleton, LoadingNote } from '../../components/Skeleton'
import {
  DIFFICULTY_LABELS,
  difficultyBand,
  queryPrograms,
  type DifficultyBand,
  type ProgramFilters,
  type SortKey,
} from '../../lib/search'
import { COOP_LABELS, FIELD_LABELS, PROVINCE_LABELS, isKept, toggleShortlist } from '../../lib/profile'
import { useDashboard } from './context'

// Browse everything, with the filters the dataset actually supports.
//
// This is UI over `queryPrograms` — no new matching logic. Every filter below
// maps one-to-one onto a field of `ProgramFilters`, which is unit tested in
// search.test.ts; the survey reaches the same function through `toFilters`.
// Two ways in, one engine.
//
// Filter state lives in the URL rather than component state, so a view worth
// keeping is a link worth sending: /profile/programs?field=engineering&sort=
// average-asc survives a reload, a back button, and being pasted to someone
// else. It is also why this can be linked to from Fields.
//
// What is deliberately NOT here: any control that would imply a chance of
// admission. "Median at most" is a filter on what admitted students reported,
// and the label says exactly that.

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'most-reported', label: 'Most reported' },
  { value: 'average-asc', label: 'Median: low to high' },
  { value: 'average-desc', label: 'Median: high to low' },
  { value: 'name', label: 'Name' },
]

const BANDS: DifficultyBand[] = ['accessible', 'competitive', 'highly-competitive']

const PAGE = 24

export default function ProgramsView() {
  const { data, profile, setProfile, average, uniName } = useDashboard()
  const [params, setParams] = useSearchParams()
  const [shown, setShown] = useState(PAGE)

  const query = params.get('q') ?? ''
  const field = params.get('field') ?? ''
  const province = params.get('province') ?? ''
  const universityId = params.get('uni') ?? ''
  const difficulty = (params.get('band') ?? '') as DifficultyBand | ''
  const medianAtMost = params.get('max') ? Number(params.get('max')) : undefined
  const withDataOnly = params.get('data') === '1'
  const coop = (params.get('coop') ?? '') as 'yes' | 'no' | ''
  const sort = (params.get('sort') ?? 'most-reported') as SortKey

  /**
   * Write filters to the URL, dropping any that go back to their default.
   *
   * Takes a batch rather than one key, because changing province also has to
   * clear the university in the same write — two sequential single-key calls
   * would both start from the same `params` snapshot and the second would
   * silently undo the first.
   */
  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    // replace, not push: adjusting a filter should not fill the back button
    // with every intermediate state of a search.
    setParams(next, { replace: true })
    setShown(PAGE)
  }

  const results = useMemo(() => {
    if (!data) return []
    const filters: ProgramFilters = {
      field: field || undefined,
      province: province || undefined,
      universityId: universityId || undefined,
      difficulty: difficulty || undefined,
      medianAtMost,
      withDataOnly: withDataOnly || undefined,
      coop: coop || undefined,
    }
    return queryPrograms(data.programs, { query, filters, sort }, data.universities)
  }, [data, query, field, province, universityId, difficulty, medianAtMost, withDataOnly, coop, sort])

  const active = [field, province, universityId, difficulty, medianAtMost, withDataOnly, coop].filter(
    Boolean,
  ).length

  // Only universities that appear in the current province, so the dropdown
  // cannot offer a school that would produce zero results.
  const universities = useMemo(() => {
    const list = data?.universities ?? []
    return (province ? list.filter((u) => u.province === province) : list)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data, province])

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-display-2 font-600 text-ink">Programs</h1>
        <p className="mt-2 max-w-2xl text-slate">
          Every program on the site, filtered however you like. Keep the ones worth a second look
          and they land on your list.
        </p>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => set({ q: e.target.value })}
        placeholder="Try “waterloo cs” or “health sciences”…"
        aria-label="Search programs"
        className="w-full rounded-full border border-line bg-paper px-5 py-3 text-sm text-ink outline-none placeholder:text-slate focus:border-brand-300"
      />

      {/* ------------------------------------------------------- filters --- */}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4">
        <Select label="Field" value={field} onChange={(v) => set({ field: v })} anyLabel="Any field">
          {Object.entries(FIELD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Select
          label="Province"
          value={province}
          onChange={(v) => {
            // A university from the old province would filter to nothing,
            // so it is cleared in the same write.
            set({ province: v, uni: '' })
          }}
          anyLabel="Anywhere"
        >
          {Object.entries(PROVINCE_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>

        {/* A Combobox rather than a Select, and the only one in this row: with
            39 schools a native dropdown is a scroll, while typing "water"
            narrows it to one. The shorter lists stay native selects on purpose
            — a real <select> is better on a phone, and swapping them all out
            for consistency would trade usability for tidiness. */}
        <label className="flex w-56 flex-col gap-1 text-xs font-600 uppercase tracking-wider text-slate">
          University
          <span className="normal-case tracking-normal">
            <Combobox
              id="programs-university"
              value={universityId}
              onChange={(v) => set({ uni: v })}
              options={universities.map((u) => ({ value: u.id, label: u.name }))}
              anyLabel="Any university"
              placeholder="try “waterloo”"
            />
          </span>
        </label>

        {/* Labels from COOP_LABELS, not retyped — the survey asks the same
            question and the rail echoes the answer, so all three read from one
            place. `''` is the any-option and Select renders it itself. */}
        <Select
          label="Co-op"
          value={coop}
          onChange={(v) => set({ coop: v })}
          anyLabel={COOP_LABELS[''].label}
        >
          <option value="yes">{COOP_LABELS.yes.label}</option>
          <option value="no">{COOP_LABELS.no.label}</option>
        </Select>

        <Select
          label="How competitive"
          value={difficulty}
          onChange={(v) => set({ band: v })}
          anyLabel="Any"
        >
          {BANDS.map((b) => (
            <option key={b} value={b}>
              {DIFFICULTY_LABELS[b]}
            </option>
          ))}
        </Select>

        <Select label="Sort by" value={sort} onChange={(v) => set({ sort: v })}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>

        <label className="flex flex-col gap-1 text-xs font-600 uppercase tracking-wider text-slate">
          Median at most
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={40}
              max={100}
              value={medianAtMost ?? ''}
              onChange={(e) => set({ max: e.target.value })}
              placeholder="any"
              className="w-20 rounded-lg border border-line bg-paper px-3 py-2 text-sm normal-case tracking-normal text-ink outline-none placeholder:text-slate focus:border-brand-300"
            />
            <span className="text-sm normal-case tracking-normal text-slate">%</span>
          </div>
        </label>

        <label className="flex items-center gap-2 pb-2 text-sm text-slate">
          <input
            type="checkbox"
            checked={withDataOnly}
            onChange={(e) => set({ data: e.target.checked ? '1' : '' })}
            className="h-4 w-4 rounded border-line accent-[var(--color-brand-500)]"
          />
          Enough data to chart
        </label>

        {active > 0 && (
          <button
            type="button"
            onClick={() => setParams(query ? { q: query } : {}, { replace: true })}
            className="ml-auto pb-2 text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
          >
            Clear {active} filter{active === 1 ? '' : 's'}
          </button>
        )}
      </div>

      <p className="mt-4 text-sm text-slate" role="status">
        {data
          ? `${results.length.toLocaleString()} program${results.length === 1 ? ' matches' : 's match'}`
          : ''}
      </p>

      {/* ------------------------------------------------------- results --- */}
      {!data ? (
        <div className="mt-5">
          <LoadingNote>Loading programs…</LoadingNote>
          <ListSkeleton rows={5} />
        </div>
      ) : results.length === 0 ? (
        <p className="mt-5 rounded-xl border border-line bg-surface p-6 text-sm text-slate">
          Nothing matches all of that. Loosening the median ceiling or the province is usually the
          quickest way back to a real list.
        </p>
      ) : (
        <>
          <ul className="mt-5 grid gap-3">
            {results.slice(0, shown).map((p) => {
              const band = difficultyBand(p)
              const kept = isKept(profile, p.id)
              return (
                // min-w-0 is load-bearing: a grid item defaults to
                // min-width:auto, so without it the row cannot shrink below
                // the full width of the program name and the whole page gets
                // dragged wider than the phone it is on.
                <li
                  key={p.id}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-paper p-3"
                >
                  <UniversityMark
                    id={p.universityId}
                    name={uniName.get(p.universityId) ?? p.universityId}
                    size={36}
                  />
                  <Link to={`/program/${p.universityId}/${p.slug}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-600 text-ink">{p.name}</span>
                    <span className="block truncate text-xs text-slate">
                      {uniName.get(p.universityId)}
                      {p.accepted
                        ? ` · ${p.accepted.median}% median of ${p.sampleSize} reported offers`
                        : ' · not enough data yet'}
                    </span>
                  </Link>
                  {average !== null && <FitTag average={average} program={p} />}
                  {/* The competitiveness tag is the first thing to go when
                      space is tight: it is absolute (how hard for anyone),
                      while the fit tag beside it is about this student. The
                      program's own name matters more than either. */}
                  {band && (
                    <span className="hidden xl:block">
                      <Tag
                        tone={
                          band === 'highly-competitive'
                            ? 'high'
                            : band === 'competitive'
                              ? 'medium'
                              : 'low'
                        }
                      >
                        {DIFFICULTY_LABELS[band]}
                      </Tag>
                    </span>
                  )}
                  {/* KeepControl, not the default KeepButton: that one writes
                      to localStorage itself, so the shell's `kept` would not
                      see the click and the row would keep saying "+ Keep".
                      This was an inline copy of KeepControl's markup — same
                      classes, minus the aria-label and the pressed state. */}
                  <KeepControl kept={kept} onToggle={() => setProfile(toggleShortlist(p.id))} />
                </li>
              )
            })}
          </ul>

          {results.length > shown && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="rounded-full border border-line bg-paper px-6 py-3 text-sm font-600 text-ink transition-colors hover:border-brand-300 hover:text-brand-600"
              >
                Show more ({(results.length - shown).toLocaleString()} left)
              </button>
            </div>
          )}
        </>
      )}

      <p className="mt-8 text-xs leading-relaxed text-slate">
        Medians describe the averages admitted students reported, and students who get in are far
        likelier to report. Nothing here is an acceptance rate or a chance of admission.
      </p>
    </>
  )
}

/** A labelled dropdown that always offers an "any" option first. */
function Select({
  label,
  value,
  onChange,
  anyLabel,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  anyLabel?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-600 uppercase tracking-wider text-slate">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-400 normal-case tracking-normal text-ink outline-none focus:border-brand-300"
      >
        {anyLabel && <option value="">{anyLabel}</option>}
        {children}
      </select>
    </label>
  )
}
