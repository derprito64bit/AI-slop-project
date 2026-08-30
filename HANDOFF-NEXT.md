# Handoff — pick up here

Read `HANDOFF.md` first for the project as a whole (rules, data pipeline,
architecture). This file is only about **where things stand now**.

Rewritten 2026-08-28 at the end of a long session, and **appended to later the
same day** by the session on `feature/uncropped-marks` — see §0. Every claim was
probed rather than assumed, and where a claim from the earlier pass turned out
to be stale it has been corrected in place with the evidence, rather than
quietly deleted.

---

## 0. The later session, in short

Three things, all on `feature/uncropped-marks`:

1. **The eight cropped crests are now the full lockups.** Guelph, McMaster,
   Ottawa, Queen's, Toronto, Waterloo, Western and York had their crest cut out
   of the lockup each school publishes. The crops were tight and correct, and
   the mark they shipped is one no university publishes. Artwork supplied by
   the maintainer; nothing is cropped now. §2 has the legibility trade.
2. **A Rule 1 violation was live in `index.html` the whole time.** `<title>`,
   `og:title`, `twitter:title` and the meta description all still read "Find
   where you actually get in" — the exact claim #35 pulled out of the `<h1>`.
   The audit read components; `index.html` is not one. The sweep now has a
   fifth honesty check that reads the document head, so it cannot come back.
3. **P2 is done** — Compare's zero state, Balance, Applications and Deadlines.
   Details in §4.

**Two claims in the 2026-08-28 pass were already stale when it was written**,
which is the thing to take from this rather than the fixes: both were about work
that had landed in an earlier PR of the same session. Compare's one-program
empty state (fixed in #35) and the `xl:` count. Both are corrected below where
they appear.

---

## 1. Where the code is

| | |
|---|---|
| `origin/main` | deployed and live at https://derprito64bit.github.io/AI-slop-project/ |
| Working state | **no open PRs, no unmerged work**, both repos clean |
| Backend | `TheKeems/UniServer` — accounts live, content and map routes **not deployed**; see §3 |

Twelve PRs merged this session: **#32** the empty Overview, **#33** the handoff
refresh, **#34** university crests, **#35** the copy audit, **#36** the course
matcher, **#37–38** housekeeping, **#39** crest extraction, **#40** elevation and
the sidebar, **#41** chart motion, **#42** interaction states, **#43** page
rhythm.

Two remote branches are unmerged and correctly so: `gh-pages` is the deploy
target, and `origin/account` is an obsolete orphan whose content landed in #24.

**Baseline, measured against a production build served at the deploy base:**

```
npm run lint            0 errors
npm test                361 pass          (357 before this pass; 305 before P3; 246 at the start)
npm run sweep           165 of 165        (151 before this pass; 136 before P3)
npm run sweep:sections  26 of 26
npm run probe:motion    minVisible 0.55, 0 dark frames
                        — five of six rows. The charts row reports minVisible 0
                        and ~53 dark frames: the probe used to watch the wrong
                        element and that `1` measured nothing. See CLAUDE.md.
cd ../UniServer && npm test               133 pass
```

**Both sweeps default to the LIVE site.** Point them at a local build with
`SWEEP_BASE=http://localhost:4200/AI-slop-project`.

**Two verification traps cost real confidence this session** and are both in
`CLAUDE.md`: a stale `vite preview` will happily verify the wrong build (`pkill`
does not reliably kill it, and without `--strictPort` the replacement moves to
the next port while `SWEEP_BASE` keeps hitting the old one — eight had
accumulated); and `vite preview` answers 200 with `index.html` for a missing
file, so a green *local* sweep never proves an asset exists.

---

## 2. What was built

### The dashboard's empty state (#32, #36)

`/profile` used to greet a new student with four zeros and two apologies. It now
shows a three-step start path, the real summary for the field they named, and
the six most-reported programs with a Keep control on each.

**Two things worth not undoing.** The empty state is gated on
`profile.shortlist.length`, not `kept.length` — `kept` resolves against the lazy
catalogue and is `[]` on the first paint of *every* visit, so gating on it
flashes the onboarding path at every returning student. And the dashboard uses
`KeepControl` (controlled) rather than the default `KeepButton`, which writes to
localStorage behind the shell's back and would leave the empty state on screen
after a click.

`src/lib/courseNeeds.ts` rolls the whole shortlist up — which courses it names,
which the student holds, which one the most programs want, and **which ticked
course nothing on the list asks for**. `choiceKey` canonicalises a choice rule so
the same 2-of-3 science requirement from two programs is one row rather than two
(`Requirement.codes` follows the order the university wrote them, and both
orderings are in the dataset). `listNeeds` is computed **once** in
`DashboardShell` and put on the context; it used to be walked five times per
render.

### University marks (#34, #39)

**38 of 39 schools have a mark; 29 of those draw at any size**, covering 92.7% of
every report the site holds — up from 8.6%. `scripts/fetch-logos.mjs` holds the
provenance: every mark names its source URL and what it depicts.

The eight biggest schools shipped a crest-plus-name **lockup**, illegible at
24px, so they drew monograms despite having artwork. The crest is cropped out of
each; originals live in `scripts/lockups/` because the script overwrites its own
output. Toronto, York and Guelph have no shield-only asset published anywhere —
cropping is the only honest fix for them, not a shortcut.

Trent is the deliberate gap: its crest is a white knockout, invisible on a light
tile, and it has no arms of its own.

### Copy (#35)

An audit that started from one wrong denominator found a **Rule 1 violation in
the site's headline** ("Find where you actually get in" — a probability claim in
the largest type on the site), a compare-table row that read as an acceptance
rate, four unconditional privacy promises that stopped being true when profiles
started syncing, and Home copy describing a budget question and a fit-ranking
that do not exist. Also two behavioural bugs: "Delete everything" never cleared
the tracker, and Balance could not tell "never answered" from "declined the
average".

