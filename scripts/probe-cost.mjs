// What does the motion on a page actually COST?
//
//   node scripts/probe-cost.mjs                 every route below
//   node scripts/probe-cost.mjs explore         just that one
//   SWEEP_BASE=http://localhost:4200/AI-slop-project node scripts/probe-cost.mjs
//
// WHY THIS EXISTS. The rule the whole motion system rests on — "charts animate
// transforms, never width/height/left" — comes from a measurement quoted at
// five sites in this repo: 565ms of style recalculation against 18ms, and
// 1,104ms of main-thread work against 329ms, over one scripted scroll of
// Explore. The tool that produced those numbers was never committed. It is
// named in a comment as `.shots/flash-probe.mjs`; `.shots/` is gitignored and
// the file is not there. So the repo's central performance claim could not be
// reproduced from a fresh checkout, and there was no way to tell whether a new
// animation cost anything.
//
// `probe:motion` is not that tool. It answers a different question — does a
// switch leave a frame with nothing in it — and it answers it well. Nothing
// measured cost.
//
// WHY CPU ACCOUNTING AND NOT FRAME TIMING. CLAUDE.md: "Frame-delta timing on
// this machine is too noisy to tune on. Use CPU accounting for anything
// performance-related." Chrome's Performance domain reports cumulative
// durations the renderer actually spent, per category. Those are monotonic
// counters, so the difference across a scripted scroll is the work that scroll
// caused — no sampling, no frame budget, nothing to average.
//
// HOW TO READ IT. The absolute numbers are not a baseline to hold.
//
// MEASURED, on the run that built this: within one session the probe is tight —
// three back-to-back runs of an unchanged Explore gave 74/76/70ms of style
// recalculation and 331/354/324ms of main-thread work, so about +/-5%. ACROSS
// sessions it is not comparable at all: the same unchanged page measured 42ms
// and 167ms an hour earlier, roughly half. Machine state drifts, and nothing
// here can see that.
//
// So a number from yesterday is not a control. Alternate the two builds in ONE
// run — off, on, off, on — and compare those. That is how the scroll reveal on
// /profile/programs was costed at about +3ms of style recalculation (43/45ms
// against 47/47ms), which would have been invisible against the between-session
// drift. `--json` makes the pairs diffable.
import { launch } from 'puppeteer-core'

const BASE = process.env.SWEEP_BASE ?? 'https://derprito64bit.github.io/AI-slop-project'
const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const AS_JSON = process.argv.includes('--json')
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('--'))

/** Seeded so the dashboard routes have something to draw. */
const PROFILE = {
  answers: {
    field: 'engineering',
    province: 'ON',
    average: 88,
    ambition: 'balanced',
    coop: 'yes',
    homeCity: 'Mississauga',
    gradYear: 2027,
  },
  shortlist: ['mcmaster::engineering-i-co-op', 'waterloo::computer-science', 'queens::commerce'],
  courses: ['ENG4U', 'MHF4U'],
  notes: {},
  tags: {},
  savedAt: '2026-08-16T00:00:00.000Z',
}

/**
 * The routes worth measuring, and why each one.
 *
 * Explore is first because it IS the 565ms measurement — hundreds of cards,
 * each with a scroll reveal. Home is the scroll-linked one: parallax, a pinned
 * roadmap and two marquees, all driven from JS. The rest are the pages a
 * student actually spends time on.
 */
const ROUTES = [
  ['explore', '/explore'],
  ['home', '/'],
  ['program', '/program/mcmaster/engineering-i-co-op'],
  ['overview', '/profile'],
  ['programs', '/profile/programs'],
]

/** The counters worth reporting, in the order they matter. */
const METRICS = [
  ['RecalcStyleDuration', 'style recalc'],
  ['LayoutDuration', 'layout'],
  ['ScriptDuration', 'script'],
  ['TaskDuration', 'main thread'],
]

const ms = (s) => `${(s * 1000).toFixed(0)}ms`

/**
 * Scroll the whole page once, at a fixed step and a fixed pace.
 *
 * Deliberately NOT smooth-scrolled and not tied to frame rate: the point is to
 * make two runs comparable, so every run must do the same amount of scrolling
 * over the same wall-clock time regardless of how slow the page is. A slower
 * page then shows up as more CPU for identical work, which is the signal.
 */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = 400
    const pause = () => new Promise((r) => setTimeout(r, 100))
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await pause()
    }
    window.scrollTo(0, 0)
    await pause()
  })
}

async function measure(browser, label, path) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1512, height: 1000 })
  await page.evaluateOnNewDocument((p) => {
    try {
      localStorage.setItem('acceptiversity.profile.v2', JSON.stringify(p))
      // The first-load curtain is a one-off and would land in whichever run
      // happened to go first.
      sessionStorage.setItem('acceptiversity.loader.seen', '1')
    } catch {}
  }, PROFILE)

  const cdp = await page.createCDPSession()
  await cdp.send('Performance.enable')

  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2' })
  // Let the entrance animation finish before the counters are read, so the
  // measurement is the SCROLL and not the page load.
  await new Promise((r) => setTimeout(r, 1200))

  const read = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics')
    return Object.fromEntries(metrics.map((m) => [m.name, m.value]))
  }

  const before = await read()
  await scrollThrough(page)
  const after = await read()

  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  const nodes = after.Nodes
  const delta = Object.fromEntries(METRICS.map(([key]) => [key, after[key] - before[key]]))

  await page.close()
  return { label, path, height, nodes, delta }
}

const browser = await launch({ executablePath: CHROME, headless: true, protocolTimeout: 90_000 })
const results = []
try {
  for (const [label, path] of ROUTES) {
    if (ONLY.length && !ONLY.includes(label)) continue
    results.push(await measure(browser, label, path))
  }
} finally {
  await browser.close()
}

if (AS_JSON) {
  console.log(JSON.stringify({ base: BASE, results }, null, 2))
} else {
  console.log(`\nCPU cost of one full scroll — ${BASE}\n`)
  const head = ['route'.padEnd(10), ...METRICS.map(([, name]) => name.padStart(13))].join('')
  console.log(head)
  console.log('-'.repeat(head.length))
  for (const r of results) {
    console.log(
      [r.label.padEnd(10), ...METRICS.map(([key]) => ms(r.delta[key]).padStart(13))].join(''),
    )
  }
  console.log(
    `\n${results.map((r) => `${r.label} ${r.height}px / ${r.nodes} nodes`).join('   ·   ')}`,
  )
  console.log(
    '\nNot a baseline. Tight within a session (~5%), not comparable across one —\n' +
      'alternate the two builds in a single run and compare those. --json helps.\n',
  )
}
