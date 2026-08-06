import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'motion/react'

// Counts up from 0 to `end` once, when scrolled into view.
// Respects reduced motion (jumps straight to the final value).
type CountUpProps = {
  end: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
}

export default function CountUp({ end, duration = 1.6, prefix = '', suffix = '', className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reduced = useReducedMotion()
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (reduced) {
      setValue(end)
      return
    }
    let raf = 0
    let start: number | null = null
    const step = (t: number) => {
      if (start === null) start = t
      const progress = Math.min((t - start) / (duration * 1000), 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * end))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inView, end, duration, reduced])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  )
}
