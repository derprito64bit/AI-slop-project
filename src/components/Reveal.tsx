import { type ReactNode } from 'react'
import { motion } from 'motion/react'

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

export default function Reveal({ children, delay = 0, y = 24, className, as = 'div' }: RevealProps) {
  const MotionTag = motion[as]
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  )
}
