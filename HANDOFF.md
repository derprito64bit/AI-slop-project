# Acceptiversity — project state and handoff

Written 2026-08-07. Everything below reflects the repo as it stands on `main`,
which is fully merged and deployed. Read this first in a new session.

---

## 1. What this is

A website that helps Ontario high-school students find **real** university
admission requirements — what averages admitted students actually had — rather
than the vague cutoffs official sites publish. Built from the vision doc at
`context for claude.pdf` in the repo root.

**Live:** https://derprito64bit.github.io/AI-slop-project/
**Repo:** https://github.com/derprito64bit/AI-slop-project

Working product name is **Acceptiversity** (one constant, `BRAND` in
`src/nav.ts`, plus title/OG tags in `index.html` and the favicon's
`aria-label`). Renamed 2026-08-08 from the earlier working name GOON.

---

## 2. Two rules that must never be broken

These are the product's whole credibility. They're enforced in code comments,
docs, and the UI.

**1. Never present a probability of admission.**
94–97% of the source records are offers, because students who get in are far
more likely to report. That's reporting bias, not an admission rate. The data
supports *accepted-average distributions* (median, percentiles, sample size)
only. Every page showing decision counts carries an explicit "this is not an
acceptance rate" note.

**2. Never publish personal data.**
One source spreadsheet contains a Discord/Reddit username column. It is never
read by the ETL. Output records carry only outcome fields.

A third rule, learned the hard way during research:

**3. Never record a fact from a search summary.**
Two search summaries were caught directly contradicting the official page —
McMaster Engineering (claimed MCV4U + two sciences at 90%; the page says
English/Calculus & Vectors/Chemistry/Physics at +87%) and York Engineering
(claimed "SCH4U **or** SPH4U" and a 75% math average; the Lassonde page says
both, at 70% each). Both discrepancies are recorded inline in
`src/data/program-info.ts` so nobody "corrects" them back.

---

## 3. Stack and layout

React 19 · Vite 8 · TypeScript · Tailwind v4 · React Router 7 · Vitest
Deployed to GitHub Pages via `.github/workflows/deploy.yml` (auto-deploys on
push to `main`; base path `/AI-slop-project/`; `index.html` copied to `404.html`
for SPA deep links).

```
scripts/                ETL + data tooling (plain .mjs, no build step)
  build-data.mjs        spreadsheets -> JSON; run via npm run data:build
  normalize.mjs         normalization rules (unit tested)
  similarity.mjs        fuzzy matching for QA suggestions (unit tested)
  universities-map.mjs  canonical universities + alias spellings
data/
  raw/*.xlsx            the four source spreadsheets (committed)
  overrides.json        HUMAN DECISIONS — aliases, junk, merges. Persists.
  qa-report.md          generated each build; the fix-list for source sheets
  .build-snapshot.json  powers the "New since last build" diff
  README.md             how to refresh the data
src/
  data/
    types.ts            canonical types
    universities.ts     carousel items (home page logo band)
    program-info.ts     HAND-RESEARCHED requirements, with sources + dates
    generated/*.json    ETL output (committed; programs, universities, stats,
                        plus summary.json — a ~1kB totals + featured-programs
                        file the Home page imports eagerly, since programs.json
                        is far too big to load on the landing page)
  lib/
    dataSource.ts       the ONE seam to swap if a backend ever lands
    search.ts           pure search/filter/sort + findProgram/similarPrograms
  components/           Tabs, UniversityMark, AverageDistribution, Carousel,
                        Roadmap, Parallax, CountUp, Reveal, ThemeToggle, ui/*
  pages/                Home, ExplorePreview, Program, Placeholder
```

**Commands**

```
npm run dev          dev server on :5173
npm run build        typecheck + production build
npm test             79 tests
npm run data:build   regenerate dataset from data/raw/
npm run data:check   same, but report only — does not write the dataset
npm run shots        screenshot the dev server (see below)
```

**Visual checks.** `npm run shots` captures `/`, `/explore` and a program page
at 375 / 1512 / 2560 in both themes, into a gitignored `.shots/`. It drives the
Chrome already installed on the machine via `puppeteer-core` (a devDependency —
no browser download, nothing added to the app bundle). Needs `npm run dev`
running.

