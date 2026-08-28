# Dashboard backlog

Read `CLAUDE.md` first for the rules that do not bend, and `HANDOFF-NEXT.md` for
where things currently stand. This file is only about what to build in the
dashboard, in the order worth building it.

Written 2026-08-28, after the map and admin work landed.

---

## The problem, measured

The dashboard's tools are built and correct. They are also **nearly blank for a
student who has just arrived**, which is every student on their first visit.

Measured on the live site with a profile that has answers but nothing kept:

| View | Body text | Rendered height |
|---|---:|---:|
| Overview | 699 chars | 827px \* |
| My list | 1,002 | 827px \* |
| Balance | 504 | 827px \* |
| Courses | 706 | 827px \* |
| Compare | 506 | 827px \* |
| Applications | 723 | 827px \* |
| Deadlines | 822 | 827px \* |
| Account | 907 | 827px \* |
| **Map** | 2,222 | 1,389px |
| **Programs** | 3,601 | 2,496px |
| **Fields** | 4,409 | 2,305px |
| **The data** | — | 3,770px |

\* 827px is the `min-h-[60vh]` floor in `DashboardShell`, not content. Those
eight views are mostly whitespace.

**The split is not random.** The four rich views read the *dataset*. The eight
empty ones read the *student's list*. The site knows 2,436 programs, 369 of them
with enough reports to chart, from 10,372 reports — and shows a new student none
of it on the page meant to orient them.

The Overview is the worst case: it is the front door, and all three charts added
in the last round are gated behind `hasList` (`OverviewView.tsx:104`, used at
`:236` and `:249`). A new arrival gets four zeros, two apologetic cards, and
"Nothing yet".

**The goal: a dashboard worth looking at before you have done anything, without
inventing a single number.**

---

## P1 — The empty Overview — **DONE 2026-08-28**

`src/pages/dashboard/OverviewView.tsx`. Shipped on
`feature/overview-empty-state`. Kept below because the reasoning is still the
argument for P2 and P3, and because two things were decided differently from
what is written here:

- **1.2's "reuse `KeepButton`" was wrong.** That component owns its own state
  and writes straight to localStorage, so a click would never reach
  `setProfile` and the empty state would survive it until a remount — the one
  thing 1.2 exists to prevent. The markup was extracted instead as
  `KeepControl` (a named export of `KeepButton.tsx`), controlled, wired to
  `setProfile(toggleShortlist(id))`. `ProgramsView` and `ListView` still carry
  their own inline copies; migrating them onto `KeepControl` is a clean
  follow-up.
- **The empty state is gated on `profile.shortlist.length`, not `kept.length`.**
  `kept` resolves ids against the lazily-loaded catalogue, so it is `[]` on the
  first paint of *every* visit — gating on it flashes the onboarding path at
  every returning student, every load.

1.3's `summarise()` moved to `src/lib/fields.ts` as planned; the three-step path
and the featured-card ids live in `src/lib/overview.ts`, both pure so the
node-only Vitest can reach them.

### 1.1 Replace the four zeros with a path

When `kept.length === 0` the `Stat` row is a scoreboard of failure — `0`, `0`,
`0`, `—`. Swap it for a three-step checklist that shows real progress and links
to each tool:

- Answered the questions — ticked when `profile.answers` is non-null
- Kept a program — `0/1`
- Ticked your courses — `n/9`, from `COURSES` in `src/lib/courses.ts`

Keep the existing `Stat` tiles for the populated case. They are right once the
numbers mean something.

### 1.2 Show what the site knows, with a way in

Below the path, a "Worth a look" section: the most-reported programs as cards,
each with a Keep button. One click ends the empty state, which is the point.

- **`SUMMARY.featured` in `src/data/generated/summary.json` already has exactly
  the right shape** — `{ universityId, slug, name, school, median, sampleSize }`,
  six entries. `POPULAR_ITEMS` in `src/data/universities.ts` already reads it, so
  there is precedent.
- Reuse `KeepButton` (`src/components/KeepButton.tsx`) and `UniversityMark`.
- If six is too few, derive from `data.programs` sorted by `totalReports` with
  `insufficientData` filtered out — the same filter `FieldsView.summarise` uses.

### 1.3 Use the answers they actually gave

If `answers.field` is set, show that field's real summary — "Engineering:
typical reported median 94.3% across 110 of 422 programs".

**That computation already exists** as `summarise()` in
`src/pages/dashboard/FieldsView.tsx`. Extract it to `src/lib/fields.ts` and
import it in both places rather than writing a second copy. If every question was
skipped, fall back to the dataset-wide picture.

### 1.4 Leave a note about the gate

No code change. Write down *why* the charts are gated on `hasList`, so the next
person does not "fix" it by rendering an empty spread chart.

---

## P2 — The other blank tools

Each should answer "what will this look like once I have used it?", not only
"you have nothing".

- **Compare** (`CompareView` / `CompareTable`) is the starkest at 506 chars —
  its empty state is one sentence. Pre-stage the two most-reported programs from
  the student's list, or when the list is empty, point at My list with the count.
- **Balance** needs an average and says so. Give it a one-click route. `/survey`
  always starts at question 1; either add a `?step=average` param or label the
  link honestly about where it lands.
