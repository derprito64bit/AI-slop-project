import { useCallback, useEffect, useRef } from 'react'
import { DURATION, STAGGER_LIMIT, STAGGER_STEP, prefersReducedMotion } from './motion'

// Scroll reveal for long lists, driven by CSS rather than JavaScript.
//
// `<Reveal>` animates from JS, which is right for a heading and wrong for a
// grid: it writes inline styles to every animating element every frame. Measured
// over one scripted scroll of Explore, that cost 565ms of style recalculation
// and 1,104ms of main-thread work; the same scroll with the reveals removed cost
// 18ms and 329ms. Longer, smoother durations made it worse in exact proportion,
// because each card then spends twice as long invalidating style.
//
// This does the same movement with a CSS transition — composited, so the main
// thread does nothing per frame — and a single shared IntersectionObserver
// instead of one per element.
//
// The look is deliberately identical: same 10px rise, same curve, same stagger,
// all read from the same tokens the JS path uses.

/** One observer for every list on the page, not one per card. */
let observer: IntersectionObserver | null = null

function shared(): IntersectionObserver {
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement

        // Promote, then reveal two frames later. Setting the hint in the same
        // frame as the class change is too late — the layer is not ready when
        // the transition starts and the opening frames run on the main thread
        // anyway. Arming here rather than at registration means only elements
        // near the viewport hold a layer, instead of every card on the page.
        el.style.willChange = 'opacity, transform'
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-revealed')))

        // Released as soon as the card has arrived, so the page never holds
        // more layers than it has cards in flight.
        el.addEventListener('transitionend', () => { el.style.willChange = '' }, { once: true })

        // Once revealed, stop watching: these never animate out, and an
        // observer holding hundreds of cards for the life of the page is a
        // leak in everything but name.
        observer?.unobserve(el)
      }
    },
    { rootMargin: '200px 0px -40px 0px' },
  )
  return observer
}

/**
 * Watch one element and reveal it when it scrolls in. Returns a cleanup.
 *
 * The single-element door, for <Reveal>. Explore uses the indexed hook below
 * because it needs the stagger; a section on Home is one element with its own
 * delay already decided by the caller.
 */
export function observeReveal(el: HTMLElement): () => void {
  // Reduced motion: the stylesheet already shows these, there is no transition
  // to run, and no transitionend would ever arrive to release a layer.
  if (prefersReducedMotion()) return () => {}
  shared().observe(el)
  return () => {
    observer?.unobserve(el)
    el.style.willChange = ''
  }
}

/**
 * Ref callback for an item that should reveal as it scrolls in.
 *
 * `index` sets the stagger, capped the same way the JS path caps it — past the
 * limit every item shares the last delay, so card 200 does not wait eighteen
 * seconds for its turn.
 */
export function useRevealOnScroll() {
  const seen = useRef(new Set<Element>())

  useEffect(() => {
    const held = seen.current
    return () => {
      for (const el of held) observer?.unobserve(el)
      held.clear()
    }
  }, [])

  return useCallback((index: number) => (el: HTMLElement | null) => {
    if (!el || seen.current.has(el)) return
    seen.current.add(el)
    el.style.setProperty('--reveal-delay', `${Math.min(index, STAGGER_LIMIT) * STAGGER_STEP}s`)
    el.style.setProperty('--reveal-duration', `${DURATION.reveal}s`)
    if (prefersReducedMotion()) return
    shared().observe(el)
  }, [])
}
