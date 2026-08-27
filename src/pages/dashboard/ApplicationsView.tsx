import { useState } from 'react'
import { Link } from 'react-router-dom'
import UniversityMark from '../../components/UniversityMark'
import Button from '../../components/ui/Button'
import { ListSkeleton, LoadingNote } from '../../components/Skeleton'
import {
  IN_PROGRESS,
  STATUSES,
  STATUS_LABELS,
  loadTracker,
  setStatus,
  statusOf,
  untrack,
} from '../../lib/tracker'
import { useDashboard } from './context'

// Where each application actually is.
//
// This was a mock until the blocker behind it was settled. The blocker was
// "how should it behave across devices", and the answer turned out to be
// forced: `sync.ts` rebuilds the profile from a fixed whitelist on every pull,
// so a tracker stored inside the profile would be silently erased the first
// time a student signed in somewhere else. It lives in its own key instead
// (lib/tracker.ts), never touched by sync, and the page says so rather than
// letting anyone assume otherwise.
//
// The stages after "applied" are the dataset's own decision values, so a
// finished application already holds what an anonymous community report needs.

export default function ApplicationsView() {
  const { data, kept, uniName } = useDashboard()
  const [tracker, setTracker] = useState(loadTracker)

  const tracked = kept.filter((p) => statusOf(tracker, p.id))
  const untracked = kept.filter((p) => !statusOf(tracker, p.id))

  // Counts per stage, for the summary strip. Only meaningful once something is
  // tracked, so the strip is hidden until then rather than showing six zeroes.
  const counts = STATUSES.map((s) => ({
    status: s,
    n: tracked.filter((p) => statusOf(tracker, p.id) === s).length,
  })).filter((c) => c.n > 0)

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-display-2 font-600 text-ink">Applications</h1>
        <p className="mt-2 max-w-2xl text-slate">
          Where each one is, from thinking about it to hearing back. Add a program from your list
          and move it along as you go.
        </p>
      </header>

      {counts.length > 0 && (
        <ul className="mb-6 flex flex-wrap gap-2">
          {counts.map((c) => (
            <li
              key={c.status}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-slate"
            >
              <span className="font-600 text-ink [font-variant-numeric:tabular-nums]">{c.n}</span>{' '}
              {STATUS_LABELS[c.status].toLowerCase()}
            </li>
          ))}
        </ul>
      )}

      {!data ? (
        <>
          <LoadingNote>Loading your programs…</LoadingNote>
          <ListSkeleton rows={3} />
        </>
      ) : kept.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-6">
          <p className="font-600 text-ink">Nothing on your list yet.</p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate">
            This tracks the programs you have kept, so it starts there. Keep a few and they will
            show up here to move through the stages.
          </p>
          <Button to="/profile/programs" className="mt-5">
            Browse programs
          </Button>
        </div>
      ) : (
        <>
          <ul className="grid gap-3">
            {tracked.map((p) => (
              <li key={p.id} className="rounded-xl border border-line bg-paper p-4">
                <div className="flex items-start gap-3">
                  <UniversityMark
                    id={p.universityId}
                    name={uniName.get(p.universityId) ?? p.universityId}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/program/${p.universityId}/${p.slug}`}
                      className="block truncate font-600 text-ink hover:text-brand-600"
                    >
                      {p.name}
                    </Link>
                    <span className="block truncate text-sm text-slate">
                      {uniName.get(p.universityId)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTracker(untrack(p.id))}
                    aria-label={`Stop tracking ${p.name}`}
                    className="shrink-0 text-sm text-slate transition-colors hover:text-ink"
                  >
                    ✕
                  </button>
                </div>

                {/* The stage rail. Buttons rather than a select: the whole point
                    is seeing where this one sits against the others at a glance,
                    which a collapsed dropdown hides. */}
                <ol className="mt-4 flex flex-wrap gap-1.5" aria-label={`Stage for ${p.name}`}>
                  {STATUSES.map((s) => {
                    const current = statusOf(tracker, p.id) === s
                    const outcome = !IN_PROGRESS.includes(s)
                    return (
                      <li key={s}>
                        <button
                          type="button"
                          aria-pressed={current}
                          onClick={() => setTracker(setStatus(p.id, s))}
                          className={`rounded-full border px-3 py-1 text-xs font-600 transition-colors ${
                            current
                              ? 'border-brand-500 bg-brand-500 text-white'
                              : `border-line text-slate hover:border-brand-300 hover:text-ink ${
                                  outcome ? 'border-dashed' : ''
                                }`
                          }`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </li>
            ))}
          </ul>

          {untracked.length > 0 && (
            <section className={tracked.length ? 'mt-10' : ''}>
              <h2 className="font-display text-display-3 font-600 text-ink">
                {tracked.length ? 'Also on your list' : 'Start tracking'}
              </h2>
              <p className="mt-2 text-sm text-slate">
                Adding one here does not change your list — it only starts following where the
                application is up to.
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {untracked.map((p) => (
                  <li
                    key={p.id}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-paper p-3"
                  >
                    <UniversityMark
                      id={p.universityId}
                      name={uniName.get(p.universityId) ?? p.universityId}
                      size={28}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{p.name}</span>
                      <span className="block truncate text-xs text-slate">
                        {uniName.get(p.universityId)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setTracker(setStatus(p.id, 'researching'))}
                      className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-600 text-slate transition-colors hover:border-brand-300 hover:text-ink"
                    >
                      + Track
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <p className="mt-8 rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-slate">
        <strong className="font-600 text-ink">This one stays on this device.</strong> Your list,
        answers and notes sync to your account; the tracker does not yet, so it will not follow you
        to another computer.{' '}
        <Link to="/profile/deadlines" className="text-brand-600 hover:text-brand-700">
          Deadlines
        </Link>{' '}
        works the same way.
      </p>
    </>
  )
}
