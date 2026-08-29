# Supplied lockups

The full artwork for the eight schools whose mark is a **lockup** — the crest
set beside or above the school's name. These are build **inputs**, not assets:
`fetch-logos.mjs` reads them and writes
`public/images/universities/square/<id>.png`.

Do not delete them, and do not point anything on the site at them.

## Why they are here and not fetched

Every other entry in `SOURCES` carries a URL. These eight do not. They were
supplied as files by the maintainer on 2026-08-28 (from `~/Downloads/logos`) and
copied in under their school id — `uoft.png` became `toronto.png`, `uottawa.png`
became `ottawa.png`. Where each was originally downloaded from was not recorded,
so the file itself is the provenance. That is worth being straight about rather
than back-filling a plausible URL.

## They are no longer cropped

The script used to cut the crest out of each of these with a `crop` box, because
a lockup is illegible at 24px. That shipped a mark no university publishes, so
the boxes are gone and each output is now the whole file letterboxed into the
square. Nothing is cut off.

The legibility cost that cropping was paying for is real, and it now lives where
it belongs: `CREST_MARKS` in `src/components/UniversityMark.tsx` decides which
schools draw below 48px. Read the note there before changing it, and look at
`npm run logos:check` first.

## Input, not output

Keeping the input in this folder rather than reading
`public/images/universities/square/<id>.png` is what makes the step repeatable.
Back when these were cropped, an input read from the output folder got cropped
again on every run and zoomed further in each time.

## What is in each file

| id | supplied as | size | background |
|---|---|---|---|
| `guelph` | `guelph.png` | 889×889 | light grey `#d9d9d9` card |
| `mcmaster` | `mcmaster.png` | 554×554 | white |
| `ottawa` | `uottawa.png` | 250×212 | transparent |
| `queens` | `queens.png` | 768×584 | transparent |
| `toronto` | `uoft.png` | 750×750 | transparent |
| `waterloo` | `waterloo.png` | 500×325 | transparent |
| `western` | `western.png` | 447×447 | white |
| `york` | `york.png` | 600×600 | white |

All eight are composited onto **white** on the way out, because every one sets
the school's name in dark type and dark type on transparency disappears on the
dark surface.

`ottawa` at 250×212 is the smallest input here against a 256 canvas, so it draws
about 1:1 and gains nothing from the inset — that is the first one to replace if
a larger file turns up. `guelph` arrived on a grey card rather than on white, so
it draws a faint frame inside its tile that the other seven do not; trimming
that is a crop, which is the one thing this folder no longer does.
