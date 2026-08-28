# Handoff — pick up here

Read `HANDOFF.md` first for the project as a whole (rules, data pipeline,
architecture). This file is only about **where things stand now**.

Rewritten 2026-08-27, updated 2026-08-28. **Everything below is merged and
deployed** — that is the main difference from the last version of this file,
which said the opposite and stayed saying it for a day after it stopped being
true.

---

## 1. Where the code is

| | |
|---|---|
| `origin/main` | deployed and live at https://derprito64bit.github.io/AI-slop-project/ |
| Working state | **no open PRs, no unmerged work** |
| Backend | `TheKeems/UniServer`, cloned alongside this repo. Accounts are deployed; the content and map routes are not — see §3 |

Merged since the last rewrite: PR #29 (backend content + admin + tiles), #30
(the real basemap), #31 (`CLAUDE.md` and the dashboard backlog), #32 (the empty
Overview, and the Laurier crest).

**Baseline, measured against a production build served at the deploy base:**

```
npm run lint            0 errors
npm test                268 pass          (was 246)
npm run sweep           132 of 132        (was 125 of 125)
npm run sweep:sections  26 of 26
npm run probe:motion    minVisible 0.55, 0 dark frames
cd ../UniServer && npm test               133 pass
```

**Both sweeps default to the LIVE site.** Point them at a local build with
`SWEEP_BASE=http://localhost:4200/AI-slop-project`, and remember the preview
caches its file list at startup — restart it after every rebuild.

**A green local sweep does not prove an asset exists.** `vite preview` serves
`index.html` for unknown paths, so a missing logo file returns 200 locally; the
Laurier 404s survived a green local run that way. Check the live site or the
filesystem. The sweep also ignores failures on `/api/universities` and
`/api/map/config` specifically, because the site is built to survive losing
them; any *other* API failure still counts.

**Vitest excludes `.claude/worktrees`.** Without that it runs every suite once
per worktree and the totals multiply — two stale worktrees turned 246 tests into
740, which passes green and hides which copy actually failed.

## 2. What was built

**Navigation.** `/community`, `/about` and the `Global posts` tab are gone,
merged into one dashboard tool at `/profile/database`. The old URLs redirect.
That tool is exempt from the dashboard's first-run gate — the methodology has to
be readable before someone decides whether to trust the site.

**Backend (`TheKeems/UniServer`).** New `universitycontents` collection holding
**prose only**; `isAdmin` on accounts; `GET /api/universities` (public),
`PUT`/`DELETE /api/universities/:id` (admin); a map tile proxy at
`/api/map/tiles/:z/:x/:y`. Full detail in that repo's README.

**Admin panel** at `/admin` — not in the navbar, renders the 404 page without
the flag. The client gate is cosmetic by design; `requireAdmin` re-reads the
database on every write.

**The map** draws real tiles through our own proxy when `TILE_URL_TEMPLATE` is
set, and falls back to the original hand-drawn SVG when it is not. The fallback
is not a placeholder — it is what covers an unconfigured provider, a provider
outage, and a sleeping Render instance.

**Survey** went from 4 questions to 8, with a typeahead replacing the chip
grids. New answers: home city, co-op, graduating year, and Grade 12 courses.

**Dashboard**: charted overview, Fields ranked by reports, required/recommended
courses split, Compare gained "You still need".

**Logos**: `UniversityMark` no longer forces a monogram below 48px for every
school — `CREST_MARKS` in that file lists ids whose square file is crest art and
therefore legible small. Laurier's seal landed in PR #32, which was the last
real 404 on the site. TMU's brand kit has no crest, so its wide wordmark sits in
`public/images/universities/` with the other lockups and it stays a monogram in
listings.

