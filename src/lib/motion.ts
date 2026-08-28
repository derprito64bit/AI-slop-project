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
// Everything here was lengthened by about a third on 2026-08-19: the site was
// technically correct and felt clipped, because motion that finishes before the
// eye has followed it reads as a jump rather than a movement. These are the
// numbers to change if it ever needs to go further either way — the components
// import them rather than carrying their own.
export const DURATION = {
  /** hovers, chips, colour changes */
  instant: 0.3,
  /** a card, a tooltip, a nudge */
  quick: 0.45,
  /** the standard: reveals, tab changes */
  base: 0.6,
  /** page entrance */
  page: 0.6,
  /** the scroll reveal already in use */
  reveal: 0.85,
  /** a chart drawing itself — the one place a longer take is the point */
  slow: 1.0,
  /**
   * A hover, a press, a highlight.
   *
   * Separate from `instant` because 0.3s is the TOP of the micro-interaction
   * band, and hovers were not even getting that: every chart had its hover
   * highlight inside the same `animate` object as its entrance, so hovering a
   * histogram bar ran at `slow` (1.0s) plus up to 0.5s of stagger delay, and
   * the fourth segment of the decision mix began responding 270ms after the
   * pointer arrived. Every rule source puts this band at 150-300ms.
   */
  hover: 0.18,
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
// THE CURVE MATTERS AS MUCH AS THE DURATION, and it is the part that was
// actually making this feel snappy. The old `out` was [0.22, 1, 0.36, 1] — a
// quintic ease-out, which spends most of its travel in the first fifth of the
// time and then creeps. Lengthening it did not help much: the movement still
// happened in a burst, it just took longer to finish creeping afterwards.
//
// These are gentler curves. They start slower and distribute the movement more
// evenly, which is what "smooth" actually describes — the eye can follow the
// whole thing rather than catching the end of it.
export const EASE = {
  /** easeOutCubic — gentle onset, long even settle */
  out: [0.33, 1, 0.68, 1],
  /** easeInOutSine — both ends soft, for things that leave and arrive */
  inOut: [0.37, 0, 0.63, 1],
  in: [0.5, 0, 0.75, 0],
} as const

/**
 * Springs are softened rather than slowed — a spring has no duration to raise.
 * Lower stiffness with the damping roughly held gives a longer, looser settle
 * and keeps the overshoot that makes a pin read as landing rather than
 * appearing.
 */
export const SPRING = {
  /** a pin planting itself: visible overshoot, then settles */
  pin: { type: 'spring', stiffness: 170, damping: 17, mass: 1 },
  /** a panel arriving: barely any overshoot */
  panel: { type: 'spring', stiffness: 130, damping: 22 },
  /** the tab underline sliding between tabs */
  tab: { type: 'spring', stiffness: 190, damping: 26 },
} as const satisfies Record<string, Transition>

/* --------------------------------------------------------------- page --- */

/**
 * The opacity an arriving view starts at — NOT zero, and that is the whole
 * fix for the flashing.
 *
 * Measured with a per-frame probe (.shots/flash-probe.mjs): switching a
 * dashboard tool with `initial: { opacity: 0 }` put five consecutive frames on
 * screen at essentially zero opacity, and a page navigation put seven there.
 * At 60fps that is an eighth of a second of blank column on every click. It
 * reads as a blink, because it IS one — the eye sees content, nothing, then
 * content again.
 *
 * Removing the exit animation was not enough on its own: it stops the
 * OUTGOING view fading away, but an incoming view starting from zero leaves
 * exactly the same hole. Starting at 0.55 means the new content is legible
 * from its very first frame and merely settles into place, so there is no
 * frame anywhere in the transition where the column is empty or dark.
 *
 * The perceived motion now comes mostly from the few pixels of travel rather
 * than from the fade, which is also what makes it read as an arrival instead
 * of a light being switched on.
 */
const ENTER_FROM = 0.55

/**
 * Route transitions. Enter only, for the same reason as VIEW_ENTER below.
 *
 * The first version faded the outgoing page out over 180ms and only then
 * brought the next one in. Measured across a Home -> Explore navigation, that
 * left SEVEN consecutive frames at an opacity of essentially zero — an eighth
 * of a second of blank page on every single click. That is the flash. It is
 * not a slow animation; it is a hole in the middle of one.
 *
 * Dropping the exit means the outgoing page is replaced immediately and the
 * incoming one eases up over it. Nothing is ever invisible.
 *
 * The y offset stays tiny. Anything past ~8px on a whole page turns into a
 * visible slide, and a slide on every navigation is the kind of motion that
 * gets annoying by the fifth click.
 */
export const PAGE_ENTER: Variants = {
  initial: { opacity: ENTER_FROM, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.page, ease: EASE.out },
  },
}

