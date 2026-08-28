// Does switching views leave a frame with nothing in it?
//
// A "flash" is not a slow fade — it is a frame where the column is EMPTY.
// This samples the main column every animation frame across a switch and
// reports the worst frame: fewest characters, shortest height.
//
// Run against the dev server, WITHOUT forcing reduced motion (unlike
// scripts/shots.mjs) — the whole point is to watch the animation run.
import { launch } from 'puppeteer-core'

const BASE = process.env.SWEEP_BASE ?? 'https://derprito64bit.github.io/AI-slop-project'
const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const PROFILE = {
  answers: { field: 'engineering', province: 'ON', average: 88, ambition: 'balanced' },
  shortlist: ['mcmaster::engineering-i-co-op', 'waterloo::computer-science', 'queens::commerce'],
  courses: ['ENG4U', 'MHF4U'],
  notes: {},
  tags: {},
  savedAt: '2026-08-16T00:00:00.000Z',
}

const browser = await launch({ executablePath: CHROME, headless: true, protocolTimeout: 60_000 })
const page = await browser.newPage()
await page.setViewport({ width: 1512, height: 1000 })
await page.evaluateOnNewDocument((p) => {
  try {
    localStorage.setItem('acceptiversity.profile.v2', JSON.stringify(p))
    sessionStorage.setItem('acceptiversity.loader.seen', '1')
  } catch {}
}, PROFILE)

/** Click a thing by its text, then watch `selector` every frame for `ms`. */
async function probe(label, clickText, selector) {
  const result = await page.evaluate(
    async (clickText, selector, ms) => {
      const el = document.querySelector(selector)
      const samples = []
      let running = true
      // Opacity of the element that actually animates — NOT the max across
      // main's children: the mobile nav sits there at opacity 1 permanently
      // and hides the dip completely. If this reaches ~0 the viewer sees the
      // page blink, even though the DOM was never empty.
      const visible = () => {
        const anim = el.querySelector(':scope > div:last-of-type')
        return anim ? Number(getComputedStyle(anim).opacity) : 0
      }
      const tick = () => {
        if (!running) return
        samples.push({ chars: el.innerText.trim().length, h: Math.round(el.offsetHeight), op: visible() })
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)

      const link = [...document.querySelectorAll('a, button')].find((a) => a.innerText.trim() === clickText)
        ?? [...document.querySelectorAll('a')].find((a) => a.innerText.includes(clickText))
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
      await new Promise((r) => setTimeout(r, ms))
      running = false

      return {
        frames: samples.length,
        emptyFrames: samples.filter((s) => s.chars === 0).length,
        minChars: Math.min(...samples.map((s) => s.chars)),
        minHeight: Math.min(...samples.map((s) => s.h)),
        maxHeight: Math.max(...samples.map((s) => s.h)),
        // the darkest frame, and how many frames were near-invisible
        minVisible: Number(Math.min(...samples.map((s) => s.op)).toFixed(2)),
        darkFrames: samples.filter((s) => s.op < 0.25).length,
        path: location.pathname,
      }
    },
    clickText,
    selector,
    900,
  )
  console.log(`${label.padEnd(28)} ${JSON.stringify(result)}`)
  return result
}

try {
  // ---- dashboard tool switching
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => document.querySelector('main')?.innerText.length > 100)
  await probe('overview -> programs', 'Programs', '#main div.flex-1')
  await probe('programs -> deadlines', 'Deadlines', '#main div.flex-1')
  await probe('deadlines -> dashboard', 'Dashboard', '#main div.flex-1')

  // ---- survey steps, which slide rather than fade
  await page.goto(`${BASE}/survey`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => document.querySelector('form')?.innerText.length > 40)
  await probe('survey step 1 -> 2', 'Next', 'form > div')

  // ---- the charts.
  //
  // This probe walked every animated surface on the site EXCEPT the one with the
  // most animation on it. The /profile probes above click AWAY from Overview,
  // where the spread and the stacked bars live, and nothing opened a program
  // page at all — so the histogram, the decision mix, the cycle trend and the
  // outcome strips were the only motion here that was never measured.
  //
  // The Analytics tab is the right trigger: it is where all four mount at once,
  // behind an AnimatePresence that swaps panels.
  await page.goto(`${BASE}/program/mcmaster/engineering-i-co-op`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => document.querySelector('main')?.innerText.length > 100)
  await probe('program -> analytics (charts)', 'Analytics', '#main')

  // ---- top-level route change, which uses a different transition
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => document.querySelector('main')?.innerText.length > 100)
  await probe('home -> explore (route)', 'Explore', '#main')
} finally {
  await browser.close()
}