### University marks, uncropped (`feature/uncropped-marks`)

The eight schools whose mark is a **lockup** — crest plus the school's name —
had that crest cropped out of them, so the site drew a mark none of those
universities publishes. The crop boxes are gone; each is now the whole supplied
file letterboxed into the square.

The artwork was **supplied by the maintainer as files**, not downloaded, so
those eight entries in `SOURCES` carry no URL and `scripts/lockups/README.md`
says so instead of back-filling a plausible one. Four of the eight arrived with
a transparent background, which is better than the white-composited 640×640
files they replace. All eight are composited onto white on the way out: every
one sets the school's name in dark type, which vanishes on the dark surface.

**The legibility trade is the thing to understand before changing it.** Measured
on `npm run logos:check`, against the crest marks as a control: `western` (ink
is 0.94:1, nearly square), `york`, `queens` and `ottawa` read by 28px.
`toronto` (2.8:1), `mcmaster`, `waterloo` and `guelph` are faint below about
36px, and eleven of the fourteen `UniversityMark` call sites are below 48.

All eight are in `CREST_MARKS` anyway. The mark is `aria-hidden` decoration and
the school's name is set in text beside it everywhere it appears, so the
alternative is the wall of two-letter monograms that set exists to remove.
**Deleting any of the four from `CREST_MARKS` gives it the 48px floor back and
changes nothing else** — monogram in tight rows, full lockup at 48px and up.

### The title said the one thing the site must not (`index.html`)

#35 pulled "Find where you actually get in" out of the `<h1>` as a Rule 1
violation. It was still in `index.html` four times — `<title>`, `og:title`,
`twitter:title` and the meta description — because that audit read components
and `index.html` is not one.

It is the worst place to have left it. The title is the browser tab, the search
result and every shared link, so the claim the site is built never to make was
the first thing it said to someone who had not arrived yet.

The four `states no probability` sweep checks read document *text*, which is why
they passed throughout. There is now a fifth that reads the head, and it was
confirmed to fail on the old title before being kept — a check that cannot fail
is not a check.

