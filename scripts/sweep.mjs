// Functional sweep of the deployed site.
//
// Asserts CONTENT, never "the page loaded" — a route that renders its shell and
// no data is exactly the failure a smoke test exists to catch. Every check names
// something that must be on screen, or a control that must respond.
//
// Console errors and failed requests are collected per page too: a 404 on a lazy
// chunk or a rejected API call is invisible from the DOM, and is the likeliest
// way this deploy is broken without looking broken.
//
// Reduced motion is deliberately NOT forced (unlike scripts/shots.mjs) so
// animated content is exercised the way a visitor meets it.
//
//   node .shots/sweep.mjs                       everything
//   node .shots/sweep.mjs home explore          only those areas
//   SWEEP_BASE=http://localhost:5173 node .shots/sweep.mjs

import { launch } from 'puppeteer-core'

const BASE = (process.env.SWEEP_BASE ?? 'https://derprito64bit.github.io/AI-slop-project').replace(/\/$/, '')
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const results = []
const check = (area, name, cond, detail = '') => results.push({ ok: Boolean(cond), area, name, detail })

/** A profile with enough in it that every dashboard view has something to show. */
const SEED = JSON.stringify({
  answers: { field: 'engineering', province: 'ON', average: 88, ambition: 'balanced' },
  shortlist: ['mcmaster::engineering-i-co-op', 'waterloo::computer-science', 'queens::commerce'],
  courses: ['ENG4U', 'MHF4U'],
  notes: { 'mcmaster::engineering-i-co-op': 'ask about co-op' },
  tags: { 'waterloo::computer-science': ['dream'] },
  savedAt: '2026-08-19T00:00:00.000Z',
})

/**
 * Been through the questions, kept nothing — the state EVERY student is in on
 * their first visit.
 *
 * None of the checks that use SEED can reach it: they all seed three kept
 * programs, so every one of them exercises the populated dashboard and the
 * whole empty branch shipped untested.
 */
const NEW_SEED = JSON.stringify({
  answers: { field: 'engineering', province: 'ON', average: 88, ambition: 'balanced' },
  shortlist: [],
  courses: [],
  notes: {},
  tags: {},
  savedAt: '2026-08-19T00:00:00.000Z',
})

let browser

async function open(path, opts = {}) {
  const { seed, seedOnce, width = 1512, height = 1000, theme, reduced = false } = opts
  const page = await browser.newPage()
  await page.setViewport({ width, height })
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  const errors = []
  const bad = []
  // The two calls the site is DESIGNED to survive losing.
  //
  // /api/universities and /api/map/config are additive: editable prose and
  // whether a basemap can be drawn. Both resolve to "nothing, then" on failure —
  // `loadUniversityContent` returns {} and the map falls back to its SVG — so a
  // 404 from a backend that has not been deployed yet, or a refusal from one
  // that is asleep, is the expected state rather than a regression.
  //
  // Narrow on purpose: any OTHER API route failing still counts. If this ever
  // grows to cover /api/profile, the sweep has stopped being able to tell you
  // that sync is broken.
  const EXPECTED_API_MISS = /\/api\/(universities|map\/config)\b/
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    // Every deep link on GitHub Pages is served through 404.html, so the
    // DOCUMENT returns a 404 status and Chrome logs a resource error for it.
    // That is the fallback working. Asset failures are caught below, where the
    // resource type is available to tell them apart.
    if (/Failed to load resource/.test(m.text())) return
    errors.push(m.text().slice(0, 140))
  })
  page.on('requestfailed', (r) => {
    // Same reasoning as the API 404 below: with the backend not deployed, or
    // asleep, the content call is refused outright rather than answered. The
    // site is built to shrug that off.
    if (EXPECTED_API_MISS.test(r.url())) return
    bad.push(`${r.failure()?.errorText ?? 'failed'} ${r.url().slice(-55)}`)
  })
  // A 404 on the DOCUMENT is by design on GitHub Pages: index.html is copied to
  // 404.html so deep links resolve, which means every deep link is served with a
  // 404 status and correct content. Only asset failures mean something is broken.
  page.on('response', (r) => {
    if (r.status() < 400) return
    if (r.request().resourceType() === 'document') return
    if (EXPECTED_API_MISS.test(r.url())) return
    bad.push(`${r.status()} ${r.url().slice(-55)}`)
  })
  await page.evaluateOnNewDocument(
    (s, t) => {
      try {
        sessionStorage.setItem('acceptiversity.loader.seen', '1')
        if (s) localStorage.setItem('acceptiversity.profile.v2', s)
        if (t) localStorage.setItem('theme', t)
      } catch {}
    },
    // `seedOnce` deliberately does NOT go through this hook. It re-runs on every
    // navigation, so a test that clears storage to imitate a second device would
    // have the profile written straight back underneath it — which is a harness
    // bug that reads exactly like an app bug.
    seedOnce ? null : seed ?? null,
    theme ?? null,
  )
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 60_000 })
  if (seedOnce) {
    await page.evaluate((s) => localStorage.setItem('acceptiversity.profile.v2', s), seedOnce)
    await page.reload({ waitUntil: 'networkidle2' })
  }
  await page
    .waitForFunction(() => document.querySelector('main')?.innerText.trim().length > 40, { timeout: 25_000 })
    .catch(() => {})
  await new Promise((r) => setTimeout(r, 700))
  return { page, errors, bad }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const text = (page) => page.evaluate(() => document.querySelector('main')?.innerText ?? '')

