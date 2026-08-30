import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react'

// Scroll-linked parallax: children move continuously as the element passes
// through the viewport (the Hack the North "everything drifts" feel), rather
// than a one-shot reveal. Disabled under prefers-reduced-motion.
//
// TRIED AND REVERTED, 2026-08-30: rewriting this on `animation-timeline: view()`
// so the browser runs it off the main thread instead of `useScroll` writing an
// inline transform every frame. It works and it is the modern way to do this.
// It also bought NOTHING measurable. Alternating both builds in one session
// with `npm run probe:cost` over a full scroll of Home:
//
//     JS parallax      script 92ms / 89ms      main thread 615ms / 569ms
//     native timeline  script 90ms / 90ms      main thread 599ms / 615ms
//
// The reason is that there are only three of these on the whole site, they are
// `hidden lg:block` decoration, and Home's cost is spread across the pinned
// roadmap and the marquees rather than concentrated here. Two code paths, an
// @property block and an @supports block for no gain is not a trade this repo
// makes — the same measurement discipline that put the scroll reveals on CSS
// says leave this one alone.
//
// Worth re-testing only against a different target: a scroll-linked effect with
// many more elements, or one that is actually showing up in a profile.
//
// While measuring: the pinned roadmap costs Home ~1,660px of extra page and
// ~18ms of script, but PER SCROLLED PIXEL it is slightly cheaper than the
// inline version (0.0147 against 0.0165 ms/px). It is a long page, not a slow
// one.
type ParallaxProps = {
  children: ReactNode
  /** total vertical travel in px across the scroll range (negative = up) */
  distance?: number
  className?: string
}

export default function Parallax({ children, distance = -60, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance])

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduced ? undefined : { y }}>{children}</motion.div>
    </div>
  )
}
