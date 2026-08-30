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

/**
 * Click a thing by its text, then watch `selector` every frame for `ms`.
 *
 * `watch` picks the element WITHIN `selector` whose opacity is sampled, and
 * defaults to the last direct div — which is the PageTransition/VIEW_ENTER
 * wrapper for a route or tool swap. It is a parameter because that default was
 * silently wrong for one probe: see the note above the charts probe below.
 */
async function probe(label, clickText, selector, watch = ':scope > div:last-of-type') {
  const result = await page.evaluate(
    async (clickText, selector, watch, ms) => {
      const el = document.querySelector(selector)
      const samples = []
      let running = true
      // Opacity of the element that actually animates — NOT the max across
      // main's children: the mobile nav sits there at opacity 1 permanently
      // and hides the dip completely. If this reaches ~0 the viewer sees the
      // page blink, even though the DOM was never empty.
      //
      // Returns null, not 0, when the watched element is absent. Those are
      // different failures and conflating them hid one: AnimatePresence
      // mode="wait" legitimately has frames with no panel mounted at all,
      // which is a GAP, while a mounted panel at opacity 0 is a BLINK. Only
      // the second is what ENTER_FROM exists to prevent.
      const visible = () => {
        const anim = el.querySelector(watch)
        return anim ? Number(getComputedStyle(anim).opacity) : null
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

      const present = samples.filter((s) => s.op !== null)
      return {
        frames: samples.length,
        emptyFrames: samples.filter((s) => s.chars === 0).length,
        minChars: Math.min(...samples.map((s) => s.chars)),
        minHeight: Math.min(...samples.map((s) => s.h)),
        maxHeight: Math.max(...samples.map((s) => s.h)),
        // the darkest frame, and how many frames were near-invisible
        minVisible: present.length
          ? Number(Math.min(...present.map((s) => s.op)).toFixed(2))
          : null,
        darkFrames: present.filter((s) => s.op < 0.25).length,
        // frames where the watched element was not in the DOM at all
        gapFrames: samples.length - present.length,
        path: location.pathname,
      }
    },
    clickText,
    selector,
    watch,
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
  //
  // WATCHES THE TAB PANEL, NOT #main's LAST DIV. This probe reported
  // `minVisible 1` for months and three docs recorded that as a known-good
  // baseline. It was measuring nothing: the default watch target is the
  // PageTransition wrapper, which is keyed on sectionKey(location.pathname)
  // (App.tsx), and Tabs holds its active tab in local useState — so clicking
  // Analytics never changes the pathname, never re-keys the wrapper, and its
  // opacity sat at 1 for the whole window. role="tabpanel" is the thing that
  // actually swaps. Expect gapFrames here: Tabs uses mode="wait" on purpose,
  // because crossfading two panels of different heights makes the page jump.
  await page.goto(`${BASE}/program/mcmaster/engineering-i-co-op`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => document.querySelector('main')?.innerText.length > 100)
  await probe('program -> analytics (charts)', 'Analytics', '#main', '[role="tabpanel"]')

  // ---- top-level route change, which uses a different transition
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(() => document.querySelector('main')?.innerText.length > 100)
  await probe('home -> explore (route)', 'Explore', '#main')
} finally {
  await browser.close()
}
