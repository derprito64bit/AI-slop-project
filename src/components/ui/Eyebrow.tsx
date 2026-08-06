import type { ReactNode } from 'react'

// The small uppercase label that sits above section headings.
export default function Eyebrow({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p className={`text-sm font-500 uppercase tracking-wider text-brand-500 ${className}`}>
      {children}
    </p>
  )
}
