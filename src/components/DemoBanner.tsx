import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { DURATION, EASE, SPRING } from '../lib/motion'
import { clearDemo, isDemoActive, maybeSeedDemo, type DemoResult } from '../lib/demo'

// Says, on screen, that the data is made up.
//
// A demo that looks exactly like the real thing is how a screenshot of invented
// numbers ends up somewhere it should not be. This site's whole argument is that
// its numbers are real, so the one state where they are not has to announce
// itself — and stay announced, not fade after three seconds.
//
// The programs and medians ARE real; the student is not. That distinction is
// what the wording has to carry.
export default function DemoBanner() {
  const { search, pathname } = useLocation()
  const [result, setResult] = useState<DemoResult>('not-requested')
  const [active, setActive] = useState(false)

  useEffect(() => {
    const outcome = maybeSeedDemo(search)
    if (outcome === 'seeded') {
      // The dashboard reads the profile when it mounts, so a seed that lands
      // afterwards would show an empty dashboard until something forced a
      // re-read. Reloading once is cruder than threading state through the
      // whole tree, and it is the only moment it happens.
      window.location.replace(pathname)
      return
    }
    setResult(outcome)
    setActive(isDemoActive())
  }, [search, pathname])

  const refused = result === 'refused-real-profile'
  if (!active && !refused) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0, transition: SPRING.panel }}
        exit={{ opacity: 0, transition: { duration: DURATION.quick, ease: EASE.in } }}
        className="sticky top-0 z-40 border-b border-accent/40 bg-accent/10 px-6 py-2"
        role="status"
      >
        <div className="container-page flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
          {refused ? (
            <span className="text-ink">
              <strong className="font-600">Demo not loaded.</strong> There is already a profile on
              this device, and it was left alone.
            </span>
          ) : (
            <span className="text-ink">
              <strong className="font-600">Demo data.</strong> The programs and the reported
              averages are real; the student is invented.
            </span>
          )}
          {active && (
            <button
              type="button"
              onClick={() => {
                clearDemo()
                window.location.replace(pathname)
              }}
              className="font-600 text-brand-600 underline-offset-2 hover:underline"
            >
              Clear demo data
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
