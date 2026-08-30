# Working on Acceptiversity

This file is loaded into every session, so it holds only what is true regardless
of what you are building. Task lists live elsewhere — see the pointers at the
bottom.

The site helps Ontario high-schoolers find what averages admitted students
actually reported, instead of the vague cutoffs official sites publish. React 19
+ Vite + TypeScript + Tailwind v4 + React Router + Vitest, deployed to GitHub
Pages on every push to `main`. The backend is a separate repo,
`TheKeems/UniServer` (Node/Express/Mongoose on Render).

## Four rules that do not bend

Breaking one of these is worse than shipping nothing. They are why the site is
worth reading at all.

1. **Never state or imply a probability of admission.** 93% of the reports held
   are offers — because people who get in are far likelier to come back and say
   so, not because almost everyone gets in. Any "acceptance rate" computed from
   this data measures who answered a survey. The data supports *distributions of
   averages admitted students reported* and nothing else. No "your odds", no
   "chance", no "likely".

2. **No PII.** The audience is mostly under 18. No email, real name, age or
   school, anywhere, ever. A username is a label the student invented. One
   source spreadsheet has a Discord/Reddit username column and the ETL has never
   read it. `POST /api/data` telemetry must stay unlinkable to a person — it
   sends a five-point average band, never the exact average.

3. **Never record a fact from a search summary.** Only pages actually fetched
   count, and every entry in `src/data/program-info.ts` carries its source URL
   and the date it was read. Two summaries have already been caught
   contradicting the official page — both would have told students to take the
   wrong courses.

4. **The dataset stays in the pipeline.** Spreadsheet → `npm run data:build` →
   `src/data/generated/*.json`. That is where moderation and provenance live.
   Nothing else may hold a number a student sees. The editable content
   collection on the server is prose only, and its schema has no numeric field —
   that is deliberate, and it is what stops an admin's edit contradicting a
   median.

Related, and load-bearing: a **recommended** course must never be counted as a
missing prerequisite. `gapFor` in `src/lib/courses.ts` reads only the required
list. A student who drops a required course because it looked optional loses a
year.

## Adding a survey answer is a four-place change

Miss one and the answer is accepted, stored, and then **silently erased from the
student's device** the next time they sign in somewhere else. There is no error
and nothing in any log.

1. `SurveyAnswers` in `src/lib/profile.ts`
2. `applyRemoteProfile` in `src/lib/sync.ts` — it *rebuilds* the local record
   from a per-field whitelist on every pull
3. `RemoteProfile` in `src/lib/api.ts`
4. `answersSchema` and `cleanAnswers` in `TheKeems/UniServer`

Tests on both sides assert the full key set. Keep them.

`src/lib/tracker.ts` lives in its own localStorage key *outside* the profile for
this exact reason. Do not move it in until the field exists in both maps in
`sync.ts` and on the server.

## The design system, in four places

Added 2026-08-28. Reach for these rather than a one-off value — each replaced a
set of hand-written ones, and the note beside each says what went wrong.

- **Elevation** — `--shadow-sm/DEFAULT/md/lg` in `src/index.css`, built on
  `--p-shadow` and `--p-shadow-boost` so it flips with the theme. Every shadow
  used to be a hand-written `rgba(20,24,31,…)`, which is the *light* ink, so
  elevation silently did not exist in dark mode. **Never add an arbitrary
  `shadow-[...]`.**
- **Interaction** — `.card-lift` is the one hover for anything card-shaped;
  `active:` scale is the pressed state. Note Tailwind v4's `scale-*` sets the
  CSS `scale` property, so a transition list must name `scale`, not `transform`.
- **Rhythm** — `ui/Section.tsx`: `pad` is `section` (py-20) / `band` (py-16) /
  `none`, `tone` is `paper` / `surface` / `cloud`. The rule is also written
  beside `container-page`. Type scale is `display-1..4` + `text-lead`.
- **Motion** — `src/lib/motion.ts` and nowhere else: `DURATION`, `EASE`,
  `SPRING`, `staggerDelay()` for lists, `chartDelay()` for marks inside one
  chart, `DURATION.hover` for anything a pointer touches. Two rules that are
  measured, not preferences: **nothing animates from `opacity: 0`**
  (`ENTER_FROM = 0.55`), and **charts animate transforms, never `width` /
  `height` / `left`** — the layout-property version cost 565ms of style
  recalculation against 18ms. A hover must never share a transition with an
  entrance, or it inherits the entrance's stagger delay.

## Verifying a change

```bash
npm run lint && npm test
```

`oxlint` catches rules-of-hooks violations that have shipped past a dev-server
check before.

