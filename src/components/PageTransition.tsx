import { useEffect, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { PAGE_ENTER } from '../lib/motion'

// One page's entrance.
//
// There is no exit — see PAGE_ENTER for the measurement that removed it. The
// short version: fading the old page out before bringing the new one in left
// the screen blank for seven frames per navigation.
//
// The scroll reset lives here rather than in Layout on a pathname effect,
// because mounting this component is the moment the NEW page appears, and
// that is exactly when the scroll should move. On a pathname effect it fired
// while the previous page was still on screen and yanked it to the top.
export default function PageTransition({ children }: { children: ReactNode }) {
  useEffect(() => {
    window.scrollTo(0, 0)
    // AND MOVE FOCUS, which this did not do. A keyboard user who activated a
    // nav link was left with focus still in the header, and a screen reader
    // was told nothing at all — the page changed under them silently. Focusing
    // <main> puts the next Tab at the top of the new page and makes the
    // heading the next thing announced.
    //
    // preventScroll because the line above already decided where the page
    // sits; without it the browser scrolls to <main> and fights that.
    // <main> carries tabIndex={-1} (Layout.tsx) purely so this can focus it —
    // which also finally gives the skip link a real target.
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [])

  return (
    <motion.div variants={PAGE_ENTER} initial="initial" animate="animate">
      {children}
    </motion.div>
  )
}
