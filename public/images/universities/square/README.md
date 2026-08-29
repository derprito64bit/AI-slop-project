# Square university marks

The small square logo shown beside each program, and beside each school in the
Fields and Map views.

**These are separate from the wide wordmarks one folder up.** Those are the home
page logo band. A wordmark is unreadable at 40px, which is the whole reason this
folder exists.

## Filenames

`<id>.png`, using the id in the table below. No code change is needed — the site
picks the file up automatically, and any school without one draws a coloured
monogram tile instead.

**PNG, not SVG.** `UniversityMark` tries `.png` first and only then `.svg`
(`EXTENSIONS` in `src/components/UniversityMark.tsx`), so an SVG here costs a
guaranteed 404 on every page before the browser asks for the file that exists.
An earlier version of this README recommended SVG; it was wrong. If you do add
one, rename the school's `.png` away so the SVG is found first.

## Format

- **256x256**, which is what `scripts/fetch-logos.mjs` produces.
- **Whatever the school actually publishes.** A shield, crest, seal or icon
  where there is one; the full lockup where the lockup is the mark. This used
  to say "not a horizontal wordmark unless nothing else exists", and obeying it
  meant cropping crests out of eight lockups and shipping a mark no university
  publishes. A wide lockup is letterboxed into the square, never stretched or
  cut.
- Transparent background where the art is self-contained and coloured.
- **Composite onto white if the art is dark-on-transparent.** Dark lettering or
  black line-art disappears completely against the dark theme's surface — the
  two U of T campus wordmarks, OCAD and Polytechnique all shipped as invisible
  black tiles before this was caught. `fetch-logos.mjs` has a `background`
  option for exactly this.
- Never a campus photograph. Wikipedia's `pageimages` API returns one for
  several of these schools.

## Adding or refreshing one

```
npm run logos                    # dry run: fetch everything, write nothing
npm run logos -- --write mcgill  # just that school
npm run logos:check              # contact sheet at 24/32/48/64, light and dark
```

Every mark's provenance lives in `SOURCES` in `scripts/fetch-logos.mjs`, so a
wrong or rebranded logo is a diff somebody can see rather than a mystery PNG.
Most entries are a URL. The eight lockups are the exception: they were supplied
as files, live in `scripts/lockups/`, and that folder's README says so plainly
rather than inventing a URL for them.

## Which schools may draw art below 48px

`CREST_MARKS` in `src/components/UniversityMark.tsx` is the list. Everything
else keeps a 48px floor and draws a monogram in listings.

The dividing line is **not** crest versus wordmark — it is **shield versus full
achievement**. A shield is a flat two-colour shape and survives being 24 pixels
wide. A full achievement is a shield plus crest, helm, mantling, two supporters
and a motto scroll, so the shield is a third of the artwork and the rest is
detail that turns to mud.

Where a school publishes both, take the shield. Commons has a
`<University> Escutcheon` series covering about twenty Canadian universities and
it is the first place to look — Alberta, Windsor, Concordia, Victoria and
Lakehead all moved off the full achievement that way. Only **Brock, RMC and
St. FX** are still on one, and no escutcheon for those exists under any spelling.

**Where no shield is published anywhere, use the lockup whole.** Eight schools
ship a crest-plus-name lockup and nothing else — between them 84% of every
report held. For a while `fetch-logos.mjs` cropped the crest out of each with a
`crop` box. That was legible and it was the wrong trade: the result is a mark
none of those universities publishes, and at a glance it reads as damage. The
crop boxes are gone and the files in `scripts/lockups/` are now used whole.

**So four of the eight are faint below about 36px** — `toronto` (2.8:1),
`mcmaster`, `waterloo` and `guelph`. They are still in `CREST_MARKS` on
purpose: the mark is `aria-hidden` decoration, the school's name is set in text
beside it everywhere it appears, and the alternative is the wall of two-letter
tiles that set exists to remove. `western`, `york`, `queens` and `ottawa` are
legible by 28px and are not a judgement call. Deleting any of the four from
`CREST_MARKS` gives it the 48px floor back and changes nothing else.

Run `npm run logos:check` and answer one question per row: **at 24px, can you
still tell which school this is?** An illegible logo is worse than a monogram,
which is why the list is opt-in rather than "has a file".

