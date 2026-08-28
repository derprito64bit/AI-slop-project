import type { ReactNode, HTMLAttributes } from 'react'

// A page section: the standard max-width, the standard horizontal padding, and
// the standard vertical rhythm.
//
// This component existed and was never imported once — so every page typed the
// rhythm by hand, and it drifted: Explore was `py-20` and the program page
// `py-16`, which are two pages a student moves between constantly, so the whole
// page appeared to shift by 16px on every click. It also had no `surface` tone
// and no padding at all, which is why adopting it would not have helped.
//
// `pad` names the rhythm rather than leaving it to whoever writes the next page:
//
//   section  a browsable page section                 py-20
//   band     a tinted band inside a page              py-16
//   none     the caller is doing something unusual    —
//
// `tone` is the background step. `paper` is the page colour, i.e. no band at
// all; `surface` and `cloud` are the two steps up, and both draw a hairline so
// the seam is visible even where two tinted sections meet.

type Tone = 'paper' | 'surface' | 'cloud'
type Pad = 'section' | 'band' | 'none'

const TONES: Record<Tone, string> = {
  paper: '',
  surface: 'border-y border-line bg-surface',
  cloud: 'border-y border-line bg-cloud',
}

const PADS: Record<Pad, string> = {
  section: 'py-20',
  band: 'py-16',
  none: '',
}

export default function Section({
  children,
  tone = 'paper',
  pad = 'section',
  bleed = false,
  className = '',
  innerClassName = '',
  ...rest
}: {
  children: ReactNode
  tone?: Tone
  pad?: Pad
  /** background spans full width; only the inner content is constrained */
  bleed?: boolean
  className?: string
  innerClassName?: string
} & HTMLAttributes<HTMLElement>) {
  const bg = TONES[tone]
  const padding = PADS[pad]

  // A tinted band has to bleed, or the colour stops at the content column and
  // reads as a card rather than a band. Asking for one without it is a mistake
  // rather than a choice, so it is corrected here instead of at the call site.
  if (bleed || tone !== 'paper') {
    return (
      <section className={`${bg} ${padding} ${className}`} {...rest}>
        <div className={`container-page ${innerClassName}`}>{children}</div>
      </section>
    )
  }

  return (
    <section className={`container-page ${padding} ${className}`} {...rest}>
      {children}
    </section>
  )
}
