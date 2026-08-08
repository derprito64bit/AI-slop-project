// Screenshot the running dev server.
//
// Why this exists: the in-app Browser pane only renders while it is visible on
// screen. When it is collapsed, Chrome stops compositing that page, so
// screenshots time out and lazy-loaded images never fetch. This script drives a
// headless copy of the Chrome already installed on the machine, so it works
// regardless of the pane, and in CI later.
//
//   npm run dev     # in one terminal, then:
//   npm run shots                 all routes, both themes, 3 widths
//   npm run shots -- explore      only routes matching "explore"
//   npm run shots -- --full       full-page instead of just the viewport
//   npm run shots -- home --section="Popular right now"
//                                 just that one section, cropped for you
//
// Output lands in .shots/ (gitignored).
//
// Note prefers-reduced-motion is forced on. That is deliberate: Reveal and
// Parallax hide content until it scrolls into view, and Lenis smooth scroll
// fights programmatic scrolling, so without it captures are racy. Reduced
// motion makes content render immediately and the results deterministic.

import { mkdirSync, rmSync } from 'node:fs'
import { launch } from 'puppeteer-core'

const BASE = process.env.SHOTS_BASE ?? 'http://localhost:5173'
const OUT = '.shots'

// Chrome that is already installed — puppeteer-core downloads nothing.
const CHROME =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'explore', path: '/explore' },
  { name: 'program', path: '/program/mcmaster/engineering-i-co-op' },
]

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'laptop', width: 1512, height: 950 },
  { name: 'wide', width: 2560, height: 1400 },
]

const THEMES = ['light', 'dark']

const args = process.argv.slice(2)
const fullPage = args.includes('--full')
const section = args.find((a) => a.startsWith('--section='))?.slice('--section='.length)
const filters = args.filter((a) => !a.startsWith('--'))
const routes = filters.length
  ? ROUTES.filter((r) => filters.some((f) => r.name.includes(f) || r.path.includes(f)))
  : ROUTES

if (!routes.length) {
  console.error(`No route matched ${filters.join(', ')}. Known: ${ROUTES.map((r) => r.name).join(', ')}`)
  process.exit(1)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const browser = await launch({
  executablePath: CHROME,
  headless: true,
  // Above the internal waits below, so a genuine hang surfaces as an error
  // rather than sitting there.
  protocolTimeout: 60_000,
})
let count = 0

try {
  for (const theme of THEMES) {
    for (const vp of VIEWPORTS) {
      for (const route of routes) {
        const page = await browser.newPage()
        await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 })
        await page.emulateMediaFeatures([
          { name: 'prefers-reduced-motion', value: 'reduce' },
        ])

        // index.html reads this before first paint, so it must be set before
        // the document runs rather than toggled afterwards.
        await page.evaluateOnNewDocument((t) => {
          try {
            localStorage.setItem('theme', t)
          } catch {
            /* storage blocked — falls back to the light default */
          }
        }, theme)

        await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle2', timeout: 30_000 })

        // Data pages load their dataset lazily; wait for real content, not just
        // the shell, so we do not capture a loading state.
        await page
          .waitForFunction(() => document.querySelector('main')?.innerText.trim().length > 40, {
            timeout: 15_000,
          })
          .catch(() => console.warn(`  (${route.name}: content wait timed out, capturing anyway)`))

        // Lazy images only fetch once they scroll into view, so walk the page
        // to trigger them, then return to the top. Safe to use scrollTo here:
        // SmoothScroll disables Lenis under reduced motion, which is forced on
        // above, so nothing fights the scroll.
        await page.evaluate(async () => {
          const step = window.innerHeight
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y)
            await new Promise((r) => setTimeout(r, 60))
          }
          window.scrollTo(0, 0)
        })

        // Then wait for those images — bounded, because an image that never
        // resolves would otherwise hang the whole run.
        await page.evaluate(async () => {
          const imgs = [...document.images]
          imgs.forEach((i) => {
            i.loading = 'eager'
          })
          const settled = (i) =>
            i.complete
              ? Promise.resolve()
              : new Promise((res) => {
                  i.addEventListener('load', res, { once: true })
                  i.addEventListener('error', res, { once: true })
                })
          await Promise.race([
            Promise.all(imgs.map(settled)),
            new Promise((r) => setTimeout(r, 3000)),
          ])
        })

        // Reveal fades content in over 0.6s with a stagger as it scrolls into
        // view. Screenshotting straight after the scroll pass catches those
        // mid-flight and produces half-transparent elements, so wait them out.
        await page.evaluate(async () => {
          const running = document.getAnimations?.() ?? []
          await Promise.race([
            Promise.all(running.map((a) => a.finished.catch(() => {}))),
            new Promise((r) => setTimeout(r, 2500)),
          ])
          // Motion drives some transitions on rAF rather than WAAPI, which
          // getAnimations does not see — so settle briefly regardless.
          await new Promise((r) => setTimeout(r, 700))
        })

        const suffix = section ? `-${section.replace(/\W+/g, '-').toLowerCase()}` : ''
        const file = `${OUT}/${route.name}${suffix}-${vp.name}-${theme}.png`

        // --section="Popular right now" captures just that section, which beats
        // guessing pixel offsets into a 4000px full-page capture.
        const target = section
          ? await page.evaluateHandle((text) => {
              const el = [...document.querySelectorAll('section, footer')].find((s) =>
                s.innerText?.includes(text),
              )
              el?.scrollIntoView({ block: 'center' })
              return el ?? null
            }, section)
          : null

        const box = target ? target.asElement() : null
        if (section && !box) {
          console.warn(`  (${route.name}: no section containing "${section}")`)
          await page.close()
          continue
        }

        if (box) await new Promise((r) => setTimeout(r, 400))
        await (box ? box.screenshot({ path: file }) : page.screenshot({ path: file, fullPage }))
        await page.close()

        count++
        console.log(`  ${file}`)
      }
    }
  }
} finally {
  await browser.close()
}

console.log(`\n${count} screenshots in ${OUT}/`)
