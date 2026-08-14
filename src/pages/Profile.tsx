import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Eyebrow from '../components/ui/Eyebrow'
import Button from '../components/ui/Button'
import Tag from '../components/ui/Tag'
import Tabs from '../components/Tabs'
import UniversityMark from '../components/UniversityMark'
import BalanceCheck, { FitTag } from '../components/BalanceCheck'
import CourseChecklist from '../components/CourseChecklist'
import CompareTable from '../components/CompareTable'
import { loadCatalogue } from '../lib/dataSource'
import {
  AMBITION_LABELS,
  FIELD_LABELS,
  PROVINCE_LABELS,
  allTags,
  clearProfile,
  loadProfile,
  matchPrograms,
  setNote,
  toggleCourse,
  toggleShortlist,
  toggleTag,
  type SavedProfile,
} from '../lib/profile'
import type { Program, University } from '../data/types'

// The planning dashboard.
//
// Everything lives in localStorage — no account, no server, nothing personal
// leaving the device. That is what lets the site ask for an average at all.
//
// The survey is optional. A student can keep programs while browsing and land
// here with no answers at all, so every tool asks for the one input it needs
// rather than the page refusing to load.

export default function Profile() {
  const [profile, setProfile] = useState<SavedProfile | null>(null)
  const [data, setData] = useState<{ programs: Program[]; universities: University[] } | null>(null)
  const [compare, setCompare] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  useEffect(() => {
    setProfile(loadProfile())
    loadCatalogue().then(setData).catch(() => {})
  }, [])

  const byId = useMemo(
    () => new Map((data?.programs ?? []).map((p) => [p.id, p])),
    [data],
  )
  const uniName = useMemo(
    () => new Map((data?.universities ?? []).map((u) => [u.id, u.name])),
    [data],
  )

  /** Programs the student kept, in the order they kept them. */
  const kept = useMemo(
    () => (profile?.shortlist ?? []).map((id) => byId.get(id)).filter((p): p is Program => !!p),
    [profile, byId],
  )

  /** Survey suggestions, minus anything already on the list. */
  const suggested = useMemo(() => {
    if (!profile?.answers || !data) return []
    return matchPrograms(profile.answers, data.programs, data.universities).filter(
      (p) => !profile.shortlist.includes(p.id),
    )
  }, [profile, data])

  const visible = useMemo(
    () => (tagFilter ? kept.filter((p) => profile?.tags[p.id]?.includes(tagFilter)) : kept),
    [kept, tagFilter, profile],
  )

  const toggleCompare = useCallback((id: string) => {
    setCompare((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  // Nothing at all yet — offer both doors rather than forcing the survey.
  if (!profile) {
    return (
      <section className="container-page max-w-2xl py-24">
        <Eyebrow>My profile</Eyebrow>
        <h1 className="mt-2 font-display text-display-1 font-600 text-ink">
          Somewhere to think it through.
        </h1>
        <p className="mt-3 text-lead text-slate">
          Keep programs as you browse, tick off the courses you&rsquo;re taking, and see how your
          list actually stacks up. Everything stays on this device.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button to="/survey">Answer four questions</Button>
          <Button to="/explore" variant="secondary">
            Just let me browse
          </Button>
        </div>
      </section>
    )
  }

  const { answers } = profile
  const average = answers?.average ?? null

  return (
    <section className="container-page py-20">
      <Eyebrow>My profile</Eyebrow>
      <h1 className="mt-2 font-display text-display-1 font-600 text-ink">Your planning board.</h1>

      {/* What we know, and how to change it. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {answers ? (
          <>
            <Tag>{FIELD_LABELS[answers.field] ?? answers.field}</Tag>
            <Tag>{answers.province ? PROVINCE_LABELS[answers.province] : 'Anywhere'}</Tag>
            <Tag>{answers.average}% average</Tag>
            <Tag>{AMBITION_LABELS[answers.ambition].label}</Tag>
            <Link to="/survey" className="ml-1 text-sm font-600 text-brand-600 hover:text-brand-700">
              Change answers
            </Link>
          </>
        ) : (
          <Link to="/survey" className="text-sm font-600 text-brand-600 hover:text-brand-700">
            Answer four questions to unlock matching →
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            clearProfile()
            setProfile(null)
          }}
          className="text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
        >
          Delete my data
        </button>
      </div>

      <Tabs
        className="mt-10"
        tabs={[
          {
            id: 'list',
            label: `My list${kept.length ? ` (${kept.length})` : ''}`,
            content: (
              <MyList
                kept={visible}
                allKept={kept}
                suggested={suggested}
                profile={profile}
                uniName={uniName}
                average={average}
                loading={!data}
                tagFilter={tagFilter}
                onTagFilter={setTagFilter}
                compare={compare}
                onCompare={toggleCompare}
                onChange={setProfile}
              />
            ),
          },
          {
            id: 'balance',
            label: 'Balance',
            content:
              average === null ? (
                <NeedsAverage />
              ) : kept.length === 0 ? (
                <Empty>Keep a few programs and this will show how your list is shaped.</Empty>
              ) : (
                <BalanceCheck average={average} programs={kept} />
              ),
          },
          {
            id: 'courses',
            label: 'Courses',
            content: (
              <CourseChecklist
                taking={profile.courses}
                onToggle={(code) => setProfile(toggleCourse(code))}
                programs={kept}
                uniName={uniName}
              />
            ),
          },
          {
            id: 'compare',
            label: `Compare${compare.length ? ` (${compare.length})` : ''}`,
            content: (
              <CompareTable
                programs={compare.map((id) => byId.get(id)).filter((p): p is Program => !!p)}
                uniName={uniName}
                onRemove={toggleCompare}
              />
            ),
          },
        ]}
      />
    </section>
  )
}

/* ------------------------------------------------------------- my list --- */

function MyList({
  kept, allKept, suggested, profile, uniName, average, loading,
  tagFilter, onTagFilter, compare, onCompare, onChange,
}: {
  kept: Program[]
  allKept: Program[]
  suggested: Program[]
  profile: SavedProfile
  uniName: Map<string, string>
  average: number | null
  loading: boolean
  tagFilter: string | null
  onTagFilter: (t: string | null) => void
  compare: string[]
  onCompare: (id: string) => void
  onChange: (p: SavedProfile) => void
}) {
  const tags = allTags(profile)

  if (loading) return <p className="text-slate">Loading programs…</p>

  return (
    <>
      {tags.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-slate">Your labels</span>
          <button
            type="button"
            onClick={() => onTagFilter(null)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              tagFilter === null ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-line text-slate'
            }`}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTagFilter(tagFilter === t ? null : t)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                tagFilter === t ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-line text-slate hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {allKept.length === 0 ? (
        <Empty>
          Nothing kept yet. Open a program and press <strong className="font-600">Keep</strong> —
          from <Link to="/explore" className="text-brand-600 hover:text-brand-700">Explore</Link> or
          any program page.
        </Empty>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {kept.map((p) => (
            <ProgramCard
              key={p.id}
              program={p}
              profile={profile}
              school={uniName.get(p.universityId) ?? p.universityId}
              average={average}
              inCompare={compare.includes(p.id)}
              onCompare={() => onCompare(p.id)}
              onChange={onChange}
            />
          ))}
        </ul>
      )}

      {suggested.length > 0 && (
        <>
          <h3 className="mt-14 font-display text-display-3 font-600 text-ink">
            From your answers
          </h3>
          <p className="mt-2 text-sm text-slate">
            Programs where admitted students reported averages near yours. Keep any that look worth
            a look.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggested.slice(0, 12).map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3"
              >
                <UniversityMark
                  id={p.universityId}
                  name={uniName.get(p.universityId) ?? p.universityId}
                  size={32}
                />
                <Link to={`/program/${p.universityId}/${p.slug}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-600 text-ink">{p.name}</span>
                  <span className="block truncate text-xs text-slate">
                    {uniName.get(p.universityId)} · {p.accepted?.median}%
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => onChange(toggleShortlist(p.id))}
                  className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-600 text-slate transition-colors hover:border-brand-300 hover:text-ink"
                >
                  + Keep
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function ProgramCard({
  program, profile, school, average, inCompare, onCompare, onChange,
}: {
  program: Program
  profile: SavedProfile
  school: string
  average: number | null
  inCompare: boolean
  onCompare: () => void
  onChange: (p: SavedProfile) => void
}) {
  const [draft, setDraft] = useState(profile.notes[program.id] ?? '')
  const [newTag, setNewTag] = useState('')
  const tags = profile.tags[program.id] ?? []

  return (
    <li className="flex flex-col rounded-xl border border-line bg-paper p-5">
      <div className="flex items-start gap-3">
        <UniversityMark id={program.universityId} name={school} size={40} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/program/${program.universityId}/${program.slug}`}
            className="block font-600 leading-snug text-ink hover:text-brand-600"
          >
            {program.name}
          </Link>
          <span className="block truncate text-sm text-slate">{school}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(toggleShortlist(program.id))}
          aria-label="Remove from your list"
          className="shrink-0 text-sm text-slate transition-colors hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {program.accepted && (
          <span className="font-display text-xl font-600 text-brand-600 [font-variant-numeric:tabular-nums]">
            {program.accepted.median}%
          </span>
        )}
        <span className="text-xs text-slate">of {program.sampleSize} reported offers</span>
        {average !== null && <FitTag average={average} program={program} />}
      </div>

      {/* Labels the student invents themselves. */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(toggleTag(program.id, t))}
            className="rounded-full border border-brand-300 bg-brand-50 px-2.5 py-0.5 text-xs text-brand-600"
            title="Remove label"
          >
            {t} ✕
          </button>
        ))}
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newTag.trim()) {
              e.preventDefault()
              onChange(toggleTag(program.id, newTag))
              setNewTag('')
            }
          }}
          placeholder="+ label"
          aria-label={`Add a label to ${program.name}`}
          className="w-24 rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs text-ink outline-none placeholder:text-slate focus:border-brand-300"
        />
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onChange(setNote(program.id, draft))}
        rows={2}
        placeholder="Notes — questions to ask, why this one…"
        aria-label={`Notes about ${program.name}`}
        className="mt-4 w-full resize-y rounded-lg border border-line bg-paper p-3 text-sm text-ink outline-none placeholder:text-slate focus:border-brand-300"
      />

      <button
        type="button"
        onClick={onCompare}
        aria-pressed={inCompare}
        className={`mt-3 self-start rounded-full border px-3 py-1 text-xs font-600 transition-colors ${
          inCompare
            ? 'border-brand-500 bg-brand-50 text-brand-600'
            : 'border-line text-slate hover:border-brand-300 hover:text-ink'
        }`}
      >
        {inCompare ? '✓ Comparing' : 'Compare'}
      </button>
    </li>
  )
}

/* ------------------------------------------------------------- shared --- */

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed text-slate">
      {children}
    </p>
  )
}

function NeedsAverage() {
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <p className="font-600 text-ink">This one needs your average.</p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate">
        To show how your list is shaped we need something to compare against. Four quick questions
        and it stays on this device.
      </p>
      <Button to="/survey" className="mt-5">
        Answer four questions
      </Button>
    </div>
  )
}