/** Click something by its visible text, the way a person would. */
const clickText = (page, t, sel = 'a, button') =>
  page.evaluate(
    (t, sel) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.innerText.trim().includes(t))
      if (!el) return false
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
      return true
    },
    t,
    sel,
  )

/** Type into a React-controlled input. */
const type = (page, selector, value, index = 0) =>
  page.evaluate(
    (selector, value, index) => {
      const el = document.querySelectorAll(selector)[index]
      if (!el) return false
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
      Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    selector,
    value,
    index,
  )

/* ------------------------------------------------------------------ home --- */

async function sweepHome() {
  const { page, errors, bad } = await open('/')
  // CountUp animates when its section scrolls into view, so a read before that
  // catches "1,589" on the way to 2,436. Walk the page first.
  await page.evaluate(async () => {
    for (let y = 0; y < 3500; y += 400) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 150))
    }
    window.scrollTo(0, 0)
  })
  await wait(2200)
  const body = await text(page)

  // Figures come from summary.json; hand-typed numbers were how this page once
  // claimed "120+ programs" against a real 2,436.
  for (const [label, n] of [['programs', '2,436'], ['universities', '39'], ['reports', '10,372']]) {
    check('home', `stat ${label} = ${n}`, body.includes(n), body.includes(n) ? '' : 'not rendered')
  }

  for (const s of ['Build your profile', 'See your matches', 'See the real averages']) {
    check('home', `roadmap step "${s.slice(0, 22)}"`, body.includes(s))
  }

  const featured = await page.$$eval('main a[href*="/program/"]', (as) => as.length)
  check('home', 'featured programs link out', featured >= 1, `${featured} links`)

  // The carousel bug was width-dependent: one copy is 1,357px — fine at 1280,
  // short at 1920+. Assert the invariant that fixed it, at all three widths.
  for (const w of [1280, 1920, 2560]) {
    await page.setViewport({ width: w, height: 1000 })
    await wait(800)
    const tracks = await page.evaluate(() =>
      [...document.querySelectorAll('.marquee-track')].map((t) => {
        const copies = t.children.length
        const copyW = t.children[0]?.offsetWidth ?? 0
        const container = t.parentElement.offsetWidth
        return { copies, copyW, container, covered: (copies - 1) * copyW >= container }
      }),
    )
    check(
      'home',
      `carousels loop at ${w}px`,
      tracks.length === 2 && tracks.every((t) => t.covered),
      tracks.map((t) => `${t.copies}x${t.copyW} vs ${t.container}`).join(' | '),
    )
  }
  await page.setViewport({ width: 1512, height: 1000 })

  // The hero search must reach Explore WITH the query — it used to drop it.
  const typed = await page.evaluate(() => {
    const el = document.querySelector('main input')
    if (!el) return false
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'waterloo')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.form?.requestSubmit?.()
    return true
  })
  await wait(1800)
  check('home', 'hero search reaches Explore with ?q=', typed && /explore\?q=waterloo/.test(page.url()), page.url().slice(-38))

  check('home', 'no console errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  check('home', 'no failed requests', bad.length === 0, bad.slice(0, 2).join(' | '))
  await page.close()
}

