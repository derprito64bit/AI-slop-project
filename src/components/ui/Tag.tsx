import type { ReactNode } from 'react'

// Small status chip. Admission odds are always framed positively —
// Safety / Likely / Reach — never "you won't get in".
export type TagTone = 'reach' | 'likely' | 'safety' | 'neutral'

const TONES: Record<TagTone, string> = {
  reach: 'bg-accent/15 text-accent',
  likely: 'bg-success/15 text-success',
  safety: 'bg-brand-500/15 text-brand-600',
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
