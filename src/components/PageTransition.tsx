import { useEffect, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { PAGE_VARIANTS } from '../lib/motion'

// One page's entrance and exit.
//
// The scroll reset lives here rather than in Layout, on a pathname effect.
// That mattered: with an exit animation, the outgoing page is still on screen
// while it fades, so resetting scroll on pathname change yanked the page you
// were leaving back to the top before it had gone. Mounting this component is
// the moment the NEW page appears, which is exactly when the scroll should
// move — AnimatePresence mode="wait" guarantees the old one has finished by
// then.
export default function PageTransition({ children }: { children: ReactNode }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <motion.div variants={PAGE_VARIANTS} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  )
}
