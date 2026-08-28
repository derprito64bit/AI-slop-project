import { useEffect, useState } from 'react'

// Loading placeholders shaped like the content that replaces them.
//
// These are a LAYOUT-SHIFT FIX first and decoration second. Before they
// existed, Explore rendered the words "Loading programs…" and then dropped
// several hundred cards in, moving the footer a full screen down: measured CLS
// 0.34 (poor). With a grid of correctly-sized placeholders it is 0.001. The
// program page went 0.14 -> 0.
//
// The trap, recorded because it cost a real afternoon: an earlier version put
// the skeleton behind a "wait 300ms before showing anything" gate to avoid a
// flash on fast loads. During those 300ms nothing occupied the space, so the
// footer still jumped — 0.25, most of the bug still there. If a delay gate is
// ever added back, the RESERVED HEIGHT must live on the wrapper, outside the
// gate. There is no gate here: programs.json is ~950kB and lazily fetched, so
// the load is never fast enough for a flash to be the problem.

/** One grey block. `className` carries the size — this only carries the look. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skeleton block ${className}`} aria-hidden="true" />
}

/** Matches the Explore card: 16/9 banner, title, school, then a stat row. */
export function ProgramCardSkeleton() {
  return (
    <li className="flex">
      <div className="flex w-full flex-col overflow-hidden rounded-xl border border-line bg-paper">
        <Skeleton className="aspect-[16/9] w-full" />
        <div className="flex flex-1 flex-col gap-2.5 p-5">
          <Skeleton className="h-4 w-4/5 rounded" />
          <Skeleton className="h-3 w-2/5 rounded" />
          <div className="mt-auto flex gap-2 pt-4">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </li>
  )
}

/**
 * A grid of card skeletons in the same 1/2/3-column shape as the real results.
 *
 * `count` defaults to 9 — three full desktop rows, which is roughly one
 * viewport. Fewer would let the footer sit high and then get pushed down;
 * many more would reserve a screenful of space that never gets used.
 */
export function ProgramGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <ProgramCardSkeleton key={i} />
      ))}
    </ul>
  )
}

/**
 * The program page: title block, chart panel, then the detail columns.
 *
 * No page padding of its own — it renders inside the page's existing shell, so
 * the placeholder sits exactly where the real content will.
 */
export function ProgramPageSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-3 w-24 rounded" />
      <Skeleton className="mt-3 h-9 w-2/3 rounded" />
      <Skeleton className="mt-3 h-4 w-1/3 rounded" />
      <Skeleton className="mt-8 h-64 w-full rounded-xl" />
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  )
}

/** Rows of a list — used by the dashboard tools while the catalogue loads. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  )
}

/**
 * The one announcement for any of the above.
 *
 * The skeletons are all `aria-hidden`, so a screen reader would otherwise hear
 * nothing at all while data loads. This says it once, politely.
 */
export function LoadingNote({ children = 'Loading…' }: { children?: string }) {
  return (
    <p className="sr-only" role="status" aria-live="polite">
      {children}
    </p>
  )
}

/**
 * A VISIBLE "fetching data" note, for loads that go over the network.
 *
 * `LoadingNote` above is `sr-only` because a skeleton is already telling a
 * sighted reader that something is coming. That reasoning holds for a 950kB
 * static chunk and breaks completely for the Render service, which spins down
 * when idle: a cold start takes the better part of a minute, during which a
 * silent grey rectangle reads as a site that has broken itself.
 *
 * So this says what is happening, and after `slowAfterMs` says why it is
 * taking so long. The escalation is not decoration — "waiting" and "waiting on
 * a server that is waking up" are different situations and only the second one
 * is worth staying for. The wording matches `messageForStatus`'s 503 text in
 * lib/api.ts, which is the same fact arriving through a different door.
 *
 * Announced politely rather than assertively: it is progress, not an alert.
 */
export function FetchingNote({
  children = 'Fetching data…',
  slow,
  slowAfterMs = 4000,
}: {
  children?: string
  /** shown instead once the wait stops being ordinary. Omit for local loads. */
  slow?: string
  slowAfterMs?: number
}) {
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    if (!slow) return
    const id = setTimeout(() => setIsSlow(true), slowAfterMs)
    return () => clearTimeout(id)
  }, [slow, slowAfterMs])

  return (
    <p
      className="flex items-center gap-2 text-sm text-slate"
      role="status"
      aria-live="polite"
    >
      {/* Pure CSS, and hidden from assistive tech: the text is the message.
          `motion-safe` so a reduced-motion setting gets a still dot rather
          than a pulse it did not ask for. */}
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500 motion-safe:animate-pulse"
      />
      {isSlow && slow ? slow : children}
    </p>
  )
}
