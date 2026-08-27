import { useState } from 'react'
import { Link } from 'react-router-dom'
import UniversityMark from '../../components/UniversityMark'
import Button from '../../components/ui/Button'
import { ListSkeleton, LoadingNote } from '../../components/Skeleton'
import { getUniversityInfo } from '../../data/program-info'
import {
  addDeadline,
  allDeadlines,
  isPast,
  loadTracker,
  localToday,
  removeDeadline,
} from '../../lib/tracker'
import { useDashboard } from './context'

// The dates that matter, recorded by the student.
//
// THIS PAGE ASSERTS NO DATES, and that is the design rather than a limitation.
// It used to show an invented timeline behind a "not live yet" banner, waiting
// on a research pass that would have to be redone every cycle for 39 schools —
// and a wrong deadline here could cost someone a year, which is the worst
// failure this site could ship.
//
// So the student records what they read, and the page keeps the link to where
// they read it. That is more trustworthy than anything we could publish, it
// works for all 39 schools today rather than the three with a verified
// admissions URL, and it cannot go stale without them seeing it.
//
// Stored in lib/tracker.ts — its own key, outside the synced profile. See the
// note there.

export default function DeadlinesView() {
  const { data, kept, byId, uniName } = useDashboard()
  const [tracker, setTracker] = useState(loadTracker)
  const [adding, setAdding] = useState<string | null>(null)

  const timeline = allDeadlines(tracker)
  const today = localToday()

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-display-2 font-600 text-ink">Deadlines</h1>
        <p className="mt-2 max-w-2xl text-slate">
          The dates you have found, in order, with the page you found each one on.
        </p>
      </header>

      <div className="mb-6 rounded-lg border border-line bg-surface p-4">
        <p className="text-sm leading-relaxed text-slate">
          <strong className="font-600 text-ink">We do not publish deadlines.</strong> Universities
          change them between cycles and a wrong one here could cost you a year, so the dates on
          this page are the ones you read on an official page — with a link back to it, so you can
          check again later.
        </p>
      </div>

      {!data ? (
        <>
          <LoadingNote>Loading your programs…</LoadingNote>
          <ListSkeleton rows={3} />
        </>
      ) : kept.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-6">
          <p className="font-600 text-ink">Nothing on your list yet.</p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate">
            Deadlines hang off the programs you have kept. Keep a few and you can start recording
            dates against them.
          </p>
          <Button to="/profile/programs" className="mt-5">
            Browse programs
          </Button>
        </div>
      ) : (
        <>
          {/* The timeline: everything, in the order it happens. This is the view
              that answers "what is next", which per-program lists cannot. */}
          {timeline.length > 0 && (
            <section className="mb-10">
              <h2 className="font-display text-display-3 font-600 text-ink">What’s next</h2>
              <ol className="relative mt-4 border-l border-line pl-6">
                {timeline.map((d, i) => {
                  const program = byId.get(d.programId)
                  const past = isPast(d.date, today)
                  return (
                    <li key={`${d.programId}-${d.date}-${i}`} className="relative pb-6 last:pb-0">
                      <span
                        aria-hidden="true"
                        className={`absolute -left-[1.9rem] top-1 h-3 w-3 rounded-full border-2 bg-paper ${
                          past ? 'border-line' : 'border-brand-500'
                        }`}
                      />
                      <p
                        className={`text-xs font-600 uppercase tracking-wider ${
                          past ? 'text-slate' : 'text-brand-600'
                        }`}
                      >
                        {formatDate(d.date)}
                        {past && ' · passed'}
                      </p>
                      <p className="mt-1 font-600 text-ink">{d.label}</p>
                      <p className="mt-0.5 text-sm text-slate">
                        {program ? (
                          <Link
                            to={`/program/${program.universityId}/${program.slug}`}
                            className="hover:text-brand-600"
                          >
                            {program.name}
                          </Link>
                        ) : (
                          d.programId
                        )}
                      </p>
                      {d.source && (
                        <a
                          href={d.source}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-1 inline-block max-w-full truncate text-xs text-brand-600 hover:text-brand-700"
                        >
                          {shortUrl(d.source)}
                        </a>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          )}

          {/* Per program, so a date can be added where it belongs. */}
          <section>
            <h2 className="font-display text-display-3 font-600 text-ink">By program</h2>
            <ul className="mt-4 grid gap-3">
              {kept.map((p) => {
                const record = tracker[p.id]
                const info = getUniversityInfo(p.universityId)
                return (
                  <li key={p.id} className="rounded-xl border border-line bg-paper p-4">
                    <div className="flex items-start gap-3">
                      <UniversityMark
                        id={p.universityId}
                        name={uniName.get(p.universityId) ?? p.universityId}
                        size={32}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-600 text-ink">{p.name}</p>
                        <p className="truncate text-sm text-slate">
                          {uniName.get(p.universityId)}
                        </p>
                      </div>
                      {/* Only shown where we have a verified admissions URL —
                          three universities today. Never a guessed link. */}
                      {info?.admissionsUrl && (
                        <a
                          href={info.admissionsUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="shrink-0 text-xs font-600 text-brand-600 hover:text-brand-700"
                        >
                          Official page ↗
                        </a>
                      )}
                    </div>

                    {record?.deadlines.length ? (
                      <ul className="mt-3 space-y-1.5">
                        {record.deadlines.map((d, i) => (
                          <li
                            key={`${d.date}-${i}`}
                            className="flex flex-wrap items-baseline gap-x-3 text-sm"
                          >
                            <span
                              className={`font-600 [font-variant-numeric:tabular-nums] ${
                                isPast(d.date, today) ? 'text-slate' : 'text-ink'
                              }`}
                            >
                              {formatDate(d.date)}
                            </span>
                            <span className="text-slate">{d.label}</span>
                            {d.source && (
                              <a
                                href={d.source}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-xs text-brand-600 hover:text-brand-700"
                              >
                                source
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setTracker(removeDeadline(p.id, i))}
                              aria-label={`Remove ${d.label}`}
                              className="ml-auto text-xs text-slate hover:text-ink"
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {adding === p.id ? (
                      <DeadlineForm
                        defaultSource={info?.admissionsUrl ?? ''}
                        onCancel={() => setAdding(null)}
                        onSave={(d) => {
                          setTracker(addDeadline(p.id, d))
                          setAdding(null)
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAdding(p.id)}
                        className="mt-3 text-sm font-600 text-brand-600 hover:text-brand-700"
                      >
                        + Add a date
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}

      <p className="mt-8 rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-slate">
        <strong className="font-600 text-ink">Stays on this device.</strong> Dates are not synced to
        your account yet, so they will not follow you to another computer.
      </p>
    </>
  )
}

/* ------------------------------------------------------------- helpers --- */

/** "2026-02-01" -> "1 Feb 2026", without constructing a Date. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[Number(m) - 1]
  return month ? `${Number(d)} ${month} ${y}` : iso
}

/** Just the host, so a long admissions URL does not blow out the row. */
function shortUrl(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

function DeadlineForm({
  defaultSource,
  onSave,
  onCancel,
}: {
  defaultSource: string
  onSave: (d: { label: string; date: string; source: string }) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState('')
  const [date, setDate] = useState('')
  const [source, setSource] = useState(defaultSource)

  const input =
    'rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-slate focus:border-brand-300'

  return (
    <form
      className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault()
        if (!date || !label.trim()) return
        onSave({ label: label.trim(), date, source: source.trim() })
      }}
    >
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="What is it? e.g. supplementary due"
        aria-label="What the date is for"
        className={input}
        autoFocus
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Date"
        className={input}
      />
      <input
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Where you read it (link)"
        aria-label="Source link"
        className={`${input} sm:col-span-2`}
      />
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={!date || !label.trim()}
          className="rounded-full bg-brand-500 px-4 py-1.5 text-sm font-600 text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-slate hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  )
}
