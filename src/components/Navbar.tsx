import { useEffect, useState } from 'react'
import { NavLink as RouterNavLink, Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { NAV_LINKS, BRAND } from '../nav'
import { DUR, EASE, STAGGER } from '../lib/motion'
import ThemeToggle from './ThemeToggle'

// Shared top navigation. Sticky, turns solid once the user scrolls.
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the menu on navigation. Without this it stays open behind the new
  // page when a link is followed by the browser's back/forward buttons.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <header
      // Glass only once scrolled: over the hero it would blur the artwork it is
      // sitting on for no reason, and an unscrolled page has nothing to frost.
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'glass border-x-0 border-t-0' : 'border-b border-transparent bg-transparent'
      }`}
    >
      <nav className="container-page flex h-16 items-center justify-between px-6">
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
                    ? 'ml-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-500 text-white transition-colors duration-150 hover:bg-brand-600'
                    : `relative rounded-full px-3.5 py-2 text-sm font-500 transition-colors duration-150 ${
                        isActive ? 'text-brand-600' : 'text-slate hover:text-ink'
                      }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* One shared pill that slides between links, matching the
                        sliding underline on the program page's tabs. Sits
                        behind the label via -z-10. */}
                    {isActive && !l.cta && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 -z-10 rounded-full bg-brand-50"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    {l.label}
                  </>
                )}
              </RouterNavLink>
            </li>
          ))}
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
            {/* Two bars that cross into an X, rather than swapping ☰ for ✕ —
                a glyph swap has no intermediate state to read. */}
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <motion.line
                x1="4" x2="20"
                animate={open ? { y1: 12, y2: 12, rotate: 45 } : { y1: 8, y2: 8, rotate: 0 }}
                style={{ originX: '12px', originY: '12px' }}
                transition={{ duration: DUR.micro, ease: EASE.out }}
              />
              <motion.line
                x1="4" x2="20"
                animate={open ? { y1: 12, y2: 12, rotate: -45 } : { y1: 16, y2: 16, rotate: 0 }}
                style={{ originX: '12px', originY: '12px' }}
                transition={{ duration: DUR.micro, ease: EASE.out }}
              />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu. AnimatePresence so it animates closed as well as open —
          previously it was `{open && …}`, which unmounted instantly. */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DUR.panel, ease: EASE.out }}
            className="glass overflow-hidden border-x-0 border-b-0 md:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-3">
              {NAV_LINKS.map((l, i) => (
                <motion.li
                  key={l.to}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: DUR.micro, delay: i * STAGGER.tight, ease: EASE.out }}
                >
                  <RouterNavLink
                    to={l.to}
                    end={l.to === '/'}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2.5 text-sm font-500 transition-colors duration-150 ${
                        l.cta ? 'text-brand-600' : isActive ? 'text-brand-600' : 'text-slate'
                      }`
                    }
                  >
                    {l.label}
                  </RouterNavLink>
                </motion.li>
              ))}
            </div>
          </motion.ul>
        )}
      </AnimatePresence>
    </header>
  )
}
