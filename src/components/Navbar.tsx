import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { NavLink as RouterNavLink, Link } from 'react-router-dom'
import { NAV_LINKS, BRAND } from '../nav'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../lib/authContext'
import { DURATION, EASE } from '../lib/motion'

/** Never a fully transparent frame — see ENTER_FROM in lib/motion.ts. */
const ENTER_FROM_MENU = 0.55

// Shared top navigation. Sticky, turns solid once the user scrolls.
//
// The account control is not in NAV_LINKS: that list is the site's sections, and
// this one thing depends on who is looking. Signed out it is a quiet "Sign in"
// beside the profile CTA rather than a competing button — an account is optional
// here, and the navbar should not imply otherwise.
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      // Sticky lives on Layout's wrapper now, not here — see the note there.
      className={`transition-colors duration-700 ${
        scrolled ? 'bg-paper/90 backdrop-blur border-b border-line' : 'bg-transparent border-b border-transparent'
      }`}
    >
      {/* No px-6: container-page owns the inline padding and steps it up on
          wide screens (1.5rem -> 2rem -> 2.5rem). This class used to be dead —
          container-page was unlayered and won — so removing it changes nothing
          at laptop widths and stops the header insetting 16px less than the
          page content above 1920px. */}
      <nav className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="font-display text-xl font-600 tracking-tight text-ink">
          {BRAND}<span className="text-brand-500">.</span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.to}>
              <RouterNavLink
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  l.cta
                    ? 'ml-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-500 text-white transition-colors hover:bg-brand-600'
                    : `rounded-full px-3.5 py-2 text-sm font-500 transition-colors ${
                        isActive ? 'text-brand-600' : 'text-slate hover:text-ink'
                      }`
                }
              >
                {l.label}
              </RouterNavLink>
            </li>
          ))}
          {/* Identity sits at the far right, past the sections and the profile
              CTA — it says who you are, it is not another place to go. */}
          <li>
            <AccountLink username={user?.username} />
          </li>
          <li>
            <ThemeToggle className="ml-1" />
          </li>
        </ul>

        {/* Mobile controls */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <span className="text-xl">{open ? '✕' : '☰'}</span>
          </button>
        </div>
      </nav>

      {/* Mobile menu.
          
          It used to be a bare `{open && <ul>}` — the panel appeared and vanished
          between one frame and the next, which on a phone reads as the page
          having jumped rather than a menu having opened. AnimatePresence gives
          it a height and an exit; `mode` is left alone because there is only
          ever one panel.

          height:auto animates a LAYOUT property, which this repo normally
          refuses. It is the exception on purpose: the alternative for a
          variable-length list is a transform that slides the panel out from
          under the header and over the page content, and this menu pushes the
          page down rather than covering it. One element, only on a tap, with
          `overflow: hidden` so nothing spills — not the hundreds-of-cards case
          the rule was written for. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="mobile-menu"
            initial={{ height: 0, opacity: ENTER_FROM_MENU }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: ENTER_FROM_MENU }}
            transition={{ duration: DURATION.quick, ease: EASE.out }}
            className="overflow-hidden md:hidden"
          >
        <ul className="flex flex-col gap-1 border-t border-line bg-paper px-6 py-3 md:hidden">
          {NAV_LINKS.map((l) => (
            <li key={l.to}>
              <RouterNavLink
                to={l.to}
                end={l.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2.5 text-sm font-500 ${
                    l.cta ? 'text-brand-600' : isActive ? 'text-brand-600' : 'text-slate'
                  }`
                }
              >
                {l.label}
              </RouterNavLink>
            </li>
          ))}
          <li>
            <AccountLink username={user?.username} onNavigate={() => setOpen(false)} mobile />
          </li>
        </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

/**
 * "Sign in", or the username of whoever is signed in.
 *
 * One component for both breakpoints because the two versions differ only in
 * their classes, and the interesting part — which of the two states to show — is
 * the part worth having in one place.
 */
function AccountLink({
  username,
  onNavigate,
  mobile = false,
}: {
  username?: string
  onNavigate?: () => void
  mobile?: boolean
}) {
  const base = mobile
    ? 'block rounded-lg px-3 py-2.5 text-sm font-500'
    : 'rounded-full px-3.5 py-2 text-sm font-500 transition-colors'

  return (
    <RouterNavLink
      to={username ? '/profile/account' : '/signin'}
      title={username ? 'Your account' : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${base} ${isActive ? 'text-brand-600' : 'text-slate hover:text-ink'}`
      }
    >
      {/* The @ marks it as a username rather than another section, and the
          truncation stops a 20-character name from shoving the nav around. */}
      {username ? (
        <span className="inline-block max-w-[9rem] truncate align-bottom">@{username}</span>
      ) : (
        'Sign in'
      )}
    </RouterNavLink>
  )
}
