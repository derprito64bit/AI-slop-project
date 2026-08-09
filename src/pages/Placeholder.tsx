import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { DUR, EASE, STAGGER } from '../lib/motion'

// Temporary page for sections not yet built, and the 404 route.
//
// `eyebrow` defaults to the "being built" framing, but 404 overrides it — a
// page that does not exist is not the same as one that is coming, and the old
// shared "Coming together" heading told people to wait for a URL that will
// never arrive.
export default function Placeholder({
  title,
  blurb,
  eyebrow = 'Coming together',
}: {
  title: string
  blurb: string
  eyebrow?: string
}) {
  const [params] = useSearchParams()
  const q = params.get('q')

  // Small local stagger so the stub pages arrive the same way real ones do,
  // rather than snapping in as a block.
  const item = (i: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: DUR.enter, delay: i * STAGGER.list, ease: EASE.out },
  })

  return (
    <section className="mx-auto max-w-3xl px-6 py-28 text-center">
      <motion.p
        {...item(0)}
        className="text-sm font-500 uppercase tracking-wider text-brand-500"
      >
        {eyebrow}
      </motion.p>
      <motion.h1 {...item(1)} className="mt-3 font-display text-4xl font-600 text-ink">
        {title}
      </motion.h1>
      <motion.p {...item(2)} className="mx-auto mt-4 max-w-xl text-slate">
        {blurb}
      </motion.p>
      {q && (
        <motion.p
          {...item(3)}
          className="mx-auto mt-4 inline-block rounded-full border border-line bg-cloud px-4 py-2 text-sm text-ink"
        >
          Searching for: <span className="font-600 text-brand-600">{q}</span>
        </motion.p>
      )}
      <motion.div {...item(4)}>
        <Link
          to="/"
          className="mt-8 inline-block rounded-full border border-line px-5 py-2.5 text-sm font-500 text-ink transition-colors duration-150 hover:border-brand-300 hover:text-brand-600"
        >
          ← Back home
        </Link>
      </motion.div>
    </section>
  )
}
