import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { SPRING, DURATION, EASE } from '../lib/motion'
import { loadProfile } from '../lib/profile'
import { useAuth } from '../lib/authContext'
import { STEPS } from '../pages/Survey'
import SUMMARY from '../data/generated/summary.json'

// The card that offers the survey once a student is actually looking around.
//
// It is not a redirect and not a modal. A first-time visitor who is dropped
// straight into a questionnaire has been asked to invest before being shown
// anything worth investing in; they leave. So the site opens normally and this
// arrives later, offering both doors — take the questions, or carry on.
//
// TRIGGERED BY ENGAGEMENT, NOT A TIMER. Two program pages is a student
// comparing options; 45 seconds plus real scrolling is a student reading. A
// bare timer would also fire on someone who opened a tab and walked away, and
// on the visitor who is still deciding whether this site is worth anything.
//
// Shown at most once, ever:
//  - never when a profile already exists (they have answered, or they have
//    started keeping programs, so the offer is noise)
//  - never again after being dismissed, across reloads and sessions
//  - never on /survey or /profile, where it would be pointing at the page you
//    are already on

const DISMISSED_KEY = 'acceptiversity.nudge.dismissed'
// v2: holds the program paths seen, pipe-separated. v1 held a bare count,
// which double-counted under React's development double-invoke.
const SEEN_PROGRAMS_KEY = 'acceptiversity.nudge.programs.v2'

/** Program pages viewed before the card is offered. */
export const PROGRAMS_BEFORE = 2
/** Or this long on the site, if there has also been real scrolling. */
export const DWELL_MS = 45_000
/** "Real scrolling" — about a screen and a half, so a nudge does not count. */
export const SCROLL_PX = 900

/**
 * The whole trigger rule, as one pure function.
 *
 * Reading it top to bottom is the point: the two suppressions come first and
 * can never be overridden by engagement, then either path may open the card.
 */
export function shouldOffer(state: {
  dismissed: boolean
  hasProfile: boolean
  programsSeen: number
  dwellReached: boolean
  scrolledPx: number
}): boolean {
  if (state.dismissed || state.hasProfile) return false
  if (state.programsSeen >= PROGRAMS_BEFORE) return true
  return state.dwellReached && state.scrolledPx >= SCROLL_PX
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — the card simply does not persist its state */
  }
}

/**
 * The two suppressions, read fresh from storage.
 *
 * Re-read rather than cached, because a profile can come into existence while
 * the page is open — keeping a program from Explore is enough — and someone
 * who has just started a list should not then be asked to start one.
 */
function suppressions() {
  return { dismissed: read(DISMISSED_KEY) === '1', hasProfile: loadProfile() !== null }
}

export default function SurveyNudge() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const signedIn = Boolean(user)
  const [visible, setVisible] = useState(false)

  // Count program pages across the visit. Stored rather than held in state so
  // it survives a reload — a student who read three program pages yesterday
  // and comes back is exactly who this is for.
  useEffect(() => {
    if (!pathname.startsWith('/program/')) return

    // DISTINCT programs, not page views. Two reasons, and the second is the one
    // that bites: "looked at two programs" should mean two different ones —
    // reloading Waterloo CS twice is not comparing options — and counting views
    // made the effect non-idempotent, so React's development double-invoke
    // counted every page twice and the card appeared after one.
    const seen = new Set((read(SEEN_PROGRAMS_KEY) ?? '').split('|').filter(Boolean))
    seen.add(pathname)
    // Bounded: this is a threshold check, and an unbounded list of every
    // program a student ever opened would grow forever for no gain.
    const trimmed = [...seen].slice(-PROGRAMS_BEFORE * 2)
    write(SEEN_PROGRAMS_KEY, trimmed.join('|'))

    if (shouldOffer({ ...suppressions(), programsSeen: seen.size, dwellReached: false, scrolledPx: 0 })) {
      setVisible(true)
    }
  }, [pathname])

  // The dwell path: enough time AND enough scrolling.
  useEffect(() => {
    if (visible) return

    let scrolledPx = 0
    let last = window.scrollY
    const onScroll = () => {
      scrolledPx += Math.abs(window.scrollY - last)
      last = window.scrollY
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    const timer = setTimeout(() => {
      if (shouldOffer({ ...suppressions(), programsSeen: 0, dwellReached: true, scrolledPx })) {
        setVisible(true)
      }
    }, DWELL_MS)

    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(timer)
    }
  }, [visible])

  const dismiss = () => {
    write(DISMISSED_KEY, '1')
    setVisible(false)
  }

  const accept = () => {
    // Not marked dismissed: if they abandon the survey we have still had our
    // answer, and the card will not reappear anyway once a profile exists.
    setVisible(false)
    navigate('/survey')
  }

  // Pointless on the pages it would be advertising.
  const onOwnPage = pathname.startsWith('/survey') || pathname.startsWith('/profile')

  return (
    <AnimatePresence>
      {visible && !onOwnPage && (
        <motion.div
          // Non-modal on purpose: no focus trap, no overlay, nothing to escape
          // from. It is an offer sitting in the corner, and the page behind it
          // stays fully usable.
          role="dialog"
          aria-label="Build your profile"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING.panel }}
          exit={{ opacity: 0, y: 12, transition: { duration: DURATION.quick, ease: EASE.in } }}
          className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-paper p-5 shadow-[0_18px_50px_rgba(20,24,31,0.16)]"
        >
          <p className="font-display text-lg font-600 leading-snug text-ink">
            Want this narrowed down?
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            {STEPS.length} quick questions — every one skippable — and we&rsquo;ll cut{' '}
            {SUMMARY.programs.toLocaleString()} programs down to a shortlist worth your time.{' '}
            {/* This said "Nothing leaves your device" unconditionally, and
                shouldOffer never consults sign-in — so the one reader most
                likely to see it, a signed-in student on a new device with no
                local profile yet, was told the opposite of what happens. */}
            {signedIn
              ? 'Your answers save to your account, so they follow you to another device.'
              : 'Nothing leaves your device while you’re signed out.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={accept}
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-600 text-white transition-colors hover:bg-brand-600"
            >
              Answer the questions
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full px-3 py-2 text-sm text-slate transition-colors hover:text-ink"
            >
              Not now, keep exploring
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
