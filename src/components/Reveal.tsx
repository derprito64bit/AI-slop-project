import { useEffect, useRef, type ReactNode } from 'react'
import { DURATION } from '../lib/motion'
import { observeReveal } from '../lib/revealOnScroll'

// Reusable scroll-triggered reveal. Children fade + rise into view once, as
// they enter the viewport.
//
// CSS-DRIVEN, not JavaScript-driven, and that is the point of this file. It ran
// through the motion library, which writes inline styles to every animating
// element on every frame. Measured across one scripted scroll of Explore, the
// JS version cost 565ms of style recalculation and 1,104ms of main-thread work;
// the same page with the reveals removed cost 18ms and 329ms. Lengthening the
// durations made it worse in proportion, because each element then spent twice
// as long invalidating style.
//
// A CSS transition on opacity and transform, with the element promoted for the
// duration, costs the main thread nothing per frame. The movement is identical
// - same distance, same curve, same tokens - so nothing about how this looks
// changed when it stopped being expensive.
//
// Reduced motion lives in the stylesheet: `.reveal-item` renders fully visible
// with no transition, so content never depends on the observer having fired.
type RevealProps = {
  children: ReactNode
  /** stagger delay in seconds */
  delay?: number
  /** how far it travels up, px */
  y?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'span'
}

// Defaults follow the ui-ux-pro-max motion table, Scroll Reveal / Subtle: keep
// the y offset small (8-16px) so it reads as a fade rather than a slide. The
// duration is DURATION.reveal, so this moves with everything else.
export default function Reveal({
  children,
  delay = 0,
  y = 12,
  className,
  as: Tag = 'div',
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--reveal-delay', `${delay}s`)
    el.style.setProperty('--reveal-duration', `${DURATION.reveal}s`)
    el.style.setProperty('--reveal-rise', `${y}px`)
    return observeReveal(el)
  }, [delay, y])

  return (
    <Tag ref={ref as never} className={`reveal-item ${className ?? ''}`}>
      {children}
    </Tag>
  )
}
