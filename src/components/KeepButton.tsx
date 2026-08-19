import { useEffect, useState } from 'react'
import { isKept, loadProfile, toggleShortlist } from '../lib/profile'

// "Keep" toggle, shown wherever a program appears.
//
// This is what makes the survey optional: keeping a program creates a profile
// on demand, so a student can browse first and answer questions later — or
// never. Nothing here needs an account or a server.

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

  const onClick = (e: React.MouseEvent) => {
    // Cards are wrapped in links; keeping should not navigate.
    e.preventDefault()
    e.stopPropagation()
    setKept(isKept(toggleShortlist(programId), programId))
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={kept}
      aria-label={kept ? 'Remove from your list' : 'Keep this program'}
      className={`shrink-0 rounded-full border font-600 transition-colors ${
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
