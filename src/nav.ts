// Single source of truth for the site's navigation.
// Add/rename a page here and it updates the navbar everywhere.
export type NavLink = { label: string; to: string; cta?: boolean }

export const NAV_LINKS: NavLink[] = [
  { label: 'Home', to: '/' },
  { label: 'Explore', to: '/explore' },
  { label: 'Program', to: '/program' },
  { label: 'Community', to: '/community' },
  { label: 'About', to: '/about' },
  { label: 'My Profile', to: '/profile', cta: true },
]

// Working product name (placeholder — easy to change later).
export const BRAND = 'GOON'