/* --------------------------------------------------------------- explore --- */

async function sweepExplore() {
  const { page, errors, bad } = await open('/explore?q=waterloo')
  const seeded = await page.$eval('main input', (el) => el.value).catch(() => '')
  check('explore', 'seeds the box from ?q=', seeded === 'waterloo', `value="${seeded}"`)

  const body = await text(page)
  const shown = Number((body.match(/Showing ([\d,]+) of/) ?? [])[1]?.replace(/,/g, ''))
  const cards = await page.$$eval('main ul li', (ls) => ls.filter((l) => l.querySelector('a[href*="/program/"]')).length)
  check('explore', 'count matches rendered cards', shown === cards, `says ${shown}, rendered ${cards}`)
  check('explore', 'the query actually filters', /waterloo/i.test(body))

  // Keep must work with no survey and no account.
  const problem = await page.evaluate(() => {
    localStorage.clear()
    const b = document.querySelector('main button[aria-label*="Keep"]')
    if (!b) return 'no keep button found'
    b.click()
    return null
  })
  await wait(1000)
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('acceptiversity.profile.v2') ?? 'null'))
  check('explore', 'Keep creates a profile with no account', !problem && profile?.shortlist?.length === 1,
    problem ?? `shortlist=${profile?.shortlist?.length ?? 0}`)
  await page.close()

  const { page: p2 } = await open('/explore')
  const before = await p2.$$eval('main ul li', (ls) => ls.length)
  const more = await clickText(p2, 'Show more', 'button')
  await wait(1500)
  const after = await p2.$$eval('main ul li', (ls) => ls.length)
  check('explore', 'Show more pages in more results', more && after > before, `${before} -> ${after}`)
  await p2.close()

  check('explore', 'no console errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  check('explore', 'no failed requests', bad.length === 0, bad.slice(0, 2).join(' | '))
}

/* --------------------------------------------------------------- program --- */

