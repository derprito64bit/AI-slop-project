import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import SmoothScroll from './components/SmoothScroll'
import Home from './pages/Home'
import Placeholder from './pages/Placeholder'
import ExplorePreview from './pages/ExplorePreview'

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
          <Route
            path="/program"
            element={<Placeholder title="Program detail" blurb="The full breakdown for a program — requirements, accepted averages, and how you align." />}
          />
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
            element={<Placeholder title="Page not found" blurb="That page doesn’t exist yet. Head back home to keep exploring." />}
          />
        </Routes>
      </Layout>
    </>
  )
}
