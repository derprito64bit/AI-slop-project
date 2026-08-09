import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Layout from './components/Layout'
import SmoothScroll from './components/SmoothScroll'
import { Navigate } from 'react-router-dom'
import { routeTransition } from './lib/motion'
import Home from './pages/Home'
import Placeholder from './pages/Placeholder'
import ExplorePreview from './pages/ExplorePreview'
import Program from './pages/Program'

// Section pages beyond Home are placeholders for now — each is being
// built on its own branch (feature/explore, feature/program, ...).
export default function App() {
  const location = useLocation()

  return (
    <>
      <SmoothScroll />
      <Layout>
        {/*
          mode="wait" so the outgoing page clears before the next arrives —
          crossfading two pages of different heights makes the scrollbar jump.
          Routes is keyed on pathname (not location) so a ?q= change on Explore
          updates in place instead of replaying the transition on every keystroke.
        */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={routeTransition.initial}
            animate={routeTransition.animate}
            exit={routeTransition.exit}
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/explore" element={<ExplorePreview />} />
              {/* Program pages are reached by opening a card, not from the nav.
                  The id is `${universityId}::${slug}` — split across two segments
                  so the `::` never lands in a URL. */}
              <Route path="/program/:universityId/:slug" element={<Program />} />
              <Route path="/program" element={<Navigate to="/explore" replace />} />
              <Route
                path="/profile"
                element={<Placeholder title="My Profile" blurb="Build your profile and get matched programs with your real admission odds." />}
              />
              <Route
                path="/community"
                element={<Placeholder title="Community stats" blurb="See real admitted-student stats and share your own results." />}
              />
              <Route
                path="/about"
                element={<Placeholder title="About & methodology" blurb="Where our data comes from and how we calculate your odds." />}
              />
                  <Route
                    path="*"
                    element={
                      <Placeholder
                        // Not "coming together" — this route means the address is
                        // wrong, not that the page is being built.
                        eyebrow="Lost"
                        title="Page not found"
                        blurb="That address doesn’t match anything on the site. It may have been mistyped, or a program may have been renamed as the data was cleaned up."
                      />
                    }
                  />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Layout>
    </>
  )
}
