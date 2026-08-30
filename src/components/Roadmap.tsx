import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from 'motion/react'
import { DURATION, EASE, SPRING } from '../lib/motion'

/** Wait before the first pin lands, and the gap between pins. Seconds. */
const PIN_LEAD = 0.3
const PIN_GAP = 0.42

export type RoadmapStep = { n: string; title: string; body: string }

// Marker art — placeholders (dot / flag / check). Swap for real icons/flags later.
//
// The flag is drawn in two pieces so it can plant like a real one: the pole is
// there the moment the marker lands, and the cloth unfurls out of it a beat
// later. One combined path would have to fade in whole, which is the thing it
// is meant to stop looking like.
function Marker({ kind, delay = 0 }: { kind: 'dot' | 'flag' | 'check'; delay?: number }) {
  // `pathLength` is not a transform, so <MotionConfig reducedMotion="user"> does
  // NOT drop it — the flag still unfurled and the tick still drew themselves for
  // someone who asked for no motion. Worse, this component's reduced-motion path
  // routes to the inline variant, which is the one that renders these. Every
  // other animated thing in this file branches on `reduced`; these two were
  // missed because the property they animate is not one MotionConfig covers.
  const reduced = useReducedMotion()
  const draw = reduced
    ? { initial: { pathLength: 1 }, whileInView: { pathLength: 1 }, transition: { duration: 0 } }
    : null
  if (kind === 'flag')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 21V4" />
        <motion.path
          d="M5 4l11 3-3 4 3 4-11 3"
          initial={draw ? draw.initial : { pathLength: 0 }}
          whileInView={draw ? draw.whileInView : { pathLength: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={
            draw ? draw.transition : { delay: delay + UNFURL_AFTER, duration: 0.6, ease: EASE.out }
          }
        />
      </svg>
    )
  if (kind === 'check')
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d="M5 12l4 4 10-10"
          initial={draw ? draw.initial : { pathLength: 0 }}
          whileInView={draw ? draw.whileInView : { pathLength: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={
            draw ? draw.transition : { delay: delay + UNFURL_AFTER, duration: 0.55, ease: EASE.out }
          }
        />
      </svg>
    )
  return <span className="block h-2.5 w-2.5 rounded-full bg-current" />
}

/** How long after a pin lands before its mark draws itself. */
const UNFURL_AFTER = 0.26

/**
 * The section's own heading — shared, because only one variant used to have it.
 *
 * Home renders `<Roadmap pinned />` and nothing else for this section, and the
 * heading lived inside PinnedRoadmap. So anyone routed to the inline variant
 * got the three steps with no "How it works" and no title above them — which
 * until now meant every reduced-motion visitor, and would now also mean every
 * phone.
 */
function RoadmapHeading() {
  return (
    <div className="text-center">
      <p className="text-sm font-500 uppercase tracking-wider text-brand-500">How it works</p>
      {/* display-2, not display-1. A section heading at display-1 ties the
          page h1 exactly, so the page had two things claiming to be its
          title and the hierarchy read flat. */}
      <h2 className="mt-2 font-display text-display-2 font-600 text-ink">
        Three steps from “I have no idea” to a real shortlist.
      </h2>
    </div>
  )
}

const KINDS: Array<'dot' | 'flag' | 'check'> = ['dot', 'flag', 'check']
const PATH_D = 'M80,80 C 280,80 300,30 500,45 S 720,95 920,55'

// Horizontal roadmap: a winding line draws itself as the section scrolls into
// view, with step markers popping in along it. Collapses to a vertical timeline
// on mobile. Respects reduced motion.
//
// `pinned` = TEST feature: the section sticks to the full viewport while you
// scroll, and the path/steps reveal against that pinned progress. Remove the
// `pinned` prop to revert to the normal inline layout.
export default function Roadmap({ steps, pinned = false }: { steps: RoadmapStep[]; pinned?: boolean }) {
  const reduced = useReducedMotion()
  const narrow = useNarrow()
  // Reduced motion + pinned would be a tall empty scroll with no payoff — fall
  // back to the inline version.
  //
  // NARROW FALLS BACK TOO, and that one was a bug rather than a preference.
  // The pinned layout puts its content in a `h-screen overflow-hidden` box.
  // Above `sm:` the three steps sit in a row and fit; below it they stack, and
  // an eyebrow + a display-2 heading + three cards of (numeral + h3 + body) +
  // the scroll hint comes to roughly 780px inside a 667-812px box that cannot
  // scroll. It was cut off top and bottom on every phone, on the third section
  // of the home page. The winding path is already `hidden sm:block`, so below
  // that breakpoint the pinned version was most of a screen of nothing anyway.
  if (pinned && !reduced && !narrow) return <PinnedRoadmap steps={steps} />
  return <InlineRoadmap steps={steps} reduced={!!reduced} />
}

/**
 * True below Tailwind's `sm` (640px), tracked live.
 *
 * A one-shot read at mount would leave the wrong variant on screen after a
 * rotate or a resize, and this decides between a 300vh pinned track and an
 * inline block — not something to get wrong until the next navigation.
 */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    onChange()
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

// ---------- Reveal helper tied to a scroll-progress MotionValue ----------
function RevealAt({
  progress,
  start,
  end,
  children,
  className,
  style,
}: {
  progress: MotionValue<number>
  start: number
  end: number
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const opacity = useTransform(progress, [start, end], [0, 1])
  const scale = useTransform(progress, [start, end], [0.6, 1])
  const y = useTransform(progress, [start, end], [18, 0])
  return (
    <motion.div className={className} style={{ opacity, scale, y, ...style }}>
      {children}
    </motion.div>
  )
}

// ================= PINNED (full-screen) variant — TEST feature =================
function PinnedRoadmap({ steps }: { steps: RoadmapStep[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  // Draw the line via a growing clip rectangle (in viewBox units, width 1000).
  // This reliably fills to the very end — unlike motion's pathLength, which
  // mis-measured with non-scaling-stroke + stretched preserveAspectRatio.
  // Completes by ~0.55 and clamps at full, so it's solidly drawn while pinned.
  const revealW = useTransform(scrollYProgress, [0.05, 0.45], [0, 1000])
  const xs = steps.map((_, i) => ((i + 0.5) / steps.length) * 100)
  // Each step reveals in its own slice — all finished by ~0.55 and then held
  // (useTransform clamps at 1), so nothing is mid-fade at the end of the pin.
  const win = (i: number) => {
    const start = 0.1 + i * (0.3 / steps.length)
    return { start, end: start + 0.12 }
  }

  return (
    // Tall track: the sticky child stays full-screen while you scroll through it.
    //
    // 220vh, down from 300vh. At 300 the section held the viewport for roughly
    // 2,000px: the three steps arrived around the middle and had scrolled away
    // again before the pin released, leaving a drawn line above half a screen
    // of nothing. It needed a "KEEP SCROLLING" prompt to explain itself, which
    // is the tell. The reveal windows below were retimed with it so the steps
    // land earlier and are still there when the section lets go.
    <section ref={ref} className="relative h-[220vh]">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="container-page">
          <RoadmapHeading />

          {/* Winding path + markers */}
          <div className="relative mt-16 hidden h-40 sm:block">
            <svg viewBox="0 0 1000 120" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <defs>
                <clipPath id="roadmap-reveal">
                  <motion.rect x={0} y={0} height={120} width={revealW} />
                </clipPath>
              </defs>
              {/* faint full track */}
              <path d={PATH_D} fill="none" stroke="var(--color-line)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              {/* blue line, revealed left-to-right by the growing clip */}
              <path
                d={PATH_D}
                fill="none"
                stroke="var(--color-brand-500)"
                strokeWidth="2.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                clipPath="url(#roadmap-reveal)"
              />
            </svg>
            {xs.map((x, i) => {
              const { start, end } = win(i)
              return (
                <RevealAt
                  key={i}
                  progress={scrollYProgress}
                  start={start}
                  end={end}
                  className="absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper text-brand-600 shadow-md"
                  style={{ left: `${x}%`, top: `${[67, 40, 52][i] ?? 55}%` }}
                >
                  <Marker kind={KINDS[i % KINDS.length]} />
                </RevealAt>
              )
            })}
          </div>

          {/* Step cards */}
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {steps.map((s, i) => {
              const { start, end } = win(i)
              return (
                <RevealAt key={s.n} progress={scrollYProgress} start={start} end={end} className="text-center">
                  <div className="font-display text-5xl font-500 text-brand-300">{s.n}</div>
                  <h3 className="mt-3 text-xl font-600 text-ink">{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-slate">{s.body}</p>
                </RevealAt>
              )
            })}
          </div>

          {/* Scroll hint */}
          <motion.p
            style={{ opacity: useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [1, 0, 0, 0]) }}
            className="mt-12 text-center text-xs uppercase tracking-wider text-slate"
          >
            ↓ keep scrolling
          </motion.p>
        </div>
      </div>
    </section>
  )
}

// ================= INLINE (default) variant =================
function InlineRoadmap({ steps, reduced }: { steps: RoadmapStep[]; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end center'] })
  const pathLength = useTransform(scrollYProgress, [0, 0.9], [0, 1])
  const xs = steps.map((_, i) => ((i + 0.5) / steps.length) * 100)

  return (
    <div ref={ref} className="container-page py-20">
      <RoadmapHeading />
      {/* Desktop: winding path + markers */}
      <div className="relative mt-10 hidden h-28 md:block">
        <svg viewBox="0 0 1000 120" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d={PATH_D} fill="none" stroke="var(--color-line)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <motion.path
            d={PATH_D}
            fill="none"
            stroke="var(--color-brand-500)"
            strokeWidth="2.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={reduced ? undefined : { pathLength }}
          />
        </svg>
        {/* Pin-drop. Each marker falls the last few pixels onto the path and
            overshoots slightly before settling, one after another as the line
            draws beneath them — so the section reads as a route being marked
            out rather than three icons fading in together. The drop is short
            (14px) on purpose: from any higher it stops looking like a pin
            landing and starts looking like a card sliding in. */}
        {xs.map((x, i) => {
          const delay = PIN_LEAD + i * PIN_GAP
          return (
            <motion.div
              key={i}
              className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper text-brand-600 shadow-sm"
              style={{ left: `${x}%`, top: `${[67, 40, 52][i] ?? 55}%` }}
              initial={reduced ? false : { scale: 0.3, opacity: 0, y: -14 }}
              whileInView={{ scale: 1, opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay, ...SPRING.pin }}
            >
              <Marker kind={KINDS[i % KINDS.length]} delay={delay} />
            </motion.div>
          )
        })}
      </div>

      {/* Desktop: step cards under each node */}
      <div className="mt-4 hidden gap-6 md:grid md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div
            key={s.n}
            className="text-center"
            initial={reduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: 0.5 + i * 0.42, duration: DURATION.slow, ease: EASE.out }}
          >
            <div className="font-display text-4xl font-500 text-brand-300">{s.n}</div>
            <h3 className="mt-3 text-lg font-600 text-ink">{s.title}</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate">{s.body}</p>
          </motion.div>
        ))}
      </div>

      {/* Mobile: vertical timeline */}
      <ol className="mt-8 md:hidden">
        {steps.map((s, i) => (
          <li key={s.n} className="relative flex gap-4 pb-8 last:pb-0">
            {i < steps.length - 1 && (
              <span className="absolute left-[17px] top-9 h-full w-px bg-line" aria-hidden="true" />
            )}
            <span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-brand-600">
              <Marker kind={KINDS[i % KINDS.length]} />
            </span>
            <div>
              <div className="font-display text-2xl font-500 text-brand-300">{s.n}</div>
              <h3 className="mt-1 text-base font-600 text-ink">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