async function sweepProgram() {
  const { page, errors, bad } = await open('/program/mcmaster/engineering-i-co-op')
  const body = await text(page)

  check('program', 'renders the program', /Engineering I \(Co-op\)/.test(body), body.slice(0, 36).replace(/\n/g, ' '))
  check('program', 'shows a median', /\d{2}(\.\d)?%/.test(body))
  // Decision counts and their disclaimer live on the Analytics tab. What matters
  // for the rule is that they appear TOGETHER — a tab showing outcome counts
  // without the note would be the violation.
  await clickText(page, 'Analytics', '[role="tab"]')
  await wait(1200)
  const analytics = await text(page)
  check('program', 'analytics names the sample size', /of \d+ reported offers?/i.test(analytics),
    (analytics.match(/of \d+ reported offers?/i) ?? [])[0] ?? 'no sample size')
  check('program', 'decision counts carry the not-an-acceptance-rate note',
    !/(offer|rejected|waitlist)/i.test(analytics) || /not an acceptance rate/i.test(analytics),
    'counts shown without the disclaimer')
  const links = await page.$$eval('main a[href*="/program/"]', (as) => as.length)
  check('program', 'links to similar programs', links >= 2, `${links} links`)

  check('program', 'no console errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  check('program', 'no failed requests', bad.length === 0, bad.slice(0, 2).join(' | '))
  await page.close()
}

/* ---------------------------------------------------------------- survey --- */

/** Pick an option out of a Combobox the way a student does: type, then click. */
async function pickOption(page, selector, query, label) {
  await page.focus(selector)
  await type(page, selector, query)
  await wait(250)
  return page.evaluate((t) => {
    const o = [...document.querySelectorAll('[role="option"]')].find((e) =>
      e.innerText.trim().startsWith(t),
    )
    if (!o) return false
    // pointerdown, not click: that is what the component listens for, because a
    // click would arrive after the input's blur had already closed the list.
    o.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    return true
  }, label)
}

async function sweepSurvey() {
  const { page, errors, bad } = await open('/survey')
  // Not pinned to a question count. It used to read `OF 4`, which is why every
  // check in here failed at once when the survey grew rather than the one that
  // had actually changed.
  const step = () => text(page).then((t) => (t.match(/QUESTION (\d+) OF \d+/i) ?? [])[1])

  check('survey', 'starts at question 1', (await step()) === '1')

  // --- 1. field, through the typeahead that replaced the chip grid
  const took = await pickOption(page, '#survey-field', 'engine', 'Engineering')
  check('survey', 'the field typeahead offers a match and takes it', took)
  await wait(200)
  const chosen = await page.$eval('#survey-field', (el) => el.value).catch(() => '')
  check('survey', 'the chosen field stays in the box', chosen === 'Engineering', `value="${chosen}"`)

  await clickText(page, 'Next', 'button')
  await wait(700)
  check('survey', 'Next advances', (await step()) === '2')

  // --- 2. co-op
  await clickText(page, 'Co-op only', 'button')
  await wait(200)
  await clickText(page, 'Next', 'button')
  await wait(700)
  check('survey', 'the co-op question advances', (await step()) === '3')

  // --- 3. province
  await clickText(page, 'Skip', 'button')
  await wait(700)
  check('survey', 'Skip advances past a question', (await step()) === '4')

  // --- 4. home city
  await clickText(page, 'Skip', 'button')
  await wait(700)
  check('survey', 'reaches the average question', (await step()) === '5')

  // --- 5. average. 40-100 range check: a typo must be caught, a real average
  // accepted. This is the only question that can be wrong rather than absent.
  await type(page, '#survey-average', '8')
  await clickText(page, 'Next', 'button')
  await wait(600)
  const err = await page.evaluate(() => document.querySelector('[role="alert"]')?.innerText ?? '')
  check('survey', 'rejects an implausible average', /between 40 and 100/i.test(err) && (await step()) === '5', err.slice(0, 40))

  await type(page, '#survey-average', '88')
  await clickText(page, 'Next', 'button')
  await wait(700)
  check('survey', 'accepts a real average', (await step()) === '6')

  await clickText(page, 'Back', 'button')
  await wait(700)
  const kept = await page.$eval('#survey-average', (el) => el.value).catch(() => '')
  check('survey', 'Back preserves the typed answer', (await step()) === '5' && kept === '88', `value="${kept}"`)

  await page.close()

  // A full run, ending in a stored profile.
  //
  // The courses question is the one that writes somewhere other than `answers`
  // — it fills SavedProfile.courses, which the Courses tool owns — so a run
  // that did not check both halves would miss the point of adding it.
  const { page: p3 } = await open('/survey')
  await pickOption(p3, '#survey-field', 'engine', 'Engineering')
  await wait(200)
  for (let i = 0; i < 5; i++) {
    // field, co-op, province, home city, average
    await clickText(p3, 'Next', 'button')
    await wait(650)
  }
  await clickText(p3, 'Advanced Functions', 'button')
  await wait(200)
  for (let i = 0; i < 2; i++) {
    // courses, graduating year
    await clickText(p3, 'Next', 'button')
    await wait(650)
  }
  await clickText(p3, 'Show my matches', 'button')
  await wait(1800)
  const done = await p3.evaluate(() => ({
    path: location.pathname,
    profile: JSON.parse(localStorage.getItem('acceptiversity.profile.v2') ?? 'null'),
  }))
  check('survey', 'a full run lands on the dashboard', /\/profile/.test(done.path), done.path)
  check('survey', 'a full run stores the field', done.profile?.answers?.field === 'engineering',
    JSON.stringify(done.profile?.answers))
  check('survey', 'the courses question writes to the profile, not to answers',
    Array.isArray(done.profile?.courses) && done.profile.courses.includes('MHF4U'),
    JSON.stringify(done.profile?.courses))
  // Every key of SurveyAnswers has to survive the round trip. A missing one is
  // the signature of the four-place change going wrong — see Survey.tsx.
  check('survey', 'stores every answer key',
    Boolean(done.profile?.answers) &&
      ['field', 'province', 'average', 'ambition', 'homeCity', 'coop', 'gradYear'].every(
        (k) => k in done.profile.answers,
      ),
    JSON.stringify(Object.keys(done.profile?.answers ?? {})))
  await p3.close()

  // Skip all: a profile with answers: null, and a dashboard that still works.
  const { page: p2 } = await open('/survey')
  await clickText(p2, 'Skip all', 'button')
  await wait(1800)
  const state = await p2.evaluate(() => ({
    path: location.pathname,
    profile: JSON.parse(localStorage.getItem('acceptiversity.profile.v2') ?? 'null'),
    body: document.querySelector('main')?.innerText.slice(0, 80) ?? '',
  }))
  check('survey', 'Skip all lands on the dashboard', /\/profile/.test(state.path), state.path)
  check('survey', 'Skip all stores answers: null', state.profile && state.profile.answers === null,
    JSON.stringify(state.profile?.answers))
  await p2.close()

  check('survey', 'no console errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  check('survey', 'no failed requests', bad.length === 0, bad.slice(0, 2).join(' | '))
}

/* ------------------------------------------------------------- dashboard --- */

const VIEWS = [
  ['', 'Your dashboard', 'Programs kept'],
  ['/list', 'My list', ''],
  ['/balance', 'Balance', 'Ambitious'],
  ['/courses', 'Courses', 'ENG4U'],
  ['/compare', 'Compare', ''],
  ['/programs', 'Programs', 'programs match'],
  ['/fields', 'Fields', 'Engineering'],
  ['/applications', 'Applications', 'stays on this device'],
  ['/deadlines', 'Deadlines', 'We do not publish deadlines'],
  ['/database', 'The data', 'not an acceptance rate'],
  ['/account', '', 'account'],
]

async function sweepDashboard() {
  for (const [sub, heading, must] of VIEWS) {
    const { page, errors, bad } = await open(`/profile${sub}`, { seed: SEED })
    const body = await text(page)
    const label = sub || '(overview)'
    if (heading) check('dashboard', `${label} renders`, body.includes(heading), body.slice(0, 40).replace(/\n/g, ' '))
    if (must) check('dashboard', `${label} shows real content`, new RegExp(must, 'i').test(body), `missing "${must}"`)
    check('dashboard', `${label} no console errors`, errors.length === 0, errors.slice(0, 1).join(''))
    check('dashboard', `${label} no failed requests`, bad.length === 0, bad.slice(0, 1).join(''))
    await page.close()
  }

  // My list: the seeded note lives in a textarea, so assert its VALUE — innerText
  // does not include form field contents, which reads as "the note is missing".
  {
    const { page } = await open('/profile/list', { seed: SEED })
    const state = await page.evaluate(() => ({
      programs: [...document.querySelectorAll('main a[href*="/program/"]')].length,
      notes: [...document.querySelectorAll('main textarea')].map((t) => t.value).filter(Boolean),
      tags: [...document.querySelectorAll('main button')].map((b) => b.innerText.trim()).filter((t) => /dream/.test(t)),
      header: document.querySelector('main')?.innerText.match(/\d+ programs? kept/i)?.[0],
    }))
    check('dashboard', '/list shows the kept programs', state.header === '3 programs kept', state.header)
    check('dashboard', '/list keeps notes', state.notes.includes('ask about co-op'), state.notes.join('|'))
    check('dashboard', '/list keeps student-invented labels', state.tags.length > 0, state.tags.join('|'))
    await page.close()
  }

  // Seeded counts must actually reach the Overview tiles.
  const { page } = await open('/profile', { seed: SEED })
  const body = await text(page)
  check('dashboard', 'overview counts the seeded profile', /Programs kept\s*3/.test(body), body.match(/Programs kept\s*\d+/)?.[0])
  check('dashboard', 'overview shows the average', /88%/.test(body))

  // Programs filters have to survive the URL round trip.
  await page.close()
  const { page: p2 } = await open('/profile/programs?field=business&province=ON&sort=average-asc&data=1', { seed: SEED })
  const t2 = await text(p2)
  const selects = await p2.$$eval('main select', (ss) => ss.map((s) => s.value))
  check('dashboard', 'programs filters restore from the URL',
    selects[0] === 'business' && selects[1] === 'ON' && /programs match/.test(t2), selects.join(','))
  await p2.close()

  // The empty Overview.
  {
    const { page: p3, errors } = await open('/profile', { seed: NEW_SEED })
    const body = await text(p3)

    check('dashboard', 'empty overview shows the start path', /Where to start/i.test(body),
      body.slice(0, 60).replace(/\n/g, ' '))
    check('dashboard', 'empty overview drops the row of zeros', !/Programs kept/.test(body),
      body.match(/Programs kept\s*\d+/)?.[0] ?? '')
    check('dashboard', 'empty overview offers real programs',
      /Worth a look/i.test(body) && /reported offers/.test(body))
    // 1.3: the field they named, not the dataset-wide fallback.
    check('dashboard', 'empty overview reads the field they answered',
      /Engineering, in the data/i.test(body) && /typical reported median/i.test(body),
      body.match(/typical reported median/i)?.[0] ?? 'no field summary')
    check('dashboard', 'empty overview no console errors', errors.length === 0, errors.slice(0, 1).join(''))

    // The whole point of the section: ONE CLICK has to end the empty state,
    // with no reload. A Keep control that writes to localStorage behind the
    // shell's back leaves the path on screen and passes every check above.
    const keep = await p3.$('main button[aria-label="Keep this program"]')
    check('dashboard', 'empty overview has a keep control', Boolean(keep))
    if (keep) {
      await keep.click()
      await wait(500)
      const after = await text(p3)
      check('dashboard', 'keeping from the overview ends the empty state',
        /Programs kept\s*1/.test(after) && !/Where to start/i.test(after),
        after.match(/Programs kept\s*\d+/)?.[0] ?? after.slice(0, 60).replace(/\n/g, ' '))
    }
    await p3.close()
  }
}

/* -------------------------------------------------------------- accounts --- */

async function sweepAccounts() {
  const user = `zz-sweep-${String(Date.now()).slice(-7)}`
  const pw = 'correct horse battery staple'

  // Guest work first, so sign-up has something to adopt.
  const { page } = await open('/signup', { seedOnce: SEED })
  await type(page, 'form input', user, 0)
  await type(page, 'form input', pw, 1)
  await type(page, 'form input', pw, 2)
  await page.evaluate(() => document.querySelector('form')?.requestSubmit())
  // Generous: the free tier takes ~20s to wake, and that is not a fault.
  await wait(30_000)
  const created = await text(page)
  check('accounts', 'sign-up succeeds', /You.{0,3}re in|Welcome,/i.test(created), created.slice(0, 60).replace(/\n/g, ' '))
  check('accounts', 'adopts the guest list', /moved into your account/i.test(created))
  check('accounts', 'warns there is no password reset', /no password reset/i.test(created))

  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('profile')))
  check('accounts', 'profile moves to an account-scoped key', keys.some((k) => k.includes('.u.')), keys.join(','))

  // The whole point: wipe the device, sign in, get it all back.
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle2' })
  await wait(1500)
  await type(page, 'form input', user, 0)
  await type(page, 'form input', pw, 1)
  await page.evaluate(() => document.querySelector('form')?.requestSubmit())
  await wait(20_000)
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle2' })
  await wait(3000)
  const restored = await text(page)
  const note = await page.evaluate(() =>
    JSON.stringify(Object.entries(localStorage).filter(([k]) => k.includes('profile'))).includes('ask about co-op'))
  check('accounts', 'restores the list on a clean device', /Programs kept\s*3/.test(restored),
    restored.match(/Programs kept\s*\d+/)?.[0] ?? restored.slice(0, 40).replace(/\n/g, ' '))
  check('accounts', 'restores the average', /88%/.test(restored))
  check('accounts', 'restores free-text notes', note)

  // Delete the account and prove the server refuses it afterwards.
  await page.goto(`${BASE}/profile/account`, { waitUntil: 'networkidle2' })
  await wait(2000)
  const panels = await text(page)
  check('accounts', 'account page offers password change and delete',
    /Change my password/i.test(panels) && /delete my account/i.test(panels))

  await clickText(page, 'I want to delete my account', 'button')
  await wait(1000)
  await type(page, 'main input', 'DELETE', 0)
  await wait(400)
  await clickText(page, 'Delete everything', 'button')
  await wait(20_000)
  const leftover = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('acceptiversity')))
  check('accounts', 'delete clears the device', leftover.length === 0, leftover.join(','))

  const status = await page.evaluate(async (u, p) => {
    const r = await fetch('https://uniserver-632q.onrender.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    })
    return r.status
  }, user, pw)
  check('accounts', 'deleted account no longer authenticates', status >= 400, `login returned ${status}`)

  await page.close()
}