```
npm run shots -- explore                       one route
npm run shots -- --full                        full page, not just the viewport
npm run shots -- home --section="Popular right now"    just that section
```

It forces `prefers-reduced-motion` and waits for animations to settle, because
`Reveal` fades content in over 0.6s with a stagger and screenshotting mid-flight
produces half-transparent elements.

---

## 4. Architecture decisions worth not re-litigating

**The catalogue has no backend, deliberately.** The team moderates submissions by
hand, so the spreadsheet *is* the database and admin panel. A build step turns it
into JSON. A write-backend is only needed if submissions ever happen directly on
the site. `src/lib/dataSource.ts` is the single seam if that changes. This is
unaffected by accounts: program data still ships as static JSON, and the account
server knows nothing about it.

### Accounts (added 2026-08-18)

Username and password, against a service in **its own repository**:
<https://github.com/TheKeems/UniServer> — Express + Mongoose + JWT, with its own
test suite, deployed to Render at `uniserver-632q.onrender.com`. It is not
vendored into this repo, so nothing here builds or tests it; treat it the way you
would any other external API.

The client points at that host by default (`API_BASE`, `src/lib/api.ts`) and
`VITE_API_BASE_URL` overrides it at build time — the deploy workflow sets it
explicitly so the endpoint is visible there rather than buried in a fallback.

**Check the service before assuming sign-up is broken**:
`curl https://uniserver-632q.onrender.com/api/health`. A 404 means the account
routes are not deployed, and the app says exactly that rather than showing a
password error. A slow first response is the free tier waking up, which every
call site treats as "waking up" rather than as a failure.

Two things that live outside this repo and are worth knowing:
`ALLOWED_ORIGINS` on the service narrows CORS (it falls back to `*` when unset),
and the accounts sit in a MongoDB Atlas cluster — so who holds those credentials
is a question about the backend repo, not this one.

What was decided, and why, in the order you will want it:

- **An account is optional, not a gate.** Every route works signed out and nothing
  redirects to a sign-in page. Signed-out visitors keep the original localStorage
  key, so adding accounts stranded nobody's existing shortlist.
- **localStorage is the working copy; the server is the durable copy.**
  `src/lib/sync.ts`. The dashboard reads the profile synchronously in dozens of
  places, so making reads remote would have meant a loading state in every Keep
  button and an unusable site while a free-tier server wakes up. Writes land
  locally, then push on a 1.5s debounce. Sign-in pulls. **Conflict rule: last write
  wins, per whole profile** — two devices editing between sign-ins do not merge, and
  the account page says so.
- **The password is hashed on the server, never in the browser.** It was hashed
  client-side for a few hours when accounts were local; that code was deleted
  rather than ported, because a server that accepts a client-computed digest has
  made the digest the password. scrypt, in `passwords.js` in the backend repo.
- **The exact average is now uploaded**, for a signed-in student. It used to be the
  one number the site promised never to send. That trade is the point of an account
  — a profile that follows you to another device — but the promise was load-bearing,
  so every piece of copy claiming "never uploaded" or "stays on your device" was
  rewritten (Survey, dashboard rail, OverviewView, CourseChecklist, both auth
  pages). **If you add a "your data stays private" line anywhere, check it is true
  for the signed-in case first.**
- **Still no email, no real name, no age, no school.** The rule that killed the
  original survey's name and age fields did not move. No email also means no
  password reset, which is stated on the sign-up page rather than discovered later.
- **`POST /api/data` stayed anonymous.** No account id, no username, a five-point
  band rather than an exact average, and the server drops those fields if a client
  ever sends them. It is telemetry about whether the funnel works, not a record of
  who answered what — keep it that way, and see the header of `src/lib/api.ts`,
  which is the one file listing everything that leaves the device.
- **Offline is not signed out.** A failed token check leaves the student signed in;
  only an outright 401 signs them out. A failed push keeps the data and a dirty
  flag, and retries on the next edit, on `online`, and when the tab is shown.

**Data is lazy-loaded.** `programs.json` (95kB gzipped) and `stats.json` (63kB)
load via dynamic import, so they're separate chunks and never touch the Home
page bundle. Verify after any change that `programs-*.js` stays a separate
chunk in the build output.

