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

## P1 — The empty Overview

`src/pages/dashboard/OverviewView.tsx`. This is the priority.

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
- **Courses** already lists the nine courses to tick, which is good. Its "what
  your list needs" half is empty — say what will appear there.
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
- **`gapFor` is walked twice** over the same list — `gapCount` in
  `DashboardShell` and `courseMix` in `OverviewView`. Compute once in the shell
  and pass both through `DashboardContext`.

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

Baseline to hold: 0 lint errors, 246 tests, sweep 125/125, sections 26/26,
motion `minVisible 0.55` and `0 dark frames`.

**`scripts/sweep.mjs` depends on the string `Programs kept` in four places** —
`VIEWS` at line 415, `overview counts the seeded profile` at 459, and two
accounts checks at 507–508.

All four open the dashboard with `{ seed: SEED }`, i.e. a profile with programs
already kept, so they exercise the **populated** view. That means P1.1 as
described here — swapping the tiles only when `kept.length === 0` — does not
touch them. Changing the populated tiles as well breaks all four at once, so
update them in the same commit if you go further than the empty state.

The empty state is the thing being changed, so test it *as* the empty state:
clear `localStorage`, answer the survey skipping every question, and confirm the
Overview is worth looking at with nothing kept. Then keep one program and confirm
the populated view still works. Check both themes and 375px — the sweep covers
overflow at 375/1280/2560 but will not know about new sections.