### The design system (#40–43)

This is new architecture a new session needs to know exists.

**Elevation.** `--shadow-sm/DEFAULT/md/lg` in `src/index.css`, built on
`--p-shadow` (a colour that flips with the theme) and `--p-shadow-boost`. Before
this, all nine shadows were hand-written `rgba(20,24,31,…)` — the *light* ink —
so elevation silently did not exist in dark mode. **Do not add an arbitrary
`shadow-[...]` value; use the ladder.**

**Interaction.** `.card-lift` is the one hover for anything card-shaped
(transform + box-shadow, 200ms). Five idioms and three shadow values collapsed
into it. Buttons and the most-pressed controls have an `active:` scale — there
was no pressed state anywhere on the site before.

**Rhythm.** `ui/Section.tsx` finally does something: `pad` names the three
spacing cases (`section` py-20, `band` py-16, `none`) and `tone` the three
background steps, and a tinted tone always bleeds and draws its hairline. The
rule is also written beside `container-page` in `src/index.css`. `display-4`
fills the hole between `display-3` and `text-xl` that was leaving some `h3`s at
16px.

**Chart motion.** Charts animate transforms, not layout properties — the repo
measured that pattern at 565ms of style recalculation against 18ms. Hover has its
own transition (`DURATION.hover`) and never inherits the entrance or its stagger:
the last decision-mix segment went from 180ms-before-it-responds and 1.1s to
settle, to 11ms and 140ms. `chartDelay()` replaced five ad-hoc stagger steps.

`probe:motion` now walks a chart route. It previously measured every animated
surface **except** the one with the most animation on it.

---

## 3. Before any of this is useful to a student

None of these are code. They are the whole remaining critical path.

1. **Deploy UniServer's new routes.** Accounts are live — `/api/health` answers
   `{"ok":true,"database":"connected"}` — but the content and map halves are not
   on Render: `/api/universities` and `/api/map/config` both still **404**
   (re-probed 2026-08-28). The code is merged on that repo's `main`; what has
   not happened is a deploy. Until it ships the site degrades exactly as
   designed — no editable prose, SVG map — but **the admin panel cannot save**.
   Four of the five items below depend on this one.
2. **Pick a tile provider.** `TILE_URL_TEMPLATE` is unset, so the map is the SVG
   one. **Do not point it at `tile.openstreetmap.org`** — their tile policy does
   not allow a proxy in front of it. Use MapTiler, Stadia or Thunderforest.
3. **Promote yourself to admin**, by hand, in the database. There is no route
   that does it and that is deliberate:
   `db.accounts.updateOne({ usernameKey: 'you' }, { $set: { isAdmin: true } })`
4. **Set `ALLOWED_ORIGINS` on Render.** Still unset; CORS still falls back to `*`.
5. **Settle the UniServer licence.** Still none, so all-rights-reserved by
   default. The only item on this list that gets harder with time.
6. **Decide the logo licensing question.** 39 institutional marks used to
   identify each school's programs — ordinary nominative use, and no university
   has been asked. A recorded decision rather than an oversight. Pulling any one
   mark is a one-line deletion and the monogram returns on its own.

---

## 3b. Found by the site sweep, 2026-08-29 — not fixed

A three-audit sweep of the whole site turned these up. The rule violations and
bugs from it shipped; these did not, and each is recorded with what is already
known so nobody re-derives it.

**The program page's tab swap has a real blink.** Now that `probe:motion`
watches the right element, `program -> analytics` reports `minVisible 0` with
~53 dark frames — roughly 230ms where the panel is invisible, on the most
animation-heavy surface on the site. `Tabs` uses `AnimatePresence mode="wait"`
with `opacity: 0` at both ends, deliberately, because crossfading panels of
different heights makes the page jump. Fixing it means picking a different
trade, not just raising a number — which is why it was left alone here.

