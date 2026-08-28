# Handoff — pick up here

Read `HANDOFF.md` first for the project as a whole (rules, data pipeline,
architecture). This file is only about **where things stand now**.

Rewritten 2026-08-28 at the end of a long session. **Everything below is merged
and deployed**, and every claim in it was probed rather than assumed.

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
npm test                282 pass          (was 246 at the start of the session)
npm run sweep           135 of 135        (was 125 of 125)
npm run sweep:sections  26 of 26
npm run probe:motion    minVisible 0.55, 0 dark frames
                        — the charts row reports 1; the panel swap never dips
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

## 4. What to build next

**`DASHBOARD-NEXT.md` holds the backlog in priority order.** P1 shipped in #32
and P4 in #41; **P2 and P3 are what remain**:

- **P2 — the other blank tools.** Compare is the starkest: its empty state fires
  for *one* staged program as well as none, so a student who staged one gets no
  acknowledgement they did anything. Balance, Courses, Applications and Deadlines
  all still answer "you have nothing" rather than "here is what this will look
  like once you have used it".
- **P3 — three answers collected and barely read.** `gradYear` is read by
  nothing at all outside the survey and sync plumbing; `homeCity` only by the
  map; `coop` only filters Programs. The rail shows four of the eight answers,
  which is why its heading now says "Some of your answers".

Two smaller things, both flagged rather than fixed because they are decisions
rather than defects:

- **`xl:` is used zero times.** Nothing about content layout responds above
  `lg:`, so on a 2560px monitor Explore is still three columns in a 1728px
  container.
- **`ProgramsView` and `ListView` still carry inline copies** of the Keep button
  markup rather than using `KeepControl`. A clean follow-up with its own sweep
  run.

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
