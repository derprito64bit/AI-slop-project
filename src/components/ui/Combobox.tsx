import { useEffect, useId, useMemo, useRef, useState } from 'react'

// Type a few letters, pick from what matches.
//
// This replaced grids of chips. Thirteen fields and seven provinces as chips
// meant the survey opened with twenty small targets and no obvious first move —
// a student had to READ the whole set before answering, on every question. A
// box you type into asks for one thing and shows the matches as you go, which
// is the interaction people already know from every search field they use.
//
// FREE TEXT IS NOT AN ANSWER. The value committed here is always one of the
// supplied options. `toFilters` in lib/profile.ts maps these onto known keys,
// so an unmatched string would sail through and silently produce a shortlist of
// nothing — the student would blame the site, not the typo. Typing narrows;
// selecting answers.
//
// EVERY QUESTION CARRIES AN EXAMPLE. `placeholder` is what a real answer looks
// like, not a restatement of the label. "What do you want to study?" followed
// by a box saying "Field of study" tells you nothing you did not have; one
// saying "try 'computer science'" tells you the shape of the answer.

export type Option = { value: string; label: string; hint?: string }

/**
 * Which options a query should show.
 *
 * Pulled out of the component so it can be tested without a DOM — the same
 * split the rest of this codebase uses (search.ts, courses.ts, profile.ts are
 * all pure, and the components over them are checked by the browser sweep).
 *
 * SUBSTRING, NOT PREFIX. Prefix matching looks tidier and is wrong here:
 * "science" would find nothing, when the honest answers are "Computer science",
 * "Life sciences" and "Physical sciences". A student types the word they know,
 * not the word the list starts with.
 *
 * An empty query shows everything rather than nothing, so focusing the box is
 * still a way to browse the options — which is what the chip grid was good at
 * and what a typeahead usually throws away.
 */
export function matchOptions(options: Option[], query: string): Option[] {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter((o) => o.label.toLowerCase().includes(q))
}

export default function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  anyLabel,
  disabled,
}: {
  id: string
  /** the selected option's value, or '' for none */
  value: string
  onChange: (value: string) => void
  options: Option[]
  /** an EXAMPLE of a real answer, e.g. "try “computer science”" */
  placeholder?: string
  /** label for the explicit no-preference choice. Omit to leave it out. */
  anyLabel?: string
  disabled?: boolean
}) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)

  // The full option set, with the no-preference entry first when there is one.
  const all = useMemo<Option[]>(
    () => (anyLabel ? [{ value: '', label: anyLabel }, ...options] : options),
    [anyLabel, options],
  )

  // Looked up in `all`, not in `options`. The no-preference entry lives only in
  // `all`, so searching `options` could never find it — picking "Anywhere" left
  // the box empty and showing its example placeholder, which reads as "you have
  // not answered this" for what is a deliberate answer.
  const selected = all.find((o) => o.value === value) ?? null

  const matches = useMemo(() => matchOptions(all, query), [all, query])

  // Keep the highlight inside the list as it shrinks. Without this, typing
  // enough to cut the list down leaves the cursor past the end and Enter
  // commits nothing.
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, matches.length - 1)))
  }, [matches.length])

  // Close on an outside click. Pointerdown rather than click so the list is
  // gone before a click on something underneath it lands.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const commit = (option: Option) => {
    onChange(option.value)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setCursor((c) => (c + delta + matches.length) % Math.max(1, matches.length))
    } else if (e.key === 'Enter') {
      // Only swallow Enter when it is actually choosing something. Otherwise it
      // has to reach the form, or the keyboard path through the survey stops at
      // every question with a box on it.
      if (open && matches[cursor]) {
        e.preventDefault()
        commit(matches[cursor])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrap} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[cursor] ? `${listId}-${cursor}` : undefined}
        disabled={disabled}
        // Shows the chosen answer when there is one and the box is idle, and
        // gets out of the way the moment they start typing a new one.
        value={open ? query : selected?.label ?? ''}
        placeholder={selected ? undefined : placeholder}
        onFocus={() => {
          setQuery('')
          setOpen(true)
        }}
        // Closing on blur is not optional here, because the input shows `query`
        // whenever the box is open. Without this, tabbing to the next control
        // left `open` true — so the answer the student had already chosen
        // vanished from the box and the option list stayed floating over the
        // buttons underneath it. Only an outside pointerdown closed it, which a
        // keyboard user never performs.
        //
        // The list's own items use onPointerDown and preventDefault, so a click
        // on an option commits before this blur can close anything.
        onBlur={() => {
          setQuery('')
          setOpen(false)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setCursor(0)
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-slate focus:border-brand-300"
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line bg-paper py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-4 py-2.5 text-sm text-slate">
              Nothing matches &ldquo;{query.trim()}&rdquo;. Try fewer letters, or skip this one.
            </li>
          ) : (
            matches.map((o, i) => (
              <li
                key={o.value || '__any'}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                // Pointerdown, not click: the input's blur would otherwise fire
                // first, close the list, and the click would land on nothing.
                onPointerDown={(e) => {
                  e.preventDefault()
                  commit(o)
                }}
                onPointerEnter={() => setCursor(i)}
                className={`cursor-pointer px-4 py-2.5 text-sm ${
                  i === cursor ? 'bg-brand-50 text-brand-700' : 'text-ink'
                }`}
              >
                {o.label}
                {o.hint && <span className="ml-2 text-xs text-slate">{o.hint}</span>}
                {o.value === value && <span className="ml-2 text-xs text-brand-600">✓</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