## Coverage

38 of 39 schools have a mark, and **29 of those are legible small enough to draw
at any size** — together 92.7% of every report the site holds. Ordered by report
volume, with a running cumulative share.

| id | University | Reports | Cumulative | Draws art at |
|---|---|---:|---:|---|
| `waterloo` | University of Waterloo | 1,477 | 14.2% | any size |
| `mcmaster` | McMaster University | 1,261 | 26.4% | any size |
| `western` | Western University | 1,024 | 36.3% | any size |
| `toronto` | University of Toronto | 1,022 | 46.1% | any size |
| `queens` | Queen's University | 922 | 55.0% | any size |
| `tmu` | Toronto Metropolitan University | 750 | 62.2% | any size |
| `ottawa` | University of Ottawa | 657 | 68.6% | any size |
| `york` | York University | 577 | 74.1% | any size |
| `laurier` | Wilfrid Laurier University | 571 | 79.6% | any size |
| `guelph` | University of Guelph | 448 | 84.0% | any size |
| `carleton` | Carleton University | 391 | 87.7% | any size |
| `brock` | Brock University | 168 | 89.4% | 48px and up |
| `ontario-tech` | Ontario Tech University | 159 | 90.9% | 48px and up |
| `toronto-scarborough` | U of T Scarborough | 156 | 92.4% | 48px and up |
| `toronto-mississauga` | U of T Mississauga | 147 | 93.8% | 48px and up |
| `mcgill` | McGill University | 146 | 95.2% | any size |
| `ubc` | University of British Columbia | 107 | 96.2% | any size |
| `trent` | Trent University | 96 | 97.2% | **none** |
| `dalhousie` | Dalhousie University | 55 | 97.7% | any size |
| `alberta` | University of Alberta | 54 | 98.2% | any size |
| `windsor` | University of Windsor | 48 | 98.7% | any size |
| `laurentian` | Laurentian University | 27 | 98.9% | any size |
| `lakehead` | Lakehead University | 19 | 99.1% | any size |
| `calgary` | University of Calgary | 15 | 99.3% | any size |
| `nipissing` | Nipissing University | 13 | 99.4% | any size |
| `guelph-humber` | University of Guelph-Humber | 13 | 99.5% | 48px and up |
| `ubc-okanagan` | UBC Okanagan | 12 | 99.6% | any size |
| `victoria` | University of Victoria | 7 | 99.7% | any size |
| `concordia` | Concordia University | 7 | 99.8% | any size |
| `ocad` | OCAD University | 7 | 99.8% | 48px and up |
| `rmc` | Royal Military College | 3 | 99.9% | 48px and up |
| `unb` | University of New Brunswick | 3 | 99.9% | any size |
| `stfx` | St. Francis Xavier University | 2 | 99.9% | 48px and up |
| `acadia` | Acadia University | 2 | 99.9% | any size |
| `mount-allison` | Mount Allison University | 2 | 100.0% | any size |
| `polytechnique` | Polytechnique Montréal | 1 | 100.0% | 48px and up |
| `smu` | Saint Mary's University | 1 | 100.0% | any size |
| `kings-college` | University of King's College | 1 | 100.0% | any size |
| `regina` | University of Regina | 1 | 100.0% | any size |

**Trent is the deliberate gap.** Its official crest is a white knockout —
invisible on the light tile these are drawn on — and Trent is one of the few
Canadian universities with no granted arms of its own; only its colleges have
heraldry, which is the wrong level of institution for this. Its only other mark
is a 3.2:1 wordmark, worse at 24px than the monogram it would replace.

## Trademark and licensing

University marks are trademarks. These are used to identify each school's
programs, which is ordinary nominative use, and no university has been asked.
That is a recorded decision rather than an oversight — see `HANDOFF-NEXT.md` §3.

Provenance for every file is in `SOURCES`. The mix is roughly half Wikimedia
Commons under free licences, half English Wikipedia fair-use uploads and a few
straight from the institution's own brand page. The fair-use ones are fine for a
student project and are **not** redistributable, which is worth settling before
this matters.

Don't alter proportions or colours, and don't imply endorsement or partnership.
Pulling any single mark is a one-line deletion and the monogram returns on its
own.
