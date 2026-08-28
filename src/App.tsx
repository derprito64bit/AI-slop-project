import { Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import SmoothScroll from './components/SmoothScroll'
import FirstLoad from './components/FirstLoad'
import PageTransition from './components/PageTransition'
import { Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Placeholder from './pages/Placeholder'
import ExplorePreview from './pages/ExplorePreview'
import Program from './pages/Program'
import Survey from './pages/Survey'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import DashboardShell from './pages/dashboard/DashboardShell'
import AccountView from './pages/dashboard/AccountView'
import OverviewView from './pages/dashboard/OverviewView'
import ListView from './pages/dashboard/ListView'
import BalanceView from './pages/dashboard/BalanceView'
import CoursesView from './pages/dashboard/CoursesView'
import CompareView from './pages/dashboard/CompareView'
import ProgramsView from './pages/dashboard/ProgramsView'
import FieldsView from './pages/dashboard/FieldsView'
import MapView from './pages/dashboard/MapView'
import ApplicationsView from './pages/dashboard/ApplicationsView'
import DeadlinesView from './pages/dashboard/DeadlinesView'
import DatabaseView from './pages/dashboard/DatabaseView'
import AdminShell from './pages/admin/AdminShell'

/**
 * The key that decides when a page transition fires.
 *
 * Not the raw pathname. Every dashboard tool is its own route, so keying on
 * the pathname would unmount the whole shell when you moved from My list to
 * Balance — throwing away the loaded catalogue and refetching ~950kB to switch
 * tabs. The shell stays mounted and animates its own views instead; from out
 * here the entire dashboard is one destination.
 */
function sectionKey(pathname: string): string {
  return pathname.startsWith('/profile') ? '/profile' : pathname
}

// Section pages beyond Home are placeholders for now — each is being
// built on its own branch (feature/explore, feature/program, ...).
export default function App() {
  const location = useLocation()

  return (
    <>
      <SmoothScroll />
      <FirstLoad />
      <Layout>
        {/* No AnimatePresence. It was here with mode="wait", which is what
            produced the blink: the outgoing page had to finish fading to zero
            before the incoming one was allowed to mount, so every navigation
            passed through a blank screen. The new page now replaces the old
            one immediately and eases in. The key is what replays that
            entrance. */}
        <PageTransition key={sectionKey(location.pathname)}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/explore" element={<ExplorePreview />} />
              {/* Program pages are reached by opening a card, not from the nav.
                  The id is `${universityId}::${slug}` — split across two segments
                  so the `::` never lands in a URL. */}
              <Route path="/program/:universityId/:slug" element={<Program />} />
              <Route path="/program" element={<Navigate to="/explore" replace />} />
              {/* The survey is the front door to the profile: answer four
                  questions, land on /profile with a shortlist. Not in the nav
                  during the test — reached from the "Build my profile" CTAs and
                  from the nudge card. */}
              <Route path="/survey" element={<Survey />} />
              {/* Accounts are optional and always have been the second door:
                  every route above works signed out, and nothing redirects here.
                  An account decides *whose* profile the dashboard reads, not
                  whether there is one. */}
              <Route path="/signup" element={<SignUp />} />
              <Route path="/signin" element={<SignIn />} />
              {/* Each dashboard tool is its own route, not a tab: it can be linked
                  to, and the back button steps between tools instead of leaving
                  the dashboard. The shell owns the profile and catalogue and
                  passes them down through the outlet. */}
              <Route path="/profile" element={<DashboardShell />}>
                {/* The index is a real page now, not a redirect to My list —
                    the dashboard needs a front door that answers "where am I
                    with all this?" before dropping you into one tool. */}
                <Route index element={<OverviewView />} />
                <Route path="list" element={<ListView />} />
                <Route path="balance" element={<BalanceView />} />
                <Route path="courses" element={<CoursesView />} />
                <Route path="compare" element={<CompareView />} />
                <Route path="programs" element={<ProgramsView />} />
                <Route path="fields" element={<FieldsView />} />
                <Route path="map" element={<MapView />} />
                <Route path="account" element={<AccountView />} />
                {/* The old /about and /community pages, merged. Reachable
                    without a saved profile — see the gate in DashboardShell. */}
                <Route path="database" element={<DatabaseView />} />
                <Route path="applications" element={<ApplicationsView />} />
                <Route path="deadlines" element={<DeadlinesView />} />
              </Route>
              {/* Redirects, not 404s. Both were in the navbar of a deployed
                  site for months, so they are in the sitemap and in whatever
                  anyone has linked or bookmarked. `replace` so the back button
                  doesn't bounce off the old URL and straight back here. */}
              <Route path="/about" element={<Navigate to="/profile/database" replace />} />
              <Route path="/community" element={<Navigate to="/profile/database" replace />} />
              {/* Deliberately absent from NAV_LINKS and from every link on the
                  site. AdminShell renders the 404 page for anyone without the
                  flag, so an ordinary visitor who guesses the URL learns
                  nothing — and the flag itself decides only what is drawn. The
                  server checks the database on every write. */}
              <Route path="/admin" element={<AdminShell />} />
              <Route
                path="*"
                element={<Placeholder title="Page not found" blurb="That page doesn’t exist yet. Head back home to keep exploring." />}
              />
            </Routes>
        </PageTransition>
      </Layout>
    </>
  )
}