**Performance, the biggest single win available.** `src/App.tsx` statically
imports all 21 page modules and has no `lazy()`, so Home downloads the entire
dashboard (175kB of source) and the admin panel. The main bundle is 673kB raw /
192kB gz. Separately, all 22 `motion/react` imports use the full-feature entry:
framer-motion's own fixtures put that at 39.3kB gz against 6.4kB for `m` plus a
lazily-fetched `domAnimation`, and `motion/react-m` is already installed and
unused.

**There is no instrument for the cost of an animation.** The 565ms-vs-18ms
figure underpins the "transforms, never layout" rule and is quoted at five
sites, but `.shots/flash-probe.mjs` was never committed and there is no
CPU-accounting script anywhere. `probe:motion` finds blank frames; nothing
measures cost. Worth adding before any animation work.

**Component reuse, the next tier after the Keep button.** The program row has
six near-identical copies (`OverviewView` ×2, `ListView`, `ProgramsView`,
`ApplicationsView`, and `CompareTable`'s `ProgramLine`, which is the only one
already extracted). The empty-state panel has nine. The
section-header-with-a-right-hand-link has twelve. `Row` is byte-identical in
`DashboardShell.tsx` and `AccountView.tsx`.

**Type-scale drift.** `display-4` exists to stop exactly this and is used
twice; `OverviewView.tsx` alone has nine unsized `<h2>`, and there are five
different sizes in use for "the median, big".

**The dashboard column gets narrower as the window gets wider** — 719px at
767px, 464px at `md:`, 896px at 1279px, then 608px at `xl:` when the rail
appears. `CompareTable`'s `min-w-[640px]` therefore scrolls sideways on a
1280px desktop.

**Reduced motion, four gaps.** Leaflet's `flyTo` (JS-driven, so the CSS blanket
cannot reach it); the Roadmap marker unfurl (animates `pathLength`, which
`MotionConfig` does not drop, and it is in the variant reduced-motion users are
routed to); the Survey progress pips; and Home's hero, which fades from literal
`opacity: 0` over 850ms.

**The Home roadmap clips itself on a phone.** `Roadmap.tsx` pins a
`h-screen overflow-hidden` box; below 640px the three cards stack to roughly
780px inside it and are cut off top and bottom with no scroll.

**`NotLiveYet.tsx` is dead code** — nothing imports it. `Placeholder.tsx`, still
captioned "Coming together" / "doesn't exist yet", is the live 404.

---

## 4. What to build next

