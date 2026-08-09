import { useEffect, useState } from 'react'

// Loading placeholders.
//
// These are a layout fix as much as a visual one. Measured on the live site,
// Explore scored a cumulative layout shift of 0.34 and Program 0.14 (anything
// over 0.1 is "poor") because both pages were short while loading and the
// footer sat high, then got shoved down when the data landed. Skeletons that
// mirror the real layout's height keep the footer where it will end up.
//
// The shimmer itself is the `.skeleton` class in index.css — one shared
// keyframe so a group waves as a single unit.

/** A single shimmering block. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

/**
 * Only render children once `delay` has passed.
 *
 * dataSource caches, so a second visit resolves almost instantly — without this
 * gate the skeleton would flash for a frame and read worse than showing
 * nothing. The motion guidance is explicit: don't put elaborate loaders in
 * front of sub-300ms waits.
 */
export function DelayedSkeleton({
  children,
  delay = 300,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay)
    // Cleared on unmount so the timer (and the shimmer loop it would start)
    // never outlives the route.
    return () => clearTimeout(t)
  }, [delay])

  if (!show) return null
  return <>{children}</>
}

/**
 * Explore's result grid: same 3-across layout and card proportions.
 *
 * Nine cards, not six. Six filled roughly two rows, which left the footer
 * sitting right at the fold — then the real 30 results shoved it down, and that
 * single visible jump was most of Explore's 0.153 layout shift. Three rows push
 * the footer off-screen while loading, so when results arrive nothing the user
 * can see moves.
 */
export function CardGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div
      className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading programs"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-line bg-paper">
          {/* Matches the real card's 16:9 logo band. */}
          <Skeleton className="aspect-[16/9] rounded-none" />
          <div className="space-y-2.5 p-5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-5 h-6 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Program page: header block plus the chart area below the tabs.
 *
 * The height that keeps the footer off-screen is reserved by the caller, not
 * here — it has to exist during the delay before this component mounts.
 */
export function ProgramSkeleton() {
  return (
    <div role="status" aria-label="Loading program">
      <div className="mt-5 flex flex-wrap items-start gap-5">
        <Skeleton className="h-[72px] w-[72px] shrink-0" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
      </div>
      <Skeleton className="mt-10 h-10 w-full max-w-md" />
      <Skeleton className="mt-8 h-56 w-full" />
    </div>
  )
}
