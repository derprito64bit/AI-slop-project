import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import SmoothScroll from './components/SmoothScroll'
import { Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Placeholder from './pages/Placeholder'
import ExplorePreview from './pages/ExplorePreview'
import Program from './pages/Program'
import Survey from './pages/Survey'
import DashboardShell from './pages/dashboard/DashboardShell'
import ListView from './pages/dashboard/ListView'
import BalanceView from './pages/dashboard/BalanceView'
import CoursesView from './pages/dashboard/CoursesView'
import CompareView from './pages/dashboard/CompareView'

// Section pages beyond Home are placeholders for now — each is being
// built on its own branch (feature/explore, feature/program, ...).
export default function App() {
  return (
    <>
      <SmoothScroll />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<ExplorePreview />} />
          {/* Program pages are reached by opening a card, not from the nav.
              The id is `${universityId}::${slug}` — split across two segments
              so the `::` never lands in a URL. */}
          <Route path="/program/:universityId/:slug" element={<Program />} />
          <Route path="/program" element={<Navigate to="/explore" replace />} />
          {/* The survey is the front door to the profile: answer four
              questions, land on /profile with a shortlist. Not in the nav
              during the test — reached from the "Build my profile" CTAs. */}
          <Route path="/survey" element={<Survey />} />
          {/* Each dashboard tool is its own route, not a tab: it can be linked
              to, and the back button steps between tools instead of leaving
              the dashboard. The shell owns the profile and catalogue and
              passes them down through the outlet. */}
          <Route path="/profile" element={<DashboardShell />}>
            <Route index element={<Navigate to="list" replace />} />
            <Route path="list" element={<ListView />} />
            <Route path="balance" element={<BalanceView />} />
            <Route path="courses" element={<CoursesView />} />
            <Route path="compare" element={<CompareView />} />
          </Route>
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
            element={<Placeholder title="Page not found" blurb="That page doesn’t exist yet. Head back home to keep exploring." />}
          />
        </Routes>
      </Layout>
    </>
  )
}
