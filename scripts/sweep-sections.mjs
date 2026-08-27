// Checks the sections that were filled in on 2026-08-27: /about, /community,
// the applications tracker and the deadlines recorder.
//
//   npm run sweep:sections                                  against the live site
//   SWEEP_BASE=http://localhost:4200/AI-slop-project npm run sweep:sections
//
// Needs a server; for a production build use the `vite-preview` launch config,
// which serves dist at the deploy base (plain `vite preview` does not — see
// HANDOFF.md).
import { launch } from 'puppeteer-core'

const BASE = (process.env.SWEEP_BASE ?? 'https://derprito64bit.github.io/AI-slop-project').replace(/\/$/, '')
const b = await launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const results = []
const check = (n, ok, d = '') => results.push({ n, ok: Boolean(ok), d })

const SEED = JSON.stringify({
  answers: { field: 'engineering', province: 'ON', average: 88, ambition: 'balanced' },
  shortlist: ['mcmaster::engineering-i-co-op', 'waterloo::computer-science'],
  courses: [], notes: {}, tags: {}, savedAt: '2026-08-19T00:00:00.000Z',
})

const page = async (seed = SEED) => {
  const ctx = await b.createBrowserContext()
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 110)))
  p.on('console', (m) => {
    if (m.type() !== 'error') return
    // On GitHub Pages every deep link is served through 404.html, so the
    // DOCUMENT comes back with a 404 status and Chrome logs a resource error
    // for it. That is the SPA fallback working, not a fault — and a console
    // message carries no resource type, so it has to be matched by text.
    if (/Failed to load resource/.test(m.text())) return
    errs.push(m.text().slice(0, 110))
  })
  // Asset failures still count, and those DO carry a type.
  p.on('response', (r) => {
    if (r.status() >= 400 && r.request().resourceType() !== 'document') {
      errs.push(`${r.status()} ${r.url().slice(-50)}`)
    }
  })
  await p.setViewport({ width: 1440, height: 1000 })
  await p.evaluateOnNewDocument((s) => {
    sessionStorage.setItem('acceptiversity.loader.seen', '1')
    if (s) localStorage.setItem('acceptiversity.profile.v2', s)
  }, seed)
  return { p, errs }
}
const textOf = (p) => p.evaluate(() => document.querySelector('main')?.innerText ?? '')
const walk = (p) => p.evaluate(async () => {
  for (let y = 0; y < 4000; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)) }
})

// --- /about
{
  const { p, errs } = await page(null)
  await p.goto(`${BASE}/about`, { waitUntil: 'networkidle2' })
  await walk(p)
  await new Promise((r) => setTimeout(r, 1500))
  const t = await textOf(p)
  check('/about is no longer a placeholder', !/Coming together/.test(t))
  check('/about: 10,372 reports', t.includes('10,372'))
  check('/about: 2,436 programs', t.includes('2,436'))
  check('/about: 39 universities', /\b39\b/.test(t))
  check('/about: 369 chartable', t.includes('369'))
  check('/about: 75 verified requirements', /75 programs/.test(t))
  check('/about: states the no-odds rule', /never tell you your chances/i.test(t))
  check('/about: no errors', errs.length === 0, errs[0] ?? '')
  await p.close()
}

// --- /community
{
  const { p, errs } = await page(null)
  await p.goto(`${BASE}/community`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2500))
  await walk(p)
  await new Promise((r) => setTimeout(r, 1500))
  const t = await textOf(p)
  check('/community is no longer a placeholder', !/Coming together/.test(t))
  check('/community: 93% offer share', /93% of reports are offers/.test(t))
  check('/community: total reports', t.includes('10,372'))
  check('/community: 2022-2023 = 953 reports, mean 92.6%', t.includes('953') && t.includes('92.6%'))
  check('/community: 2025-2026 = 5,905 reports, mean 93.0%', t.includes('5,905') && t.includes('93.0%'))
  check('/community: names the top school', /University of Waterloo/.test(t))
  check('/community: carries the not-a-rate line', /not an acceptance rate/i.test(t))
  check('/community: no errors', errs.length === 0, errs[0] ?? '')
  await p.close()
}

// --- program page: Extras is gone
{
  const { p } = await page()
  await p.goto(`${BASE}/program/mcmaster/engineering-i-co-op`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 1500))
  const tabs = await p.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((t) => t.innerText.trim()))
  check('program tabs no longer include Extras', !tabs.includes('Extras'), tabs.join(' | '))
  await p.close()
}

// --- applications tracker
{
  const { p, errs } = await page()
  await p.goto(`${BASE}/profile/applications`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2000))
  const before = await textOf(p)
  check('applications is no longer a mock', !/Not live yet/.test(before), before.slice(0, 46).replace(/\n/g, ' '))

  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '+ Track')?.click())
  await new Promise((r) => setTimeout(r, 700))
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Applied')?.click())
  await new Promise((r) => setTimeout(r, 700))
  const stored = await p.evaluate(() => localStorage.getItem('acceptiversity.tracker.v1'))
  check('tracking a program persists a status', /"status":"applied"/.test(stored ?? ''), (stored ?? '').slice(0, 60))

  await p.reload({ waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2000))
  check('status survives a reload', /1 applied/i.test(await textOf(p)))

  // The whole reason for a separate key: a profile rewrite must not touch it.
  await p.evaluate(() => localStorage.setItem('acceptiversity.profile.v2', JSON.stringify({
    answers: null, shortlist: ['mcmaster::engineering-i-co-op'], courses: [], notes: {}, tags: {},
    savedAt: new Date().toISOString(),
  })))
  await p.reload({ waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2000))
  const after = await p.evaluate(() => localStorage.getItem('acceptiversity.tracker.v1'))
  check('a profile rewrite leaves the tracker alone', /"status":"applied"/.test(after ?? ''))
  check('applications: no errors', errs.length === 0, errs[0] ?? '')
  await p.close()
}

// --- deadlines
{
  const { p, errs } = await page()
  await p.goto(`${BASE}/profile/deadlines`, { waitUntil: 'networkidle2' })
  await new Promise((r) => setTimeout(r, 2000))
  const t = await textOf(p)
  check('deadlines is no longer a mock', !/Not live yet/.test(t))
  check('deadlines asserts no dates of its own', /We do not publish deadlines/i.test(t))
  check('deadlines shows no invented example dates', !/Example . early autumn/i.test(t))

  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '+ Add a date')?.click())
  await new Promise((r) => setTimeout(r, 600))
  await p.evaluate(() => {
    const set = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const inputs = [...document.querySelectorAll('form input')]
    set(inputs[0], 'Supplementary due')
    set(inputs[1], '2026-02-01')
    set(inputs[2], 'https://example.edu/admissions')
  })
  await new Promise((r) => setTimeout(r, 400))
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Save')?.click())
  await new Promise((r) => setTimeout(r, 900))
  const saved = await textOf(p)
  check('a recorded date appears in the timeline', /1 Feb 2026/.test(saved) && /Supplementary due/.test(saved))
  check('deadlines: no errors', errs.length === 0, errs[0] ?? '')
  await p.close()
}

for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? `  — ${r.d}` : ''}`)
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} section checks passed`)
await b.close()
process.exit(failed.length ? 1 : 0)
