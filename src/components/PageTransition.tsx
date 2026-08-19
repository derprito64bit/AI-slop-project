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
  }, [])

  return (
    <motion.div variants={PAGE_ENTER} initial="initial" animate="animate">
      {children}
    </motion.div>
  )
}
