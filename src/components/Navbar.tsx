import { useEffect, useState } from 'react'
import { NavLink as RouterNavLink, Link } from 'react-router-dom'
import { NAV_LINKS, BRAND } from '../nav'
import ThemeToggle from './ThemeToggle'

// Shared top navigation. Sticky, turns solid once the user scrolls.
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-paper/90 backdrop-blur border-b border-line' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
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

      {/* Mobile menu */}
      {open && (
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
        </ul>
      )}
    </header>
  )
}