/**
 * Switching tools inside the dashboard.
 *
 * ENTER ONLY — there is deliberately no exit here, and that is the whole
 * point. The first version faded the outgoing view to opacity 0, waited for
 * it to finish, unmounted it, then faded the new one in. Between those two
 * halves the main column held nothing at all: the page height collapsed to
 * the chrome, the footer jumped up, and the whole thing read as a flash
 * rather than a transition. A cross-fade through zero is a blink.
 *
 * With no exit the outgoing view is replaced on the spot and the incoming one
 * eases up into place, so there is never a frame with an empty column.
 *
 * The 6px lift matters more than it looks. Opacity alone changes only
 * brightness, which the eye reads as a flicker; a small movement gives the
 * change a direction and turns it into an arrival.
 */
export const VIEW_ENTER: Variants = {
  initial: { opacity: ENTER_FROM, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE.out },
  },
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
export const STAGGER_STEP = 0.09

/** Delay for the nth item in a staggered list, flattening past the cap. */
export function staggerDelay(index: number): number {
  return Math.min(index, STAGGER_LIMIT) * STAGGER_STEP
}

/**
 * Per-mark delay inside one chart, seconds.
 *
 * Tighter than `STAGGER_STEP`, and capped harder, because a chart's marks are
 * one object rather than a list of separate arrivals — a 20-bucket histogram
 * staggered at 0.09 would take 1.8s to finish drawing. The motion table's list
 * guidance is 0.02-0.04s per item for anything longer than ten, and never more
 * than 0.1s; this sits inside that.
 *
 * Every chart used to carry its own number: 0.015, 0.035, 0.04, 0.08 and 0.09
 * across five components, none of them from here.
 */
export const CHART_STAGGER = 0.035

/** Total stagger a chart may spend before the last mark starts. */
const CHART_STAGGER_CAP = 0.35

/** Delay for the nth mark in a chart, flattening once the cap is reached. */
export function chartDelay(index: number): number {
  return Math.min(index * CHART_STAGGER, CHART_STAGGER_CAP)
}

/* -------------------------------------------------------------- steps --- */

/**
 * Survey steps: the outgoing question leaves the way you are travelling and
 * the incoming one arrives from the other side, so Back visibly reverses.
 * `custom` is the direction: 1 forward, -1 back.
 *
 * This one keeps its exit, unlike the two above, because the steps must not
 * overlap — two questions in the DOM at once would stack and double the
 * card's height. But neither end goes to zero: the question slides out at
 * ENTER_FROM and the next slides in at ENTER_FROM, so the handover happens
 * between two legible frames rather than through an empty card. Measured at
 * seven blank frames before this.
 *
 * The movement carries the meaning here; the opacity is only there to soften
 * the swap.
 */
export const STEP_VARIANTS: Variants = {
  initial: (dir: number) => ({ opacity: ENTER_FROM, x: dir * 24 }),
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.base, ease: EASE.out },
  },
  exit: (dir: number) => ({
    opacity: ENTER_FROM,
    x: dir * -24,
    // Faster than the entrance: the question you have answered should be out
    // of the way before you notice you are waiting for it.
    transition: { duration: DURATION.instant, ease: EASE.in },
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
