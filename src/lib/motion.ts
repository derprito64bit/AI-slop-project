// Shared motion vocabulary.
//
// Before this existed the same cubic-bezier was pasted 14 times and hover
// transitions ran at 150, 200, 300 and 500ms with no rule behind which was
// which. Values follow the tiers in the ui-ux-pro-max motion table
// (~/.claude/skills/ui-ux-pro-max/data/motion.csv) rather than taste, so
// "make it snappier" has a number to change instead of a search-and-replace.
//
// Import these instead of writing literals.

/** Standard easing. `out` for things arriving, `inOut` for things moving. */
export const EASE = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
}

export const DUR = {
  /** Hover, focus, toggles. Motion table: micro-interactions 150-200ms. */
  micro: 0.15,
  /** Panels, dropdowns, tab bodies. */
  panel: 0.2,
  /** Page and section entrances. Scroll Reveal / Subtle is 300-400ms. */
  enter: 0.4,
  /**
   * Route exits. Deliberately shorter than `enter`: the Page Transition row
   * says exit must resolve faster than entrance so back/forward feels snappy,
   * and caps exit at ~250ms so navigation never feels blocked.
   */
  exit: 0.18,
  /** Chart draws — long enough to read the shape being built. */
  draw: 0.45,
}

export const STAGGER = {
  /** Dense lists (dropdown rows, legend items). */
  tight: 0.03,
  /**
   * Card grids and sections. The motion table warns against exceeding 0.1s per
   * item, and against staggering more than ~8 children — past that the last
   * items feel laggy, so cap the count at the call site.
   */
  list: 0.04,
  /** Never stagger more children than this; fade the rest in as a group. */
  maxChildren: 8,
}

/** Entrance used by page shells and section reveals. */
export const enter = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.enter, ease: EASE.out },
}

/**
 * Route-level transition. `y` stays small: a page that slides far reads as slow
 * even when the number is short.
 */
export const routeTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.enter, ease: EASE.out } },
  exit: { opacity: 0, y: -4, transition: { duration: DUR.exit, ease: EASE.out } },
}
