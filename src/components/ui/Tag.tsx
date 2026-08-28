import type { ReactNode } from 'react'

// Small status chip. How competitive a program is, or how it sits against the
// student's own average — never a chance of admission, and never "you won't
// get in".
//
// THE TONE NAMES ARE ABOUT COLOUR, NOT MEANING. They used to be
// Safety / Likely / Reach, a vocabulary that has not rendered anywhere since
// the labels moved to DIFFICULTY_LABELS and FIT_LABELS. The stale names
// outlived the labels and then quietly inverted the mapping at three call
// sites: `competitive` was passed as `safety`, so the harder of two programs
// was drawn in the calmer colour. Naming them by intensity instead makes that
// class of mistake visible at the call site.
export type TagTone = 'high' | 'medium' | 'low' | 'neutral'

const TONES: Record<TagTone, string> = {
  /** most demanding — accent */
  high: 'bg-accent/15 text-accent',
  /** in between — brand */
  medium: 'bg-brand-500/15 text-brand-600',
  /** least demanding — success */
  low: 'bg-success/15 text-success',
  neutral: 'bg-cloud text-slate',
}

export default function Tag({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: TagTone
  className?: string
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-600 ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
