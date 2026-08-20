import { useEffect, useState } from 'react'
import { NavLink as RouterNavLink, Link } from 'react-router-dom'
import { NAV_LINKS, BRAND } from '../nav'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../lib/authContext'

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
      className={`sticky top-0 z-50 transition-colors duration-700 ${
        scrolled ? 'bg-paper/90 backdrop-blur border-b border-line' : 'bg-transparent border-b border-transparent'
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
          <li>
            <AccountLink username={user?.username} onNavigate={() => setOpen(false)} mobile />
          </li>
        </ul>
      )}
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
