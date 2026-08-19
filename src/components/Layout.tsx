import { type ReactNode } from 'react'
import Navbar from './Navbar'
import Footer from './Footer'
import SurveyNudge from './SurveyNudge'

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
      <Navbar />
      <main id="main" className="flex-1">
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
