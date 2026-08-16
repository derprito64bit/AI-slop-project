# Handoff — pick up here

Read `HANDOFF.md` first for the project as a whole (rules, data pipeline,
architecture). This file is only about **work in flight**.

Written 2026-08-14. Worktree: `.claude/worktrees/project-handoff-review-2266a1`.

---

## 1. Where the code is

| | |
|---|---|
| `origin/main` | `1a1a296` — deployed, live at https://derprito64bit.github.io/AI-slop-project/ |
| Current branch | **`feature/survey-matching`** — 3 commits ahead of main, **pushed, not merged, no PR opened yet** |

Commits on the branch, oldest first:

1. `1fed62c` Survey that narrows 2,436 programs into a shortlist
2. `ab394a2` Turn the profile into a planning dashboard
3. `ee957a7` Rebuild the dashboard as a sidebar shell

**121 tests green, build clean, `programs-*.js` / `stats-*.js` still separate
chunks.** Working tree is clean.

Other branches worth knowing:
- `claude/glass-demo` — a *demo only* of frosted-glass surfaces on 4 home-page
  elements. Deliberately never merged. The user's verdict: chrome yes, data no.
- `claude/project-handoff-review-2266a1` — the old working branch, merged.

## 2. What's on the branch

A survey → dashboard flow, built on top of a contributor's fork
(`TheKeems/AI-slop-project-survey`, by James Zeng).

- `/survey` — 4 questions that map **one-to-one** onto filters already tested in
  `src/lib/search.ts` (field, province, `medianAtMost`, plus an ambition setting
  that shifts the median ceiling −2/+3/+8). No second matching engine.
- `/profile/*` — a sidebar dashboard with four tools: **My list** (notes,
  student-invented labels), **Balance** (ambitious/in-range/comfortable vs the
  student's own average), **Courses** (prerequisite gap finder), **Compare**
  (up to 4 side by side). Each is its own route, so deep links and Back work.
- `KeepButton` on Explore cards and program pages, so **the survey is optional** —
  keeping a program creates a profile on demand.

### What changed from James's fork, and why
His request handling in `api.ts` was kept wholesale (base-URL override,
trailing-slash strip, 45s timeout for Render's cold start, the note that `fetch`
doesn't reject on 4xx/5xx), as were his `Field`/`inputClass` helpers and
validation.

**The payload changed.** His version posted a student's **name and age** from an
audience that is mostly minors, with no consent copy — a direct breach of the
project's no-PII rule. It now posts only
`{field, province, averageBand, ambition, matchCount}`; the exact average never
leaves the device. Verified by intercepting the request.

## 3. The approved plan — start here

Full plan: `C:\Users\Aaron\.claude\plans\merge-it-into-main-dreamy-adleman.md`

Three PRs, approved, **none started**:

- **PR 1 — motion foundation + carousel fix.** Revive `src/lib/motion.ts` and
  `MotionConfig reducedMotion="user"`; route transitions (~260ms in / ~180ms
  out); first-load loader (session-gated, ~800ms cap) then skeletons; Explore
  cards stagger on scroll (first 8 only); Roadmap flag pin-drop; **fix the
  carousel**.
- **PR 2 — survey as a sequential form + nudge card.** One question per step in
  a compact centred card, progress indicator, Back, **Skip per question and Skip
  all**. Plus a dismissible card mounted in `Layout.tsx`, triggered by
  *engagement* (≈2 program pages, or ~45s + scroll), never shown if a profile
  exists or after dismissal.
- **PR 3 — profile build-out.** Sidebar groups: **Plan** (built) · **Discover**
  (Programs with full filters, Fields) · **Track** (Applications tracker,
  Deadlines*) · **Community** (Global posts*). Plus a "what if my average
  changes" slider and share/export via URL param. `*` = clickable placeholder
  with real layout, mock content and a visible "not live yet" banner.

## 4. Measured facts — don't re-derive these

- **Carousel bug is real and width-dependent.** `Carousel.tsx` duplicates the
  list once and slides `-50%`, which only loops if one copy exceeds the
  viewport. One copy is **1,357px** (logo band) / **1,668px** (trending). Fine
  at 1280px; **gap trails the last item at 1920px and 2560px**. Fix: repeat
  until wider than the container, animate `-100/copies %`.
- **Skeletons are a layout-shift fix, not decoration.** They took Explore's CLS
  from **0.34 → 0.001** and Program's **0.14 → 0**. The reserved height must go
  on the **wrapper, outside the delay gate** — inside, it doesn't exist during
  the 300ms wait and the footer still jumps (that mistake measured 0.25).
- **Requirements coverage**: 67 programs verified — 18% overall, but **~66% of
  the top 50 most-reported**, which is what a shortlist surfaces.
- **Course requirement text**: 69 distinct strings for ~10 courses. `courses.ts`
  normalises them; anything unresolved becomes a note shown verbatim and is
  **never counted as a gap**.
- **Research is blocked, not incomplete.** 36 programs remain in the ≥20-report
  tier; **25 sit at McMaster (JS-only requirements tool), U of T Arts & Science
  (bot check), Western (JS-rendered) and uOttawa**. Re-tested 2026-08-14, all
  still blocked. Needs pasted page text from the user.

## 5. Gotchas that cost real time

- **`npx vite preview` does not serve at the deploy base.** `vite.config.ts`
  only applies `base: '/AI-slop-project/'` when `command === 'build'`, so
  preview serves at `/` while `dist/index.html` requests `/AI-slop-project/...`
  — every asset 404s and you get a **blank page that looks like a broken
  build**. Use:
  `MSYS_NO_PATHCONV=1 npx vite preview --port 4200 --base /AI-slop-project/`
  (the MSYS var stops Git Bash rewriting the base into a Windows path).
  It also **caches its file list at startup** — restart after every rebuild.
- **The in-app Browser pane doesn't composite.** Screenshots time out and lazy
  images never load. Use `npm run shots` (headless Chrome via `puppeteer-core`),
  or drive Chrome inline with
  `node --input-type=module -e '...'` using **forward slashes** in the Chrome
  path — backslashes get mangled through Bash.
- **React state in rapid handlers.** Toggles that derive the next value from
  React state lose all but the last click when fired in one frame. `toggleCourse`
  reads from storage for exactly this reason; follow that pattern.
- `git checkout main` fails in this worktree — `main` is checked out in the
  primary repo. Reverts/merges must go through the remote.

## 6. Open items the user has flagged

- `/about` blurb still says *"how we calculate your odds"* — contradicts the
  no-probability rule. One-line fix, user has been told twice.
- Deadlines need their own **sourced research** pass (official pages, cited,
  dated) before shipping — a wrong deadline is the worst failure mode here.
- Nothing on `feature/survey-matching` has been merged or deployed. `main` is
  unaffected by all of it.
