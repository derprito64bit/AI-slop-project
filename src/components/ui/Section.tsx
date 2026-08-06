import type { ReactNode } from 'react'

// Page section with the standard max-width + horizontal padding.
// `tone` sets the background band; `width` is for the rare full-bleed case.
type Tone = 'paper' | 'cloud'

export default function Section({
  children,
  tone = 'paper',
  bleed = false,
  className = '',
  innerClassName = '',
  ...rest
}: {
  children: ReactNode
  tone?: Tone
  /** when true, the background spans full width and only the inner content is constrained */
  bleed?: boolean
  className?: string
  innerClassName?: string
} & React.HTMLAttributes<HTMLElement>) {
  const bg = tone === 'cloud' ? 'bg-cloud' : ''
  const inner = `mx-auto max-w-6xl px-6 ${innerClassName}`

  if (bleed) {
    return (
      <section className={`${bg} ${className}`} {...rest}>
        <div className={inner}>{children}</div>
      </section>
    )
  }
  return (
    <section className={`${bg} ${inner} ${className}`} {...rest}>
      {children}
    </section>
  )
}