**Tuition is not cached.** Every fees page checked either deferred to a
sub-page or said figures "are finalized in the spring". A copied figure is wrong
within months. Recommendation (not yet implemented): store the official fees
**URL** per university and link out.

**Motion is the one animation library.** `motion` (motion.dev) v13 is already a
dependency and drives `Reveal`, `Parallax`, `CountUp`, `Roadmap` and the Home
scroll-zoom, always gated behind `useReducedMotion`. Reviewed 2026-08-08 and
decided against adding more: **anime.js** duplicates what Motion already does in
React (two animation systems, two mental models, more bundle, no capability this
site is missing), and **Bklit** charts conflict with the library-free histogram
below. **KokonutUI** is worth using but is *not* a dependency — its components
are copy-in and already assume Motion + Tailwind, so paste individual ones in as
needed.

**Motion timings come from the `ui-ux-pro-max` motion table**
(`~/.claude/skills/ui-ux-pro-max/data/motion.csv`), not taste. Scroll reveals
are 400ms at `y: 12` (its Subtle tier: *"keep the y offset small (8-16px) so it
reads as a fade, not a slide"*), staggers are 0.04s/item (it warns against more
than 0.1s per item and more than ~8 staggered children), and the hero settles in
0.61s rather than the old 0.98s. If motion starts feeling sluggish again, check
these numbers before adding anything new.

**The hero section must not clip.** Its `overflow-hidden` now lives on the inner
decorative layer, not the `<section>`. It was on the section to contain the
blur blob, but it also cut off the search suggestions, which drop below the
hero's bottom edge. Verified no horizontal overflow at 375 / 1512 / 2560 after
the change.

**Analytics gates live in `src/lib/analytics.ts`, not in JSX.** Nothing renders
below 5 reports in a group. That is why the offers-vs-rejections comparison is
absent on most pages: only **22 of 2,436** programs have 5+ reported rejection
averages, and only 3 have 20+. The cycle trend drops thin years for the same
reason — McMaster Engineering has n=2 for 2022-23 against n=153 for 2025-26, so
plotting every cycle would show a trend in reporting volume, not admissions.

**`pct()` in `analytics.ts` must match `percentile()` in `scripts/normalize.mjs`.**
Both interpolate between neighbours. A nearest-rank version made the same
program read 95.9% in the page header (from the ETL) and 95.8% in the
offers-vs-rejections strip. There is a regression test pinning this.

**Charts follow the `dataviz` skill.** Load it before touching chart code. The
histogram uses a single sequential hue, hairline gridlines, 2px surface gaps,
labels only on the median, and a table view so no value is tooltip-only. The
fill is a dedicated `--color-chart` token because dark mode's lightness band
(0.48–0.67) is narrower than light's (0.43–0.77) and the UI brand step falls
outside it. **Re-run the palette validator if that colour changes.**

---

## 5. Data pipeline

```
Google Form -> Google Sheet -> [team reviews] -> export .xlsx to data/raw/
   -> npm run data:build -> src/data/generated/*.json + data/qa-report.md
                            (including summary.json — the Home page's numbers
                             come from here, so they can never drift from the
                             dataset the way hand-typed figures did)
```

**Current dataset:** 10,372 records kept from 11,701 rows across 4 sheets →
**2,436 programs, 39 universities**. 369 programs have ≥5 reported offers and
therefore a usable chart; the rest are flagged `insufficientData` and render as
"not enough data yet" rather than showing a median from one submission.

**Refresh loop:** export sheet → drop in `data/raw/` (keep the filename) →
`npm run data:build` → read the **"New since last build"** section at the top of
`data/qa-report.md` → record decisions in `data/overrides.json` (never in the
sheet) → re-run until the new-work section is empty → commit `data/raw/`,
`src/data/generated/`, `overrides.json` and `.build-snapshot.json`.

**Adding a sheet:** add an entry to `SOURCES` in `scripts/build-data.mjs`.
Each sheet has its own column order, so a new export means a new adapter.

**Gotcha that cost 80% of the data once:** some .xlsx exports namespace every
XML element (`<x:worksheet>`), others don't. The parser needs
`removeNSPrefix: true` or half the sheets silently read as empty.

