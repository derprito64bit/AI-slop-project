import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import Combobox from '../../components/ui/Combobox'
import { FetchingNote } from '../../components/Skeleton'
import {
  ApiError,
  deleteUniversityContent,
  fetchUniversityContent,
  saveUniversityContent,
  type UniversityContent,
} from '../../lib/api'
import { invalidateUniversityContent, loadUniversities } from '../../lib/dataSource'
import { activeToken } from '../../lib/session'
import type { University } from '../../data/types'

// Editing one university's copy.
//
// THE UNIVERSITY LIST COMES FROM THE DATASET, not from the content collection,
// and that is the important structural decision here. An admin picks from the 39
// schools that actually exist in the data rather than typing an id — so a typo
// cannot create a document that matches no university and then sits in the
// collection forever looking like content that failed to appear.
//
// SAVING IS OPTIMISTIC ABOUT NOTHING. The form shows what the server returned,
// after it returned it. A panel that says "saved" before the write lands is how
// an admin walks away believing they published something they did not — and this
// service runs on a free tier that is asleep more often than it is awake.

/** A links row while it is being edited — either half may be empty mid-typing. */
type LinkRow = { label: string; url: string }

const EMPTY_DRAFT = { description: '', blurb: '', links: [] as LinkRow[] }

export default function UniversitiesEditor() {
  const [universities, setUniversities] = useState<University[] | null>(null)
  const [content, setContent] = useState<Record<string, UniversityContent> | null>(null)
  const [selected, setSelected] = useState('')
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  useEffect(() => {
    loadUniversities().then(setUniversities).catch(() => setUniversities([]))
    // Straight from the API rather than through `loadUniversityContent`, because
    // that one swallows failures into `{}` — right for a student who just wants
    // the site to work, wrong for an admin who needs to know the server is down
    // before they type three paragraphs into a form that cannot save them.
    // With the token, so the rows come back carrying `updatedBy` — that field
    // is admin-only, and the "last edited by" line below is the reason to ask.
    fetchUniversityContent(activeToken() ?? undefined)
      .then((list) => setContent(Object.fromEntries(list.map((c) => [c.universityId, c]))))
      .catch((cause) => {
        setContent({})
        setMessage({
          tone: 'bad',
          text:
            cause instanceof ApiError
              ? `Couldn’t load existing content: ${cause.message}`
              : 'Couldn’t load existing content.',
        })
      })
  }, [])

  const options = useMemo(
    () =>
      (universities ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((u) => ({ value: u.id, label: u.name, hint: content?.[u.id] ? 'edited' : undefined })),
    [universities, content],
  )

  const existing = selected ? content?.[selected] : undefined

  /** Load a university's stored copy into the form. */
  const choose = (id: string) => {
    setSelected(id)
    setMessage(null)
    const stored = id ? content?.[id] : undefined
    setDraft(
      stored
        ? {
            description: stored.description,
            blurb: stored.blurb,
            links: stored.links.map((l) => ({ ...l })),
          }
        : EMPTY_DRAFT,
    )
  }

  const save = async () => {
    const token = activeToken()
    if (!token || !selected) return
    setBusy('saving')
    setMessage(null)
    try {
      const saved = await saveUniversityContent(token, selected, {
        description: draft.description,
        blurb: draft.blurb,
        // Rows where both halves are blank are unfilled form fields, not
        // mistakes — the server ignores them too, but there is no reason to
        // make it think about them.
        links: draft.links.filter((l) => l.label.trim() || l.url.trim()),
      })
      setContent((prev) => ({ ...(prev ?? {}), [selected]: saved }))
      // The public cache holds a copy; a student loading the map a moment later
      // should see what was just published, not the version from page load.
      invalidateUniversityContent()
      setMessage({ tone: 'ok', text: 'Saved. It’s live on the site now.' })
    } catch (cause) {
      setMessage({
        tone: 'bad',
        text:
          cause instanceof ApiError
            ? // The server writes these to be shown as-is, including the ones
              // about a bad link — which is the whole reason it rejects rather
              // than silently dropping them.
              cause.message
            : 'Couldn’t save that.',
      })
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    const token = activeToken()
    if (!token || !selected) return
    setBusy('deleting')
    setMessage(null)
    try {
      await deleteUniversityContent(token, selected)
      setContent((prev) => {
        const next = { ...(prev ?? {}) }
        delete next[selected]
        return next
      })
      invalidateUniversityContent()
      setDraft(EMPTY_DRAFT)
      setMessage({ tone: 'ok', text: 'Removed. That school has no written copy again.' })
    } catch (cause) {
      setMessage({
        tone: 'bad',
        text: cause instanceof ApiError ? cause.message : 'Couldn’t remove that.',
      })
    } finally {
      setBusy(null)
    }
  }

  if (!universities || !content) {
    return <FetchingNote slow="Still loading — the server may be waking up.">Loading…</FetchingNote>
  }

  return (
    <div>
      <label className="block text-sm font-600 text-ink" htmlFor="admin-university">
        University
      </label>
      <p className="mt-1 text-xs text-slate">
        Only the {universities.length} schools that appear in the dataset. Picking from the list
        rather than typing an id is what stops a typo creating copy that matches no school.
      </p>
      <div className="mt-2 max-w-md">
        {/* Disabled mid-save, and that is a correctness fix rather than
            politeness: `save` and `remove` capture `selected` from the render
            that started them, so switching schools while a request was in
            flight landed the success message and the draft reset on whichever
            school was showing when it came back. */}
        <Combobox
          id="admin-university"
          value={selected}
          onChange={choose}
          options={options}
          placeholder="try “waterloo”"
          disabled={busy !== null}
        />
      </div>

      {selected && (
        <div className="mt-8 space-y-6">
          {existing?.updatedAt && (
            <p className="text-xs text-slate">
              Last edited {new Date(existing.updatedAt).toLocaleDateString()}
              {existing.updatedBy ? ` by ${existing.updatedBy}` : ''}.
            </p>
          )}

          <div>
            <label htmlFor="admin-blurb" className="block text-sm font-600 text-ink">
              One-line blurb
            </label>
            <p className="mt-1 text-xs text-slate">
              Shown on the map, under the school&rsquo;s name. One clause, not a sentence about how
              excellent they are.
            </p>
            <input
              id="admin-blurb"
              value={draft.blurb}
              maxLength={240}
              onChange={(e) => setDraft((d) => ({ ...d, blurb: e.target.value }))}
              placeholder="Co-op capital of Ontario"
              className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-slate focus:border-brand-300"
            />
            <p className="mt-1 text-right text-xs text-slate [font-variant-numeric:tabular-nums]">
              {draft.blurb.length}/240
            </p>
          </div>

          <div>
            <label htmlFor="admin-description" className="block text-sm font-600 text-ink">
              Description
            </label>
            <p className="mt-1 text-xs text-slate">
              What a student would want to know that the numbers do not say. No averages, no
              cutoffs, no admission chances — those come from the dataset and are not editable.
            </p>
            <textarea
              id="admin-description"
              value={draft.description}
              maxLength={4000}
              rows={7}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm leading-relaxed text-ink outline-none placeholder:text-slate focus:border-brand-300"
            />
            <p className="mt-1 text-right text-xs text-slate [font-variant-numeric:tabular-nums]">
              {draft.description.length}/4000
            </p>
          </div>

          <div>
            <p className="text-sm font-600 text-ink">Links</p>
            <p className="mt-1 text-xs text-slate">
              Must start with https://. Prefer the university&rsquo;s own pages — a link here is the
              site vouching for it.
            </p>
            <ul className="mt-3 space-y-2">
              {draft.links.map((link, i) => (
                <li key={i} className="flex flex-wrap gap-2">
                  <input
                    value={link.label}
                    maxLength={80}
                    aria-label={`Link ${i + 1} label`}
                    placeholder="Admissions"
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        links: d.links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)),
                      }))
                    }
                    className="w-40 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-slate focus:border-brand-300"
                  />
                  <input
                    value={link.url}
                    maxLength={500}
                    aria-label={`Link ${i + 1} URL`}
                    placeholder="https://…"
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        links: d.links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)),
                      }))
                    }
                    className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-slate focus:border-brand-300"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, links: d.links.filter((_, j) => j !== i) }))
                    }
                    className="rounded-lg border border-line px-3 py-2 text-sm text-slate transition-colors hover:border-accent hover:text-accent"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {draft.links.length < 12 && (
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({ ...d, links: [...d.links, { label: '', url: '' }] }))
                }
                className="mt-3 text-sm font-600 text-brand-600 hover:text-brand-700"
              >
                + Add a link
              </button>
            )}
          </div>

          {message && (
            <p
              role="status"
              className={`rounded-lg border p-3 text-sm ${
                message.tone === 'ok'
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-accent bg-accent/5 text-ink'
              }`}
            >
              {message.text}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <Button type="button" onClick={save} disabled={busy !== null}>
              {busy === 'saving' ? 'Saving…' : 'Save'}
            </Button>
            {existing && (
              <button
                type="button"
                onClick={remove}
                disabled={busy !== null}
                className="text-sm text-slate underline-offset-2 hover:text-accent hover:underline"
              >
                {busy === 'deleting' ? 'Removing…' : 'Remove all copy for this school'}
              </button>
            )}
            {busy === 'saving' && (
              <FetchingNote slow="Still saving — the server may be waking up.">
                Saving…
              </FetchingNote>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