- ~~**Courses**~~ — **DONE.** The "what your list needs" half now opens with a
  rollup of the whole list rather than repeating a per-program sentence on every
  card: how many courses the list names, how many the student holds, which one
  the most programs want, and which ticked course nothing asks for. It states
  its own coverage, because most shortlists are mostly unresearched.
- **Applications / Deadlines** are real tools with nothing in them. Offer to seed
  from the kept list: "Add your 3 kept programs to the tracker". `src/lib/
  tracker.ts` owns that state — **do not move it into the profile**, see
  `HANDOFF-NEXT.md` §3 on the sync whitelist erasing it.

---

## P3 — Use the three answers already being collected

The survey grew to eight questions. Three of the new answers are stored, synced,
and barely read.

- **`gradYear`** — nothing reads it at all. The Overview could say which
  application cycle describes them and how many reports that cycle holds
  (`stats.json` carries `c`). Keep it out of `/api/data`.
- **`homeCity`** — only `MapView` uses it. "Four of your six schools are within
  100km of Mississauga" belongs on the Overview or My list. `distanceKm`
  (`src/data/campus-locations.ts`) and `CAMPUS_POINTS`
  (`src/data/campus-points.ts`) both already exist.
- **`coop`** — only filters Programs. The rail's "Your answers" block shows four
  of seven answers; add the missing ones.

---

## P4 — Polish, and the optimisations that are real

- **`ListSpread`** in `src/components/ListCharts.tsx` filters and sorts in the
  component body on every render. Wrap in `useMemo`. Small but real.
- ~~**`gapFor` is walked twice**~~ — **DONE.** It was five times, not two:
  `gapCount` in `DashboardShell` (memoised on the whole `profile`, so renaming a
  tag re-parsed every requirement), `nextGap` in `OverviewView` (unmemoised, and
  it mapped the entire shortlist before `.find()` could short-circuit),
  `courseMix`, `CourseChecklist.rows`, and `CompareTable`. Now one `listNeeds`
  call in the shell, on `DashboardContext.needs`.

---

## Explicitly not worth doing

Named because each looks like an improvement and is not.

- **Do not defer the catalogue load per view.** All twelve views consume
  `useDashboard()` and nearly all need `kept` / `byId` / `uniName`. Loading it
  once in the shell is correct, and `programs.json` is already a lazy chunk of
  about 95kB gzipped.
- **Do not add a chart library.** `ListCharts`, `DecisionMix`, `CycleTrend` and
  `AverageDistribution` are hand-rolled SVG on purpose and share one palette.
- **Do not add pie or line charts without asking.** The reasons against are
  recorded in `DecisionMix` (slices under 5% are unreadable; deferred is often 1
  in 200) and `CycleTrend` (a line implies continuity between points measured
  from very different sample sizes). They have not changed.
- **Do not put a number in the editable content collection.** Prose only. The
  server schema has no numeric field, and that is what stops an admin's edit
  contradicting a median.
- **Do not remove the `min-h-[60vh]` floor** to tighten the empty views. It
  stops the footer flying up the page on every tool switch.

---

## Verifying dashboard work

```bash
npm run lint && npm test
```

```bash
npm run build
```

Then the `vite-preview` entry in `.claude/launch.json` (port 4200, base
`/AI-slop-project/`), restarted after each rebuild.

```bash
npm run sweep && npm run sweep:sections && npm run probe:motion
```

Baseline to hold: 0 lint errors, 282 tests, sweep 135/135, sections 26/26,
motion `minVisible 0.55` and `0 dark frames`.

**`scripts/sweep.mjs` depends on the string `Programs kept` in five places**, not
the four this file used to claim — the `VIEWS` `must` entry, `overview counts the
seeded profile`, the accounts check, and `/\d+ programs? kept/i` twice in the
`/list` block, which matches `ListView.tsx`'s header rather than a tile.
`AccountView.tsx` renders the same label and is not asserted at all.

They all read a **populated** dashboard, so an empty-state-only change does not
touch them — but the mechanism differs, and the correction matters if one ever
fails: the `VIEWS` and overview checks open with `{ seed: SEED }`, while the
accounts one uses `seedOnce`, wipes `localStorage` and repopulates from the live
server. That one also fails when sync breaks, not only when a label changes.
Changing the **populated** tiles breaks all five at once; update them in the same
commit if you go further than the empty state.

The empty branch now has its own coverage — the `NEW_SEED` block at the end of
`sweepDashboard` seeds answers with an empty shortlist and asserts the path, the
absence of the zero tiles, the field summary, and that **one click on a Keep
control ends the empty state without a reload**. That last one is the check that
would have caught using the uncontrolled `KeepButton` here.

Still worth doing by hand, because no sweep knows what a page looks like: clear
`localStorage`, answer the survey skipping every question, and confirm the
Overview is worth looking at with nothing kept. Check both themes and 375px — the
sweep covers overflow at 375/1280/2560 but will not know about new sections. Two
layout bugs got through every automated check here and were only visible in a
screenshot: the dashboard content column is roughly 560px, so a three-column card
grid truncated every program name to two letters, and `truncate` on the path
labels rendered them as "Answer the q…".