**Outstanding in the QA report:** 68 unrecognised university spellings,
46 rows with no usable program name, 1,416 possible duplicate programs (sorted
by volume; deliberately not auto-merged — "Engineering I" and "Engineering I
(Co-op)" are different programs).

---

## 6. What's built

| Page | State |
|---|---|
| **Home** (`/`) | Complete. Hero + **typeahead search** (`HeroSearch.tsx` — suggests programs as you type, keyboard-navigable combobox, loads the catalogue on first focus so the Home bundle stays clean), stats band with scroll-zoom, university logo band, pinned full-screen roadmap, program cards, two carousels, CTA. |
| **Explore** (`/explore`) | **Interim.** Search works over all 2,436 programs; results are 3-per-row cards linking to program pages, 30 at a time behind a "Show more", with a live result count. Every program is reachable — low-data ones render "not enough data yet" rather than being hidden. **No filter UI yet** — that is the remaining gap. |
| **Program** (`/program/:universityId/:slug`) | Complete. Four tabs: General, Analytics, Requirements, Extras. Analytics carries the distribution histogram, the range readout, median by admission cycle, an offers-vs-rejections comparison (gated), the decision mix bar, and similar programs. |
| **Profile / Community / About** | Still `Placeholder` stubs. |

Also built: dark mode (defaults to light, remembers choice), paper/grid
textures, `.container-page` scaling for large monitors, fluid `clamp()` type,
accessibility pass (focus-visible, skip link, ARIA tabs).

---

## 7. Research: verified requirements

**75 programs verified from official university pages, covering 3,412 of 10,372
student reports (33%).** Every entry in `src/data/program-info.ts` carries its
source URLs and the date the page was read; both render in the UI. Anything a
page doesn't state is left out and shows as "Not verified yet".

By school: `waterloo 29 · toronto 11 · tmu 11 · queens 8 · western 5 ·
guelph 4 · york 3 · mcmaster 2 · laurier 2`

| Tier | Done | Left |
|---|---:|---:|
| ≥50 reports | 22 / 31 | **9** |
| ≥20 reports | 58 / 94 | **36** |
| ≥10 reports | 74 / 199 | **125** |

### Patterns that make research fast

- **Consolidated requirement tables are gold.** Queen's publishes one Ontario
  page covering every program (8 programs from one URL). Guelph the same (4).
  U of T Engineering's FAQ names every stream against one of two competitive
  bands (8 programs). **Check for one of these before going program-by-program.**
- **Predictable URLs.** Waterloo (`/future-students/programs/{name}`), TMU
  (`/programs/undergraduate/{name}/`) and Laurier
  (`/programs/{faculty}/undergraduate/{program}/index.html`) can be walked
  directly.
- **Faculty pages beat central admissions pages.** Central pages are often
  JS-rendered or just link onward; faculty sites (Schulich, Smith, Lassonde,
  Ivey, Waterloo Engineering) state requirements plainly.
- Per-program fetching is worth it even when prerequisites are shared — at
  Waterloo the courses are identical across engineering streams but the
  admission ranges and **co-op-only status** are not, and that's what a student
  actually needs.

### Blocked sources — do not waste time re-trying blind

| Source | Problem |
|---|---|
| **McMaster** | Requirements are an interactive JS tool; academic-calendar pages return empty; program pages redirect to upper-year sites. Blocked by every route tried. |
| **U of T Arts & Science** | Requirements page sits behind a bot check. Not worked around. |
| **uOttawa** | Returns HTTP 402 to fetches. |
| **Western** (welcome.uwo.ca) | JS-rendered; returns blank. Faculty sites (Schulich, Ivey, Science, Health Studies) *do* work. |
| **eINFO** (`electronicinfo.ca`) | **Domain has lapsed** and now 301s to an unrelated commercial site. Not a usable source; still cited in old guidance material. |
| **OUInfo** (`ouinfo.ca`) | eINFO's official successor, content from the universities — right kind of source, but 404s on every direct fetch. Findable via search, not verifiable. |
| **myBlueprint** | Data behind school/board login, no public API. Also a commercial competitor — lifting their database is a licensing problem and undercuts the site's whole premise. Their *card layout* was used as a design reference, which is fine. |

**The cheap unblock:** a human opens the McMaster or uOttawa page in a browser
and pastes the requirements text. Structuring and citing it takes seconds.

---

## 8. Jobs remaining

### Immediate / high value

1. **Explore filter UI.** The functions already exist and are tested —
   `filterPrograms` in `src/lib/search.ts` supports university, province, field,
   difficulty band and median ceiling. There is no UI for any of them. The
   reachability half of this was fixed on 2026-08-08 (paging replaced the hard
   20-result cap, and low-data programs are no longer hidden); the filter
   controls are what remain. **Biggest gap between what's built and what's
   usable.**
2. **Finish the ≥20-report research tier** — 36 left, of which ~20 sit at the
   blocked schools (McMaster 12, Western, uOttawa). Needs pasted page text.
3. **Profile page + alignment engine.** The core differentiator and still a stub.
   Survey (grades, interests, budget), stored in `localStorage`, then "how you
   compare" against a program's accepted-average distribution. Keep the engine as
   pure functions in `src/lib/` so it's testable. **Must not output a probability
   of admission.**

   The "no accounts — decided" note that used to be on this line is out of date:
   accounts were added on 2026-08-18 and moved to the server the same day. See
   **§ Accounts** below before touching any of it.

### Assets the user is sourcing

4. **Square university logos** → `public/images/universities/square/{id}.svg|png`.
   **0 of 39 present.** README there lists all 39 ids ordered by report volume
   with a running cumulative share — the top 11 cover ~88%. Until they land,
   `UniversityMark` renders a coloured monogram, so nothing is broken.
   (The 8 wide wordmarks in the parent folder are a different asset, used by the
   Home logo band. Don't mix them up — wordmarks are unreadable at 40px.)
5. **Hero photos, program card banners, testimonial avatars.** Currently
   gradient placeholders. Specs were given: hero frames 448×560 / 352×352 /
   320×240; card banners 16:9; avatars 144×144.
6. **OG share image** (1200×630) — meta tags are in place, image is not.

### Later milestones

7. **Community page** — submission form (a Google Form embed keeps the
   no-backend architecture intact), moderated feed, links to the source sheets.
8. **About page** — data sources, methodology, the reporting-bias explanation,
   privacy (local-only) statement.
9. **Extras tab content** — recommended extracurriculars. Deliberately empty
   for now. Ivey's stated 50/50 academic/leadership weighting is the kind of
   sourced claim this should be built from, not generic advice.
10. **Tuition as links, not cached figures** (see §4).
11. **Real testimonials.** The home page had three invented students ("Priya,
    Grade 12 · Mississauga"). Removed 2026-08-08 — fabricated quotes are the
    one thing that would undercut a site whose pitch is not misleading
    students. Restore the section only with real, consented submissions, which
    is a natural output of the Community page (#7).

### Housekeeping

12. PR #3 (wireframe-only) is still open and now redundant — its content is in
    `main`. Safe to close.
13. The `wireframe/` folder is the original grey-box HTML mockup. Superseded by
    the React app; keep or delete as preferred.
14. `feature/*` branches from the wireframe era (`feature/explore`,
    `feature/profile`, `feature/community`, `feature/about`) predate React and
    contain nothing useful. Delete rather than build on them.

---

## 9. Known quirks

- **Vite HMR can serve stale CSS** after many edits in one session — dark mode
  appeared broken (light background, light text) until a hard reload. If
  something looks impossible, hard-reload before debugging.
- **The in-app Browser pane only renders while it is visible.** If it is
  collapsed, Chrome stops compositing that page: screenshots time out with
  "the Browser pane is not displayed", and `loading="lazy"` images never fetch
  (a page that is not rendering never decides an image is in view). This cost
  most of a session — logos looked broken when they were fine. **Use
  `npm run shots` instead**, which drives headless Chrome and does not care
  about the pane.
- **Lenis smooth scroll fights programmatic scrolling.** `window.scrollTo` gets
  reverted, which makes automated screenshots of mid-page sections unreliable.
  Use real wheel events, or verify via DOM measurements. `npm run shots` sidesteps
  this by forcing `prefers-reduced-motion`, which disables Lenis.
- **Windows line endings** produce LF/CRLF warnings on every commit. Harmless.
- **`npm audit`** reports 2 high advisories in react-router. Both are
  SSR/RSC-only and do not apply to this client-only SPA.
