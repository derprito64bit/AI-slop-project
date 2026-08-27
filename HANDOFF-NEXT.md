# Handoff — pick up here

Read `HANDOFF.md` first for the project as a whole (rules, data pipeline,
architecture). This file is only about **where things stand now**.

Written 2026-08-27. Everything below is **merged and deployed** unless it says
otherwise.

---

## 1. Where the code is

| | |
|---|---|
| `origin/main` | deployed and live at https://derprito64bit.github.io/AI-slop-project/ |
| Working state | **no open PRs, no unmerged work** |

Everything from the last three sessions is on `main`: the survey funnel,
accounts, the motion pass, the profile build-out, the map, demo mode, and the
six empty sections. `origin/account` is the only unmerged branch — an obsolete
orphan whose content already landed via PR #24. Twenty-odd merged branches are
safe to prune.

**Baseline, all measured against the live site:**

```
npm test               226 pass
npm run lint           0 errors
npm run sweep          116 of 118        <- see the note below
npm run sweep:sections 27 of 27
npm run probe:motion   minVisible 0.55, 0 dark frames
```

**The sweep is expected to fail exactly two checks**, both `no failed requests`,
both the missing square logos for Laurier and TMU (§5). They are the only two
universities with no logo file at all, so the browser tries `.png`, tries
`.svg`, then falls back to a monogram — which looks right, but does cost two
404s per page. Add those two files and the suite goes green. **Anything else
failing is new.**

Those three suites were promoted out of a scratch directory into `scripts/` in
this session **specifically so they survive the chat that wrote them**. They
need `puppeteer-core`, which is a declared devDependency but was not installed
in this worktree — `npm i` first.

## 2. What each empty section became

Every blank surface now has a resolution, and the reasoning matters more than
the result:

- **`/about`** — real methodology page. Every figure reads from the dataset at
  render time. Do not hand-type a statistic here; that is how the home page once
  claimed "120+ programs" against a real 2,436.
- **`/community`** — the reporting-bias page. 93% of reports are offers, which
  is who answered rather than who got in. It deliberately draws **no trend line**
  through the per-cycle averages: they are flat (92.6 → 93.0) while volume grew
  six-fold, and charting that would invent a trend the data does not contain.
- **Applications** — a real tracker. **Deadlines** — the student records dates
  they found, each with a link to the page they read it on. The site publishes
  no dates of its own and should not start.
- **Global posts** — still a mock, genuinely blocked on a backend and on
  moderation for an audience that is mostly minors.
- **The Extras tab** — deleted. It was empty on all 2,436 program pages.

## 3. The constraint that shapes anything per-program you build next

**`sync.ts` whitelists profile fields in BOTH directions.** A new field on
`SavedProfile` would not merely fail to upload: `applyRemoteProfile` rebuilds
the local record from that whitelist on every pull, so the first sign-in on
another device would **erase it silently**.

That is why `src/lib/tracker.ts` lives in its own localStorage key, outside the
profile, and why both Track pages say on screen that they stay on the device.
There is a test asserting a profile rewrite cannot touch tracker data — keep it.

To make the tracker sync, the field has to be added to the backend
(`TheKeems/UniServer`) **and** to both maps in `sync.ts`. Until then, do not move
it into the profile.

## 4. Motion, and why it is set the way it is

Two findings, both measured, both easy to undo by accident:

- **Nothing animates from `opacity: 0`.** Arrivals start at `ENTER_FROM = 0.55`
  (`src/lib/motion.ts`). Measured with `npm run probe:motion`: with a zero start
  there were 5–7 consecutive frames of blank page per navigation. The probe
  reports `minVisible` and `darkFrames` — **0.55 and 0 is the passing state**.
- **Scroll reveals are CSS, not JavaScript.** `Reveal` and the Explore grid go
  through `lib/revealOnScroll.ts` and a CSS transition, with `will-change` armed
  200px early and released on `transitionend`. A JS-driven reveal cost 565ms of
  style recalculation per scroll of Explore against 18ms without; paired runs put
  total main-thread work at ~1,567ms (JS) versus ~951–1,242ms (CSS). If reveals
  are ever moved back into `motion`, that cost comes back.

Durations and easings all live in `src/lib/motion.ts`. "Make it slower" is a
one-file change; that is the point of the file.

## 5. Open items, roughly by value

- **`/community` is in the navbar and `Global posts` duplicates its idea.**
  Worth deciding whether the dashboard tab survives at all.
- **31 of 39 universities have no square logo**, so they render a monogram.
  Cosmetic. Carleton (173 programs), Laurier (156) and TMU (136) are the ones
  worth adding.
- **`console.log('Sent data')` is still live** in `submitSurvey`
  (`src/lib/api.ts`). It came from commit 652b6c9 and was deliberately restored
  rather than silently dropped during a merge. It is debug output on a
  production path and probably wants removing.
- **The backend repo has no licence** — `TheKeems/UniServer`, which holds the
  accounts, is all-rights-reserved by default. Settle that while the
  collaboration is active.
- **`ALLOWED_ORIGINS` is unset on Render**, so the API's CORS falls back to `*`.
  One env var; auth travels in an `Authorization` header rather than a cookie,
  so this is defence in depth.
- **Deadlines research** is no longer blocking anything, because the site no
  longer intends to publish dates.
- **Coverage**: 75 of 2,436 programs have verified requirements (33 of the 50
  most-reported); 369 have enough reports to chart. Both are stated honestly in
  the UI and on `/about`.

## 6. Traps that cost real time in this session

- **`vite preview` does not serve at the deploy base.** `vite.config.ts` only
  applies `base: '/AI-slop-project/'` when `command === 'build'`, so preview
  serves at `/` while `dist/index.html` requests `/AI-slop-project/...` and every
  asset 404s into a blank page that looks exactly like a broken build. Use the
  **`vite-preview`** entry in `.claude/launch.json`, and restart it after every
  rebuild — it caches its file list at startup.
- **Verify against the built bundle at the deploy base, not the dev server.**
  Two real bugs shipped past a dev-server check and were caught only in preview:
  a redirect that dropped the base path and landed on a 404, and a
  rules-of-hooks violation `oxlint` had been reporting all along. **Run
  `npm run lint`.**
- **`page.evaluateOnNewDocument` re-runs on every navigation.** Seeding
  localStorage through it means a test that clears storage gets it written back
  underneath, which reads exactly like an app bug. It cost a false "sign-out
  leaks your data" report in this session. `scripts/sweep.mjs` has a `seedOnce`
  option for this.
- **Frame-delta timing on this machine is too noisy to tune on** — identical
  builds measured 17% dropped frames and 0% minutes apart. Use CPU accounting
  (`Performance.getMetrics`) for anything performance-related.
- **On GitHub Pages every deep link returns HTTP 404** with the right content,
  because `index.html` is copied to `404.html`. Both sweeps filter the document
  out of their error checks; do not "fix" that.
- **A console error carries no resource type.** Asset failures have to be caught
  on the `response` event if you want to tell them apart from the fallback above.