/* ----------------------------------------------------------------- nudge --- */

async function sweepNudge() {
  const sel = '[role="dialog"][aria-label="Build your profile"]'
  const { page } = await open('/program/mcmaster/engineering-i-co-op')
  await page.evaluate(() => localStorage.clear())

  await page.goto(`${BASE}/program/mcmaster/engineering-i-co-op`, { waitUntil: 'networkidle2' })
  await wait(2500)
  const afterOne = await page.$(sel)
  await page.goto(`${BASE}/program/mcmaster/life-science-gateway`, { waitUntil: 'networkidle2' })
  await wait(3000)
  const afterTwo = await page.$(sel)
  check('nudge', 'stays quiet after one program page', afterOne === null)
  check('nudge', 'appears after two program pages', afterTwo !== null)

  if (afterTwo) {
    await clickText(page, 'Not now', 'button')
    await wait(1200)
    const dismissed = await page.evaluate(() => localStorage.getItem('acceptiversity.nudge.dismissed'))
    await page.goto(`${BASE}/program/waterloo/computer-science`, { waitUntil: 'networkidle2' })
    await wait(2500)
    const back = await page.$(sel)
    check('nudge', 'dismissal persists and it does not return', dismissed === '1' && back === null,
      `dismissed=${dismissed}`)
  }
  await page.close()
}