Then build and check against the **deploy base**, not the dev server:

```bash
npm run build
```

Open the `vite-preview` entry in `.claude/launch.json` (port 4200, base
`/AI-slop-project/`). Plain `vite preview` serves at `/` while `dist/index.html`
requests `/AI-slop-project/...`, so every asset 404s into a blank page that looks
exactly like a broken build. Restart preview after every rebuild.

```bash
npm run sweep && npm run sweep:sections && npm run probe:motion
```

**Baseline as of 2026-08-29** — anything else failing is new. Every number here
was measured on this machine in the session that wrote it; the previous version
of this table was copied forward and was a full cycle stale.

| | |
|---|---|
| `npm run lint` | 0 errors, 14 warnings |
| `npm test` | 361 pass |
| `npm run sweep` | 165 of 165 |
| `npm run sweep:sections` | 26 of 26 |
| `npm run probe:motion` | `minVisible 0.55`, `0 dark frames`, `0 gap frames` on five of six rows |

**The sixth row, `program -> analytics (charts)`, reports `minVisible 0` with
about 53 dark frames, and that is the honest reading rather than a
regression.** This table used to say the charts row reported `1`. It did — but
the probe was watching `#main`'s last child, which is the `PageTransition`
wrapper, and that is keyed on the pathname. `Tabs` keeps its active tab in
local state, so clicking Analytics never re-keyed it and its opacity never
moved off 1. The probe now watches `[role="tabpanel"]`, the thing that
actually swaps. The dip it found is real: `Tabs` uses `AnimatePresence
mode="wait"` with `opacity: 0` at both ends, on purpose, because crossfading
two panels of different heights makes the page jump. Whether that trade is
still the right one is open — but it is now measured instead of hidden.

The backend has its own suite: `cd ../UniServer && npm test` — 133 pass.

## Traps that have each cost real time

- **`vite preview` answers 200 with `index.html` for a missing file.** So a
  missing image "loads" locally and the sweep sees no failure. Check the live
  site or the filesystem before believing an asset is fine.
- **A hidden browser pane does not composite frames**, so `AnimatePresence
  mode="wait"` never finishes its exit and animated Leaflet zooms never
  complete. That is the harness, not the app — the headless sweeps are the real
  check.
- **`{x.length && <div/>}` renders a literal `0`.** It shipped once. Use an
  explicit comparison.
- **The sweep's `accounts` area creates a real account on the live server every
  run**, and UniServer rate limits signup to 10/hour per IP. Run the sweep more
  than that in an hour and the accounts checks fail with things like "deleted
  account no longer authenticates — login returned 200", which reads exactly
  like a sync regression and is not one. Re-run `npm run sweep -- accounts` on
  its own before believing it; `SWEEP_BASE` only redirects the site, never the
  API.
- **On GitHub Pages every deep link returns HTTP 404** with the right content,
  because `index.html` is copied to `404.html`. Both sweeps filter the document
  out of their error checks. Do not "fix" that.
- **Leaflet's stylesheet arrives in a lazy chunk**, after `index.css`, so it wins
  every specificity tie. Map rules are scoped under `.theme-map`.
- **Frame-delta timing on this machine is too noisy to tune on.** Use CPU
  accounting for anything performance-related.
- **A stale `vite preview` will happily verify the wrong build.** `pkill -f
  "vite preview"` does not reliably kill it here, and without `--strictPort` the
  replacement silently moves to 4201, 4202, ... while `SWEEP_BASE=...:4200`
  keeps hitting the old one. Eight had accumulated before this was noticed.
  Start it with `--strictPort`, kill the port holder by PID from PowerShell
  (`Get-NetTCPConnection -LocalPort 4200`), and confirm the served CSS hash
  matches `dist/assets/index-*.css` before believing a green run.
- **Tailwind v4's `scale-*` sets the CSS `scale` property, not a `transform`
  function.** So `transition-[transform,...]` does not cover it, and every
  `active:scale-*` press snaps instead of animating. List `scale` explicitly.
  This is invisible in a screenshot — it only shows up if you read
  `getComputedStyle(el).scale` partway through a press.

## Where to look next

| File | What it holds |
|---|---|
| `HANDOFF.md` | the project as a whole — data pipeline, research coverage, blocked sources |
| `HANDOFF-NEXT.md` | where things stand right now, and what is outstanding |
| `DASHBOARD-NEXT.md` | the current dashboard backlog, in priority order |

Workflow: work on a `feature/*` branch, PR into `main`, merge — which triggers
the deploy. Git auth is the GitHub CLI at `C:\Program Files\GitHub CLI\gh.exe`.