**The empty dashboard** (PR #32). `/profile` used to greet a new student with
four zeros and two apologies. It now shows a three-step start path, the real
summary for the field they named, and the six most-reported programs with a Keep
control on each. Two things worth not undoing: the empty state is gated on
`profile.shortlist.length` rather than `kept.length`, because `kept` resolves
against the lazy catalogue and is `[]` on the first paint of every visit; and
the dashboard uses `KeepControl` (controlled) rather than the default
`KeepButton`, which writes to localStorage behind the shell's back and would
leave the empty state on screen after a click.

## 3. Before any of this is useful to a student

1. **Deploy UniServer's new routes.** Accounts are live —
   `/api/health` answers `{"ok":true,"database":"connected"}` — but the content
   and map halves of §2 are not on Render: `/api/universities` and
   `/api/map/config` both still 404 (probed 2026-08-28). Until they ship the
   site degrades exactly as designed — no editable prose, SVG map — but the
   admin panel cannot save. **This is the top item; four of the five below
   depend on it.**
2. **Pick a tile provider.** `TILE_URL_TEMPLATE` is unset, so the map is the SVG
   one. **Do not point it at `tile.openstreetmap.org`** — their tile policy does
   not allow a proxy in front of it, and it is only used in the local dev
   instructions. Use MapTiler, Stadia or Thunderforest.
3. **Promote yourself to admin**, by hand, in the database. There is no route
   that does it and that is deliberate:
   `db.accounts.updateOne({ usernameKey: 'you' }, { $set: { isAdmin: true } })`
4. **Set `ALLOWED_ORIGINS` on Render.** Still unset; CORS still falls back to `*`.
5. **Settle the UniServer licence.** Still none, so all-rights-reserved by
   default. The only item on this list that gets harder with time.
6. **Decide the logo licensing question.** The square marks are institutional
   coats of arms and wordmarks, used to identify each school's programs. That is
   ordinary nominative use and no university has been asked, which is fine for a
   student project and is worth a deliberate decision before it is not. Nothing
   breaks if one has to be pulled — `UniversityMark` falls back to a monogram
   per school, with no code change.

## 4. Traps that cost real time in this session

- **`vite preview` serves index.html for missing files, with a 200.** So a
  missing image "loads", the sweep sees no failure, and you conclude the logos
  are fine. They are not — check against the live site or the file system.
- **Leaflet's CSS arrives in the lazy chunk**, i.e. after `index.css`, so it
  wins every specificity tie. The map rendered as a white box in dark mode until
  the rules were scoped under `.theme-map`, and the attribution strip stayed
  white after that because Leaflet writes
  `.leaflet-container .leaflet-control-attribution` — 0,2,0, the same as the
  scoped rule. That one needs three classes.
- **`{x.length && <div/>}` renders a literal `0`.** It shipped in
  `Program.tsx` and printed a bare "0" above the facts table for any school with
  a blurb and no description — which is the *first* thing an admin fills in.
  Every other length guard in the codebase uses an explicit comparison.
- **A combobox that only closes on outside-pointerdown never closes for a
  keyboard user.** Tabbing out left the list floating and blanked the chosen
  answer, because the input renders `open ? query : label`.
- **`req.path` inside a router mounted at `/api` has the prefix stripped**, so a
  deliberately-indistinguishable 404 was distinguishable after all.
- **Node's `fetch` + `res.setHeader` ordering matters.** Setting the
  content-type and a week of `immutable` caching *before* awaiting the body
  means a failed read is served and cached as a broken image.
- The animation-frame traps from the previous handoff all still apply, plus:
  **a hidden browser pane does not composite frames**, so `AnimatePresence
  mode="wait"` never finishes its exit and the survey looks stuck. That is the
  harness, not the app — the headless sweeps are the real check.

## 5. What to build next

The dashboard's tools all work, and its views were nearly blank for a student
who had just arrived — the rich ones read the dataset, the empty ones read the
student's list. **`DASHBOARD-NEXT.md`** measures that and sets out the backlog
in priority order.

**P1, the Overview, is done** (PR #32). **P2 is next**: Compare, Balance,
Courses, Applications and Deadlines all still answer "you have nothing" rather
than "here is what this will look like once you have used it". Compare is the
starkest — its empty state is one sentence, and it fires for one staged program
as well as none, so a student who staged one gets no acknowledgement that they
did. P3 is the three survey answers that are collected, stored, synced and then
barely read: `gradYear` is read by nothing at all outside the survey and sync
plumbing.

`CLAUDE.md` holds the rules that do not bend and the verification baseline, and
is loaded into every session.

## 6. Still true from before

The rules have not moved: no probability of admission, no PII, no fact from a
search summary, and the dataset stays in the spreadsheet → `npm run data:build`
→ static JSON pipeline. The new content collection holds no numbers, so nothing
an admin types can contradict a median.

`sync.ts` still whitelists profile fields in **both** directions, and there are
now four places a new survey answer has to be added — `SurveyAnswers`,
`applyRemoteProfile`, `RemoteProfile`, and UniServer's `answersSchema` +
`cleanAnswers`. Miss one and the answer is erased from the device on the next
sign-in elsewhere. There are tests on both sides asserting the full key set.

Motion settings, the CSS-not-JS scroll reveals, and the `vite-preview` launch
config are all unchanged and all still load-bearing.
