# Data pipeline

The site has **no backend**. Community submissions live in spreadsheets that the
team moderates by hand, and a build step turns those sheets into the JSON the
site reads. The spreadsheet *is* the database and the admin panel.

```
Google Form  →  Google Sheet  →  [you review the rows]  →  export .xlsx
                                                              ↓
                                                    npm run data:build
                                                              ↓
                                        src/data/generated/*.json  +  qa-report.md
```

## Refreshing the data

1. Export each sheet from Google Sheets: **File → Download → Microsoft Excel (.xlsx)**.
2. Drop it into `data/raw/`, keeping the existing filename so the adapter matches.
3. Run:

   ```bash
   npm run data:build
   ```

4. **Read `data/qa-report.md`.** It opens with **"New since last build"** — usually the only
   part you need. Everything already reviewed in an earlier run stays further down.
5. Record your decisions in **`data/overrides.json`** (see below), not in the source sheet,
   so they survive the next export.
6. Re-run until the new-work section is empty, then commit `data/raw/`,
   `src/data/generated/`, `data/overrides.json` and `data/.build-snapshot.json`.

Use `npm run data:check` to run the whole pipeline and refresh the report **without**
writing the dataset — handy while iterating on overrides.

## `data/overrides.json` — where your decisions live

This is the point of the tooling: a spelling you resolve once never comes back.

| Key | Purpose |
|---|---|
| `universityAliases` | `"ottawa university": "ottawa"` — map a spelling to a canonical id |
| `ignoreUniversities` | Known junk (`"."`, `"none"`). Silenced so real problems stand out |
| `programMerges` | `"<from program id>": "<into id>"` for duplicates that are the same program |
| `programIgnore` | Program ids to drop entirely |

The QA report suggests likely matches for each unknown spelling and prints a **paste-ready
JSON block** for the confident ones. Those suggestions are fuzzy — **check each line before
accepting it.** They are never applied automatically, deliberately: mislabelling a student's
record as the wrong school is worse than leaving it unmapped. The matcher is tuned to stay
quiet rather than guess (it will not, for instance, map "New York University" onto York).

The generated JSON is committed on purpose: the site builds without needing the
spreadsheets or this script to run in CI.

## Adding a new sheet

Add an entry to `SOURCES` in `scripts/build-data.mjs` mapping that sheet's column
letters to the canonical fields. Each sheet has its own column order, so a new
export means a new adapter — not a rewrite.

## Adding a university

New spellings appear in the QA report under *Unrecognised university spellings*.
Add real schools to `scripts/universities-map.mjs` as an alias on the right
canonical entry. Junk entries can be ignored — they stay out of the dataset.

## What the pipeline guarantees

- **No personal data.** The submission sheets include a Discord/Reddit username
  column; it is never read. Output records carry only outcome fields.
- **Averages are sane.** Values arrive as percentages in some sheets and fractions
  (`0.86`) in others. Everything is converted to a 0–100 percentage, and anything
  outside 40–100 is rejected to the QA report rather than skewing a median.
- **Small samples are labelled, not hidden.** A program with fewer than 5 reported
  offers is flagged `insufficientData`, so the UI can say "not enough data yet"
  instead of presenting a median derived from one submission.

## What this data can and cannot say

It reports **what averages admitted students had**. It cannot report **odds of
admission**.

Roughly 94–97% of rows in these sheets are offers, because people who get in are
far more likely to submit. That is a reporting bias, not an admission rate. Any
UI built on this must present accepted-average ranges and sample sizes — never a
probability of getting in.
