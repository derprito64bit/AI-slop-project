// Single source of truth for the site's navigation.
// Add/rename a page here and it updates the navbar everywhere.
export type NavLink = { label: string; to: string; cta?: boolean }

export const NAV_LINKS: NavLink[] = [
  { label: 'Home', to: '/' },
  { label: 'Explore', to: '/explore' },
  // No "Program" entry: a program page is reached by opening a card in
  // Explore, so it isn't a standalone destination.
  //
  // No "Community" or "About" either. They were two top-level destinations
  // arguing the same point from opposite ends — About claimed "we never tell
  // you your chances", Community showed the 93% offer share that is the reason
  // — and a student had to find both to get either. They are now one dashboard
  // tool, /profile/database, and the old URLs redirect to it.
  { label: 'My Profile', to: '/profile', cta: true },
]

// Working product name (placeholder — easy to change later).
export const BRAND = 'Acceptiversity'