**`DASHBOARD-NEXT.md` holds the backlog in priority order, and as of 2026-08-29
it is finished** — P1 (#32), P2 and P3 (both on branches after #45), and P4
across #41 and the `ListSpread`/`StackedBar` memos. What is left is §3 above,
which is not code. Kept below because the reasoning still explains the shape of
the dashboard:

- ~~**P2 — the other blank tools.**~~ **DONE** on `feature/uncropped-marks`.
  Note the headline example this line used to give was already fixed when it was
  written: Compare's empty state has NOT fired for one staged program since #35
  (`6847732`), which split it into two branches, the first of which names the
  staged program. Courses was done too. What actually remained, and what
  shipped:
  - **Compare** stages from its own page — the two best-reported of your kept
    programs, or `SUMMARY.featured` when the list is empty. `ROWS` is hoisted
    out of the component so the empty state names the real rows.
  - **Balance** deep-links to the question it needs (`/survey?step=average`;
    the param is a step ID, never an index). It also grew a **third** empty
    state that used to be a blank page — `BalanceCheck` returns null when no
    kept program has a median, and 132 programs have none.
  - **Applications** offers "Add your N kept programs to the tracker", only
    while nothing is tracked. `withTracked` is a no-op for ids it already
    holds, so a second press cannot reset a stage.
  - **Deadlines** shows the shape of an entry and **no date**, not even a
    greyed-out example. That is the one thing this page must never do.

  One defect surfaced while building it and is worth knowing about generally:
  **`accepted !== null` is not the reporting threshold, `insufficientData`
  is.** build-data sets `accepted` whenever `sampleSize > 0`, so 1,935 of the
  2,436 programs carry a median the pipeline has already ruled too thin to
  publish and 1,419 rest on a single report. Anything gating on the median
  republishes one student's self-report as a distribution.
- ~~**P3 — three answers collected and barely read.**~~ **DONE.** All three are
  read now and the rail shows all eight answers, so its heading is "Your
  answers" rather than "Some of your answers".

  **The `gradYear` idea in DASHBOARD-NEXT could not be built as written**, and
  that is the part worth carrying forward. It wanted the Overview to name the
  cycle that describes the student and how many reports it holds. The survey
  offers 2026–2030; the newest cycle in the data is 2025-2026. Only one of the
  five maps onto a cycle that exists. What shipped says how recent the data is
  relative to them instead, which is true for all five — `src/lib/cycles.ts`,
  fed by a new `summary.cycles` from the pipeline, because `stats.json` is
  940kB and this is one sentence.

  `homeCity` rolls the kept list up against home on **My list** —
  `src/lib/nearHome.ts`, stating the schools it cannot place rather than
  shrinking the denominator, since `CITY_POINTS` is Ontario-only. `coop` is in
  the rail via a shared `COOP_LABELS` that the survey and the Programs filter
  now read too.

Two smaller things, both flagged rather than fixed because they are decisions
rather than defects:

- **Nothing in the content layout responds above `lg:`.** Measured at 2560px:
  `container-page` caps at 1728px and Explore's program grid is still three
  columns (`sm:grid-cols-2 lg:grid-cols-3`, no `xl:`). An earlier version of
  this line said `xl:` was used zero times, which was wrong — there are four
  uses, and all four are in the dashboard, not in the content grids:
  `DashboardShell.tsx:358` (`xl:block`, the rail), `ListView.tsx:85`,
  `OverviewView.tsx:160` and `ProgramsView.tsx:288`. Home also uses `2xl:`/`3xl:`
  on its parallax art. So the complaint stands and the count did not.
- ~~**`ProgramsView` and `ListView` still carry inline copies** of the Keep
  button markup~~ — **DONE 2026-08-29.** Both now use `KeepControl`. The class
  strings were already identical, so it was purely additive: both gained the
  `aria-label` and the `active:` pressed state the copies lacked. Each got a
  sweep check, because the failure this guards against is silent — a Keep that
  writes to localStorage instead of calling `setProfile` leaves the row reading
  "+ Keep" and passes every text-only assertion.

**Found while doing the above, pre-existing, and NOT fixed:** `/profile/list`
overflows horizontally at 375px — `scrollWidth` 564 against a 375 viewport. It
reproduces identically on `origin/main`, so P3 neither caused nor worsened it.
It is invisible to the sweep because the `no horizontal overflow` check runs
against `/profile/programs` only, which is clean at all three widths. The
overflowing nodes trace to the mobile tab bar, `NAV.-mx-6 > UL.flex` in
`DashboardShell.tsx`. Worth a small PR that fixes it *and* widens that check to
the other dashboard routes.

---

## 5. Still true from before

The four rules have not moved: no probability of admission, no PII, no fact from
a search summary, and the dataset stays in the spreadsheet →
`npm run data:build` → static JSON pipeline. The server's content collection
holds no numbers, so nothing an admin types can contradict a median.

`sync.ts` still whitelists profile fields in **both** directions, and a new
survey answer is still a four-place change — `SurveyAnswers`,
`applyRemoteProfile`, `RemoteProfile`, and UniServer's `answersSchema` +
`cleanAnswers`. Miss one and the answer is erased from the device on the next
sign-in elsewhere. Tests on both sides assert the full key set.

`src/lib/tracker.ts` stays outside the profile. The one place it is now cleared
is `deleteAccount`, because "Delete everything" has to mean everything.

Motion tokens live in `src/lib/motion.ts` and nowhere else. The CSS-not-JS scroll
reveals, the `ENTER_FROM = 0.55` floor, and the `vite-preview` launch config are
all unchanged and all still load-bearing.