/* --------------------------------------------------------- cross-cutting --- */

async function sweepCross() {
  // Deep links only work on Pages because index.html is copied to 404.html.
  for (const path of ['/profile/fields', '/program/mcmaster/engineering-i-co-op', '/survey']) {
    const { page, bad } = await open(path, { seed: SEED })
    const body = await text(page)
    check('cross', `deep link ${path}`, body.length > 60 && !/doesn.t exist yet/i.test(body),
      body.slice(0, 34).replace(/\n/g, ' '))
    const missing = bad.filter((b) => b.startsWith('404'))
    check('cross', `deep link ${path} assets load`, missing.length === 0, missing.slice(0, 1).join(''))
    await page.close()
  }

  // /about and /community are redirects now, not pages — they land on the
  // database tool, which is where both sets of content went.
  for (const [path, expect] of [['/about', 'The data'], ['/community', 'The data'], ['/nonsense-route', 'not found']]) {
    const { page } = await open(path)
    const body = await text(page)
    check('cross', `${path} renders`, new RegExp(expect, 'i').test(body), body.slice(0, 34).replace(/\n/g, ' '))
    await page.close()
  }

  for (const w of [375, 1280, 2560]) {
    const { page } = await open('/profile/programs', { seed: SEED, width: w, height: 900 })
    const over = await page.evaluate(() => {
      const de = document.documentElement
      return { over: de.scrollWidth > de.clientWidth + 1, sw: de.scrollWidth, cw: de.clientWidth }
    })
    check('cross', `no horizontal overflow at ${w}px`, !over.over, `${over.sw} vs ${over.cw}`)
    await page.close()
  }

  const { page } = await open('/', { theme: 'dark' })
  const dark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  check('cross', 'dark theme applies from storage', dark === 'dark', `data-theme=${dark}`)
  await page.close()

  const { page: p2 } = await open('/profile', { seed: SEED })
  const a11y = await p2.evaluate(() => ({
    mains: document.querySelectorAll('main').length,
    skip: document.querySelector('.skip-link')?.textContent?.trim() ?? '',
  }))
  check('cross', 'exactly one <main> landmark', a11y.mains === 1, `${a11y.mains} found`)
  check('cross', 'skip link present', /skip to content/i.test(a11y.skip), a11y.skip || 'absent')
  await p2.close()

  const { page: p3 } = await open('/explore', { reduced: true })
  await p3.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await wait(2000)
  const stranded = await p3.evaluate(
    () =>
      [...document.querySelectorAll('main *')].filter((el) => {
        const s = getComputedStyle(el)
        return Number(s.opacity) < 0.2 && el.getBoundingClientRect().height > 24
      }).length,
  )
  check('cross', 'reduced motion strands nothing invisible', stranded === 0, `${stranded} faded blocks`)
  await p3.close()

  // The rule the whole product rests on. The disclaimers legitimately contain
  // these phrases, so a hit only counts when it is not one of them.
  const claims = /\b(your odds|real odds|true odds|acceptance rate|chance of admission|admission chances)\b/i
  const disclaimer =
    /not an acceptance rate|not your odds|none of this is an admission chance|never an admission|never tell you your chances/i
  for (const path of ['/', '/explore', '/survey', '/profile/database']) {
    const { page: p } = await open(path)
    const body = await text(p)
    const hit = body.match(claims)
    const claimed = Boolean(hit) && !disclaimer.test(body)
    check('honesty', `${path} states no probability`, !claimed, hit ? `"${hit[0]}"` : '')
    await p.close()
  }
}

/* ------------------------------------------------------------------ run --- */

const AREAS = {
  home: sweepHome,
  explore: sweepExplore,
  program: sweepProgram,
  survey: sweepSurvey,
  dashboard: sweepDashboard,
  accounts: sweepAccounts,
  nudge: sweepNudge,
  cross: sweepCross,
}

async function main() {
  browser = await launch({ executablePath: CHROME, headless: true, protocolTimeout: 120_000 })
  let printed = 0
  try {
    for (const [name, fn] of Object.entries(AREAS)) {
      if (only.length && !only.includes(name)) continue
      process.stdout.write(`\n--- ${name}\n`)
      try {
        await fn()
      } catch (error) {
        check(name, 'area completed without throwing', false, String(error.message).slice(0, 90))
      }
      for (; printed < results.length; printed++) {
        const r = results[printed]
        console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`)
      }
    }
  } finally {
    await browser.close()
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    console.log('\nFAILURES')
    for (const f of failed) console.log(`  [${f.area}] ${f.name}${f.detail ? ` — ${f.detail}` : ''}`)
  }
  process.exit(failed.length ? 1 : 0)
}

await main()
