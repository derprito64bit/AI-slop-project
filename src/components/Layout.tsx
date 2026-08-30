import { type ReactNode } from 'react'
import Navbar from './Navbar'
import Footer from './Footer'
import SurveyNudge from './SurveyNudge'
import DemoBanner from './DemoBanner'

// Page shell: shared nav and footer.
//
// Scroll-to-top used to live here on a pathname effect. It moved into
// PageTransition, which runs it when the incoming page mounts — with an exit
// animation, resetting on pathname change scrolled the page you were still
// looking at.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {/* ONE sticky wrapper around both, not two sticky siblings.
          They were `sticky top-0 z-40` and `sticky top-0 z-50` independently,
          so once the page scrolled they pinned to the same line and the nav —
          higher z, and opaque once scrolled — painted straight over the
          banner. The banner exists precisely so nobody can screenshot a view
          without it, and it was invisible on every scrolled screenshot.
          Stacking them in one sticky box keeps the banner above the nav and
          lets it be any height it likes. */}
      <div className="sticky top-0 z-50">
        <DemoBanner />
        <Navbar />
      </div>
      {/* tabIndex={-1} makes this programmatically focusable without putting
          it in the tab order. PageTransition focuses it on every route change,
          and the skip link above finally lands somewhere real. */}
      <main id="main" tabIndex={-1} className="flex-1 focus-visible:outline-none">
        {children}
      </main>
      <Footer />
      {/* Mounted here rather than on a page, so it can appear anywhere the
          student happens to be — and outside <main>, because it is an aside to
          the page rather than part of it. */}
      <SurveyNudge />
    </div>
  )
}
