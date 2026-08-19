import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import './index.css'
import App from './App.tsx'
import AuthProvider from './components/AuthProvider.tsx'

// reducedMotion="user" is set once, here, so no component has to branch on the
// media query: the library drops transform and layout animation site-wide when
// the OS asks for it, and keeps opacity so nothing is ever stranded invisible.
//
// AuthProvider wraps everything because the navbar needs the signed-in account
// as much as the dashboard does. It reads localStorage synchronously, so this
// adds no loading state and no extra render.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <App />
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
)
