import { useState } from 'react'
import { Link } from 'react-router-dom'
import UniversityMark from '../../components/UniversityMark'
import { KeepControl } from '../../components/KeepButton'
import { FitTag } from '../../components/BalanceCheck'
import { allTags, matchPrograms, setNote, toggleShortlist, toggleTag } from '../../lib/profile'
import { nearHome, nearHomeNote } from '../../lib/nearHome'
import type { SavedProfile } from '../../lib/profile'
import { useDashboard } from './context'
import type { Program } from '../../data/types'

// The list: what you've kept, with somewhere to put your thinking.
//
// Notes and labels are the brainstorming surface — the reason to come back to
// a program you looked at three weeks ago and can no longer tell apart from
// the other four you saved that day.

export default function ListView() {
  const { profile, setProfile, data, kept, average, uniName, compare, toggleCompare } = useDashboard()
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const tags = allTags(profile)
  const visible = tagFilter ? kept.filter((p) => profile.tags[p.id]?.includes(tagFilter)) : kept

  const suggested =
    profile.answers && data
      ? matchPrograms(profile.answers, data.programs, data.universities)
          .filter((p) => !profile.shortlist.includes(p.id))
          .slice(0, 9)
      : []

  // Null unless there is a placeable home city AND something kept to measure.
  // `nearHome` does the validating — a synced homeCity is not checked against
  // CITY_POINTS on the way in, so it can be any string.
  const homeRoll =
    profile.answers?.homeCity && data
      ? nearHome(profile.answers.homeCity, kept, data.universities)
      : null
  const home = homeRoll ? nearHomeNote(homeRoll) : null

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-display-2 font-600 text-ink">My list</h1>
        <p className="mt-2 text-slate">
          {kept.length === 0
            ? 'Programs you keep will collect here.'
            : `${kept.length} program${kept.length === 1 ? '' : 's'} kept.`}
        </p>
      </header>

      {tags.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              tagFilter === null
                ? 'border-brand-500 bg-brand-50 text-brand-600'
                : 'border-line text-slate hover:text-ink'
            }`}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                tagFilter === t
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-line text-slate hover:text-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {!data ? (
        <p className="text-slate">Loading programs…</p>
      ) : kept.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-6">
          <p className="text-ink">Nothing kept yet.</p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate">
            Open a program and press <strong className="font-600">Keep</strong> — from{' '}
            <Link to="/explore" className="text-brand-600 hover:text-brand-700">
              Explore
            </Link>{' '}
            or any program page. No survey needed.
          </p>
        </div>
      ) : (
        <>
          {/* WHERE THIS LIST IS, FROM WHERE THEY LIVE.
              
              `homeCity` was asked in the survey and read by exactly one place:
              the map's "measure distances from" dropdown. So the answer did
              nothing unless the student went looking for the map.

              Inside the `data`-resolved branch on purpose. `kept` is [] on the
              first paint of every visit — this needs resolved programs AND
              data.universities, and there is no shortlist-only signal to gate
              on, so anywhere above this it would flash. */}
          {home !== null && (
            <div className="mb-6 rounded-xl border border-line bg-surface p-4">
              <p className="text-sm leading-relaxed text-ink">{home.headline}</p>
              {home.extremes !== '' && (
                <p className="mt-1 text-sm leading-relaxed text-slate">{home.extremes}</p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-slate">{home.qualifier}</p>
            </div>
          )}
          <ul className="grid gap-4 xl:grid-cols-2">
          {visible.map((p) => (
            <ProgramCard
              key={p.id}
              program={p}
              profile={profile}
              school={uniName.get(p.universityId) ?? p.universityId}
              average={average}
              inCompare={compare.includes(p.id)}
              onCompare={() => toggleCompare(p.id)}
              onChange={setProfile}
            />
          ))}
          </ul>
        </>
      )}

      {suggested.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-display-3 font-600 text-ink">From your answers</h2>
          <p className="mt-2 text-sm text-slate">
            Programs where admitted students reported averages near yours.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {suggested.map((p) => (
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
                {/* Always `kept={false}` — `suggested` is filtered to programs
                    NOT on the shortlist (see above), so a row here cannot be
                    kept and vanishes on the next render after a click. That is
                    existing behaviour, not something the shared control
                    introduced: do not "fix" it to isKept() and expect to see
                    the ✓ Kept state, because the row is already gone. */}
                <KeepControl kept={false} onToggle={() => setProfile(toggleShortlist(p.id))} />
              </li>
            ))}
          </ul>
        </section>
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
          aria-label={`Remove ${program.name} from your list`}
          className="shrink-0 text-sm text-slate transition-colors hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* "median" between the two numbers, not after them. As two adjacent
            spans this read "95.9% of 210 reported offers" — a percentage of a
            count, which is an acceptance rate at a glance. The word is the
            whole fix, and it is the phrasing OverviewView and ProgramsView
            already use. */}
        {program.accepted && (
          <span className="font-display text-xl font-600 text-brand-600 [font-variant-numeric:tabular-nums]">
            {program.accepted.median}%
          </span>
        )}
        <span className="text-xs text-slate">
          {program.accepted ? 'median ' : ''}of {program.sampleSize.toLocaleString()} reported
          offers
        </span>
        {average !== null && <FitTag average={average} program={program} />}
      </div>

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
