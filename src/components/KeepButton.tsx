import { useEffect, useState } from 'react'
import { isKept, loadProfile, toggleShortlist } from '../lib/profile'

// "Keep" toggle, shown wherever a program appears.
//
// This is what makes the survey optional: keeping a program creates a profile
// on demand, so a student can browse first and answer questions later — or
// never. Nothing here needs an account or a server.
//
// TWO EXPORTS, and the difference matters. `KeepButton` owns its own state and
// writes straight to localStorage, which is right on a page that holds no
// profile of its own (Explore, a program page). Inside the dashboard it is
// wrong: the shell derives `kept` from the profile it holds, so a button that
// bypasses `setProfile` leaves the page showing the old list until it remounts.
// That is why the dashboard views hand-rolled this markup. `KeepControl` is
// that markup, so there is one button and two wirings rather than four copies.

/** The button itself. Controlled — the caller owns `kept` and the write. */
export function KeepControl({
  kept,
  onToggle,
  size = 'sm',
  className = '',
}: {
  kept: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
  className?: string
}) {
  const onClick = (e: React.MouseEvent) => {
    // Cards are wrapped in links; keeping should not navigate.
    e.preventDefault()
    e.stopPropagation()
    onToggle()
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={kept}
      aria-label={kept ? 'Remove from your list' : 'Keep this program'}
      className={`shrink-0 rounded-full border font-600 transition-[scale,transform,background-color,border-color,color] active:scale-[0.96] ${
        size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'
      } ${
        kept
          ? 'border-brand-500 bg-brand-50 text-brand-600'
          : 'border-line text-slate hover:border-brand-300 hover:text-ink'
      } ${className}`}
    >
      {kept ? '✓ Kept' : '+ Keep'}
    </button>
  )
}

/** Self-contained: reads and writes localStorage itself. */
export default function KeepButton({
  programId,
  size = 'sm',
  className = '',
}: {
  programId: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const [kept, setKept] = useState(false)

  // Read on mount rather than at render: localStorage is not available during
  // SSR-style first paint, and reading it in render would also mean every card
  // re-reads storage on every re-render.
  useEffect(() => {
    setKept(isKept(loadProfile(), programId))
  }, [programId])

  return (
    <KeepControl
      kept={kept}
      onToggle={() => setKept(isKept(toggleShortlist(programId), programId))}
      size={size}
      className={className}
    />
  )
}
