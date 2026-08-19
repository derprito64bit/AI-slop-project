import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { DURATION, EASE, prefersReducedMotion } from '../lib/motion'
import { BRAND } from '../nav'

// The brand loader, shown once per session on the very first paint.
//
// Three rules keep it from becoming the thing that makes the site feel slow:
//
//  1. ONCE PER SESSION. sessionStorage, not localStorage — a returning visitor
//     tomorrow should get it again (it is the front door), but clicking around
//     for twenty minutes must never show it twice.
//  2. HARD CAP. It always leaves after MAX_MS whether or not anything is
//     "ready". It is a curtain, not a progress bar; nothing waits on it.
//  3. SKIPPED ENTIRELY under reduced motion. Not shortened — skipped. Someone
//     who asked for less motion should not be held behind a full-screen
//     animation at all.
//
// It is also purely an overlay: the page underneath renders and hydrates
// normally the whole time, so this never delays real content.

const SESSION_KEY = 'acceptiversity.loader.seen'
const MAX_MS = 800

function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    // Private mode with storage disabled: show it, once, and move on.
    return false
  }
}

function markSeen(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* not worth failing over */
  }
}

export default function FirstLoad() {
  // Decided during the first render, not in an effect, so the loader is
  // already on screen for the first paint rather than flashing in after it.
  const [visible, setVisible] = useState(() => !alreadySeen() && !prefersReducedMotion())

  useEffect(() => {
    if (!visible) return
    markSeen()
    const timer = setTimeout(() => setVisible(false), MAX_MS)
    return () => clearTimeout(timer)
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="first-load"
          // aria-hidden: the page beneath is the real content and is already
          // announced. A screen reader should never be told to wait.
          aria-hidden="true"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: DURATION.base, ease: EASE.out } }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-paper"
        >
          <div className="flex flex-col items-center gap-5">
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.base, ease: EASE.out }}
              className="font-display text-2xl font-600 tracking-tight text-ink"
            >
              {BRAND}
            </motion.span>
            {/* A determinate sweep, not a spinner: it is capped at 800ms, so a
                bar that visibly completes is honest about the wait ending. */}
            <span className="block h-px w-32 overflow-hidden bg-line">
              <motion.span
                className="block h-full bg-brand-500"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: MAX_MS / 1000, ease: EASE.inOut }}
                style={{ transformOrigin: 'left' }}
              />
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
