# University wordmarks

Save the logo files here using these **exact filenames**. The site picks them up
automatically — no code changes needed. Until a file exists, that slot falls back
to the university's name as plain text (no broken images).

| Filename | University |
|---|---|
| `waterloo.png` | University of Waterloo |
| `toronto.png` | University of Toronto |
| `mcmaster.png` | McMaster University |
| `queens.png` | Queen's University |
| `western.png` | Western University |
| `ottawa.png` | University of Ottawa |
| `guelph.png` | University of Guelph |
| `york.png` | York University |

## Format

- **PNG with a transparent background** (or SVG — if you use SVG, change the
  extension in `src/data/universities.ts` to match).
- **Height ~120px minimum** (rendered at 40px, so this covers 2×/3× screens).
  Width can be whatever the logo's natural proportions are — they're sized by
  height and keep their own aspect ratio.
- **Trim tight** to the artwork. Baked-in whitespace makes a logo look smaller
  than its neighbours, since spacing is added in code.
- Avoid logos with a solid white box behind them — they'll show as a white
  rectangle in dark mode.

## Dark mode

Dark-coloured wordmarks are automatically rendered white in dark mode
(`.logo-mark` filter in `src/index.css`), so they stay readable. This means
brand colours only show in light mode — that's intentional and standard for
logo bands.

## Licensing note

University wordmarks are trademarks. Using them to identify the schools you
list is normally fine (nominative use), but:

- Prefer files from each school's **official brand/media kit**.
- Don't alter the artwork's proportions or colours (the code doesn't).
- Don't imply endorsement or partnership anywhere in the copy.
