import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react'

// Scroll-linked parallax: children move continuously as the element passes
// through the viewport (the Hack the North "everything drifts" feel), rather
// than a one-shot reveal. Disabled under prefers-reduced-motion.
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
