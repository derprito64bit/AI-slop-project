import { type ReactNode } from 'react'
import { motion } from 'motion/react'
import { DURATION, EASE } from '../lib/motion'

// Reusable scroll-triggered reveal. Children fade + rise into view once,
// as they enter the viewport. Respects reduced-motion (motion handles it).
type RevealProps = {
  children: ReactNode
  /** stagger delay in seconds */
  delay?: number
  /** how far it travels up, px */
  y?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'span'
}

// Defaults follow the ui-ux-pro-max motion table, Scroll Reveal / Subtle,
// lengthened once the whole site was found to read as clipped. The duration is
// DURATION.reveal so this moves with everything else: and "keep the y offset small (8-16px) so it reads as a fade, not a
// slide". The previous 600ms at y=24 was the main source of the site feeling
// sluggish — every section made you wait out a visible slide.
export default function Reveal({ children, delay = 0, y = 12, className, as = 'div' }: RevealProps) {
  const MotionTag = motion[as]
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: DURATION.reveal, delay, ease: EASE.out }}
    >
      {children}
    </MotionTag>
  )
}
