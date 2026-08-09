import { useEffect, useRef } from 'react'
import { animate, useInView, useReducedMotion } from 'motion/react'

// Counts up from 0 to `end` once, when scrolled into view.
//
// The number is written straight to the DOM rather than held in React state.
// The previous version called setState on every animation frame for 1.6s, and
// the stats band renders four of these at once — roughly 240 re-renders a
// second, each re-running toLocaleString and reconciling. Under CPU throttling
// that was a measurable chunk of the long tasks during scroll.
//
// Respects reduced motion (jumps straight to the final value).
type CountUpProps = {
  end: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
}

export default function CountUp({
  end,
  duration = 1.6,
  prefix = '',
  suffix = '',
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const numRef = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reduced = useReducedMotion()

  useEffect(() => {
    const node = numRef.current
    if (!node) return

    const write = (n: number) => {
      node.textContent = n.toLocaleString()
    }

    if (!inView) {
      // Render the final value's width from the start so the band never
      // reflows when counting begins.
      write(0)
      return
    }
    if (reduced) {
      write(end)
      return
    }

    const controls = animate(0, end, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => write(Math.round(v)),
    })
    return () => controls.stop()
  }, [inView, end, duration, reduced])

  return (
    <span ref={ref} className={className}>
      {prefix}
      <span ref={numRef}>0</span>
      {suffix}
    </span>
  )
}
