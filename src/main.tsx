import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import './index.css'
import App from './App.tsx'

// reducedMotion="user" makes every Motion animation in the app respect the OS
// setting by default — transforms are dropped, opacity is kept so nothing ever
// disappears. index.css only covers CSS transitions; Motion's JS animations
// bypass CSS entirely, and components were each handling this by hand (Reveal
// wasn't handling it at all).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
)
