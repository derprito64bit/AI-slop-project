// Motion tokens — one place for every duration, easing and variant on the site.
//
// Values follow the ui-ux-pro-max motion table, the same source Reveal.tsx
// already cites. They live here rather than inline in components so the whole
// site can be re-timed from one file, and so "how long does a page take to come
// in" is a question with an answer rather than a search.
//
// Reduced motion is NOT handled here. `<MotionConfig reducedMotion="user">` in
// main.tsx makes the motion library drop transform/layout animation globally
// while keeping opacity, so every variant below degrades to a plain fade
// without any component needing to know. Anything that must be *skipped*
// entirely under reduced motion (the first-load loader) checks
// `prefersReducedMotion()` explicitly.

import type { Transition, Variants } from 'motion/react'

/** Seconds. Named for what they are used on, not their length. */
export const DURATION = {
  /** hovers, chips, colour changes */
  instant: 0.15,
  /** a card, a tooltip, a nudge */
  quick: 0.2,
  /** the standard: reveals, tab changes */
  base: 0.26,
  /** page entrance */
  page: 0.26,
  /** page exit — deliberately shorter than entrance, see PAGE_VARIANTS */
  pageOut: 0.18,
  /** the scroll reveal already in use */
  reveal: 0.4,
} as const

/**
 * Easings.
 *
 * `out` is the workhorse: fast start, soft landing, which is what makes an
 * entrance feel like it arrived rather than drifted. `inOut` is for things that
 * both leave and enter. `spring` is only for objects that should feel physical
 * — the roadmap pins and the nudge card — never for text blocks, where
 * overshoot reads as a wobble.
 */
export const EASE = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
  in: [0.55, 0, 1, 0.45],
} as const

export const SPRING = {
  /** a pin planting itself: visible overshoot, settles fast */
  pin: { type: 'spring', stiffness: 420, damping: 18, mass: 0.7 },
  /** a panel arriving: barely any overshoot */
  panel: { type: 'spring', stiffness: 300, damping: 26 },
} as const satisfies Record<string, Transition>

/* --------------------------------------------------------------- page --- */

/**
 * Route transitions.
 *
 * Exit is shorter than entrance on purpose. When both are equal, Back feels
 * sluggish: you have already decided to leave, so waiting out a full-length
 * exit reads as lag. 260 in / 180 out is the ratio that stopped it feeling
 * slow while still being visible.
 *
 * The y offset is tiny. Anything larger than ~8px on a whole page turns into a
 * visible slide, and a slide on every navigation is exactly the kind of motion
 * that gets annoying by the fifth click.
 */
export const PAGE_VARIANTS: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.page, ease: EASE.out },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: DURATION.pageOut, ease: EASE.in },
  },
}

/** Switching tools inside the dashboard: cross-fade only. */
export const VIEW_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.quick, ease: EASE.out } },
  exit: { opacity: 0, transition: { duration: DURATION.instant, ease: EASE.in } },
}

/* ------------------------------------------------------------ stagger --- */

/**
 * How many children may stagger before the list starts feeling like a queue.
 *
 * The motion table caps it at ~8. Explore pages to hundreds of cards, so the
 * first 8 stagger and everything after them fades in as one group — otherwise
 * card 60 would wait 4.8s for its turn.
 */
export const STAGGER_LIMIT = 8

/** Per-child delay, seconds. */
export const STAGGER_STEP = 0.05

/** Delay for the nth item in a staggered list, flattening past the cap. */
export function staggerDelay(index: number): number {
  return Math.min(index, STAGGER_LIMIT) * STAGGER_STEP
}

/* -------------------------------------------------------------- steps --- */

/**
 * Survey steps: the outgoing question leaves the way you are travelling and
 * the incoming one arrives from the other side, so Back visibly reverses.
 * `custom` is the direction: 1 forward, -1 back.
 */
export const STEP_VARIANTS: Variants = {
  initial: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.base, ease: EASE.out },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -24,
    transition: { duration: DURATION.quick, ease: EASE.in },
  }),
}

/* --------------------------------------------------------------- misc --- */

/**
 * Does this device ask for less motion?
 *
 * Only for the few decisions the motion library cannot make for us — chiefly
 * whether to show the first-load loader at all. Everything else should rely on
 * MotionConfig instead of branching.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
