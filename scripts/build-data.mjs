// Build-time ETL: community spreadsheets -> normalized JSON for the site.
//
//   npm run data:build
//
// Reads every sheet in data/raw/, normalizes the wildly inconsistent columns
// into one canonical shape, aggregates per (university, program), and writes
// src/data/generated/*.json plus data/qa-report.md.
//
// The QA report is the point of contact with the manual moderation workflow:
// anything this script could not confidently interpret is listed there instead
// of being silently dropped.

import AdmZip from 'adm-zip'
import { XMLParser } from 'fast-xml-parser'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  normalizeAverage,
  normalizeDecision,
  normalizeProgram,
  canonicalUniversityId,
  excelSerialToISO,
  programSlug,
  percentile,
  inferField,
} from './normalize.mjs'
import { BY_ID } from './universities-map.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RAW = join(ROOT, 'data', 'raw')
const OUT = join(ROOT, 'src', 'data', 'generated')

/** Programs below this many offer-with-average records get flagged, not dropped. */
const MIN_SAMPLE = 5

// ---------------------------------------------------------------- xlsx reader

// removeNSPrefix matters: some exports namespace every element (<x:worksheet>,
// <x:row>) while others don't. Without this, half the sheets parse as empty.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
})
const arr = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v])

/** Pull text out of a sharedStrings <si>, including rich-text runs. */
function siText(node) {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (node.t !== undefined) {
    return typeof node.t === 'object' ? String(node.t['#text'] ?? '') : String(node.t)
  }
  if (node.r) return arr(node.r).map(siText).join('')
  if (node['#text'] !== undefined) return String(node['#text'])
  return ''
}

/** Read the first worksheet as an array of { A: 'val', B: 'val', ... } rows. */
function readSheet(path) {
  const zip = new AdmZip(path)

  let shared = []
  const sst = zip.getEntry('xl/sharedStrings.xml')
  if (sst) {
    const doc = parser.parse(sst.getData().toString('utf8'))
    shared = arr(doc?.sst?.si).map(siText)
  }

  const sheetEntry = zip
    .getEntries()
    .filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.entryName))
    .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }))[0]
  if (!sheetEntry) throw new Error(`no worksheet in ${path}`)

  const doc = parser.parse(sheetEntry.getData().toString('utf8'))
  return arr(doc?.worksheet?.sheetData?.row).map((row) => {
    const out = {}
    for (const c of arr(row.c)) {
      const ref = c['@_r'] ?? ''
      const col = String(ref).replace(/\d+/g, '')
      const type = c['@_t']
      let val
      if (type === 's') {
        val = shared[Number(c.v)] ?? ''
      } else if (type === 'inlineStr') {
        val = siText(c.is)
      } else {
        val = c.v === undefined || c.v === null ? '' : String(c.v)
      }
      if (col) out[col] = val
    }
    return out
  })
}

// -------------------------------------------------------------- source config
// One adapter per sheet. Adding a new export = adding an entry here.
// `pii` columns are listed purely for documentation — they are never read.

const SOURCES = [
  {
    file: 'applications-2024-2025.xlsx',
    cycle: '2024-2025',
    cols: { university: 'C', code: 'D', program: 'E', decision: 'F', average: 'G', decidedOn: 'J' },
  },
  {
    file: 'applications-2025-2026.xlsx',
    cycle: '2025-2026',
    cols: { university: 'C', code: 'D', program: 'E', decision: 'F', average: 'G', decidedOn: 'I' },
  },
  {
    file: 'acceptances-2023-2024.xlsx',
    cycle: '2023-2024',
    // Prefer the acceptance average (J); fall back to grade-12 final (I), then midterm (G).
    cols: { university: 'D', code: 'B', program: 'C', decision: 'E', average: 'J', decidedOn: 'N' },
    averageFallbacks: ['I', 'G'],
  },
  {
    file: 'acceptances-responses.xlsx',
    cycle: '2022-2023',
    cols: { university: 'C', code: null, program: 'B', decision: 'H', average: 'D', decidedOn: null },
    pii: ['I'], // "Exact discord or reddit username" — deliberately never read
  },
]

// ------------------------------------------------------------------- pipeline

const qa = {
  unmappedUniversities: new Map(), // raw -> count
  badAverages: [],
  droppedNoProgram: 0,
  droppedNoDecision: 0,
  droppedNoUniversity: 0,
  droppedJunkRow: 0,
  droppedEmptyRow: 0,
  perFile: [],
}

const records = []

/** The spreadsheets carry a "***Editing is not permitted***" banner row. */
const isJunkRow = (v) => /^z?\*\*\*/.test(String(v ?? '').trim())

for (const src of SOURCES) {
  const rows = readSheet(join(RAW, src.file))
  const body = rows.slice(1) // drop header
  let kept = 0

  for (const row of body) {
    const rawUni = (row[src.cols.university] ?? '').trim()
    if (isJunkRow(rawUni)) {
      qa.droppedJunkRow++
      continue
    }
    if (!rawUni) {
      // Trailing/blank spreadsheet rows — expected, not a data problem.
      qa.droppedEmptyRow++
      continue
    }

    // --- university
    const universityId = canonicalUniversityId(rawUni)
    if (!universityId) {
      if (rawUni) qa.unmappedUniversities.set(rawUni, (qa.unmappedUniversities.get(rawUni) ?? 0) + 1)
      qa.droppedNoUniversity++
      continue
    }
    const uni = BY_ID[universityId]

    // --- program. Some rows put the program in the OUAC-code column instead.
    let rawProgram = (row[src.cols.program] ?? '').trim()
    if (!rawProgram && src.cols.code) {
      const alt = (row[src.cols.code] ?? '').trim()
      // Real OUAC codes are short tokens like "BAI"/"BG"; anything longer and
      // wordier is a mislabelled program name.
      if (alt.length > 5 && /\s|[a-z]/.test(alt)) rawProgram = alt
    }
    const program = normalizeProgram(rawProgram, uni.name)
    if (!program) {
      qa.droppedNoProgram++
      continue
    }

    // --- decision
    const decision = normalizeDecision(row[src.cols.decision])
    if (!decision) {
      qa.droppedNoDecision++
      continue
    }

    // --- average (optional: a record without one still counts toward decisions)
    let average = null
    const candidates = [src.cols.average, ...(src.averageFallbacks ?? [])]
    for (const col of candidates) {
      const raw = row[col]
      if (raw === undefined || raw === '') continue
      const res = normalizeAverage(raw)
      if (res.value !== null) {
        average = res.value
        break
      }
      if (res.reason && res.reason !== 'missing') {
        qa.badAverages.push({ file: src.file, raw: String(raw), reason: res.reason })
      }
    }

    records.push({
      universityId,
      program,
      slug: programSlug(program),
      field: inferField(program),
      decision,
      average,
      cycle: src.cycle,
      decidedOn: src.cols.decidedOn ? excelSerialToISO(row[src.cols.decidedOn]) : null,
    })
    kept++
  }
  qa.perFile.push({ file: src.file, rows: body.length, kept })
}

// ------------------------------------------------------------------ aggregate

const groups = new Map()
for (const r of records) {
  const key = `${r.universityId}::${r.slug}`
  let g = groups.get(key)
  if (!g) {
    g = {
      key,
      universityId: r.universityId,
      slug: r.slug,
      names: new Map(),
      field: r.field,
      counts: { offer: 0, rejected: 0, waitlisted: 0, deferred: 0 },
      offerAverages: [],
      cycles: new Set(),
    }
    groups.set(key, g)
  }
  g.names.set(r.program, (g.names.get(r.program) ?? 0) + 1)
  g.counts[r.decision]++
  g.cycles.add(r.cycle)
  if (r.decision === 'offer' && r.average !== null) g.offerAverages.push(r.average)
}

const programs = [...groups.values()]
  .map((g) => {
    // Display name = the most frequently submitted spelling.
    const name = [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const avgs = g.offerAverages
    const sampleSize = avgs.length
    const total = g.counts.offer + g.counts.rejected + g.counts.waitlisted + g.counts.deferred
    return {
      id: g.key,
      universityId: g.universityId,
      name,
      slug: g.slug,
      field: g.field,
      totalReports: total,
      counts: g.counts,
      sampleSize,
      insufficientData: sampleSize < MIN_SAMPLE,
      cycles: [...g.cycles].sort(),
      accepted:
        sampleSize > 0
          ? {
              min: Math.min(...avgs),
              p25: percentile(avgs, 0.25),
              median: percentile(avgs, 0.5),
              p75: percentile(avgs, 0.75),
              max: Math.max(...avgs),
            }
          : null,
    }
  })
  .sort((a, b) => b.totalReports - a.totalReports)

const usedUniIds = new Set(programs.map((p) => p.universityId))
const universities = [...usedUniIds]
  .map((id) => {
    const u = BY_ID[id]
    return {
      id: u.id,
      name: u.name,
      city: u.city,
      province: u.province,
      programCount: programs.filter((p) => p.universityId === id).length,
      reportCount: programs
        .filter((p) => p.universityId === id)
        .reduce((n, p) => n + p.totalReports, 0),
    }
  })
  .sort((a, b) => b.reportCount - a.reportCount)

// Anonymous individual records, for the community feed / program detail.
// No usernames, no timestamps of submission — only the outcome itself.
const stats = records.map((r) => ({
  p: `${r.universityId}::${r.slug}`,
  u: r.universityId,
  d: r.decision,
  a: r.average,
  c: r.cycle,
}))

// --------------------------------------------------------------------- output

mkdirSync(OUT, { recursive: true })
const write = (name, data) => {
  const path = join(OUT, name)
  writeFileSync(path, JSON.stringify(data), 'utf8')
  return { name, kb: Math.round(JSON.stringify(data).length / 1024) }
}

const written = [
  write('universities.json', universities),
  write('programs.json', programs),
  write('stats.json', stats),
]

// ------------------------------------------------------------------ QA report

const withData = programs.filter((p) => !p.insufficientData)
const unmapped = [...qa.unmappedUniversities.entries()].sort((a, b) => b[1] - a[1])
const nearMiss = programs
  .filter((p) => p.insufficientData && p.sampleSize >= 3)
  .sort((a, b) => b.sampleSize - a.sampleSize)
  .slice(0, 25)

// Possible duplicate programs: one slug is a prefix of another within the same
// university (e.g. "medical-science" vs "medical-science-bmsc-and-bsc").
// Deliberately NOT merged automatically — "Engineering I" and "Engineering I
// (Co-op)" look identical to a prefix test but are different programs. This is
// a list for a human to judge.
const byUni = new Map()
for (const p of programs) {
  if (!byUni.has(p.universityId)) byUni.set(p.universityId, [])
  byUni.get(p.universityId).push(p)
}
const dupes = []
for (const [uid, list] of byUni) {
  const sorted = [...list].sort((a, b) => a.slug.length - b.slug.length)
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].slug.startsWith(sorted[i].slug + '-')) {
        dupes.push({ uid, a: sorted[i], b: sorted[j] })
      }
    }
  }
}
dupes.sort((x, y) => y.a.totalReports + y.b.totalReports - (x.a.totalReports + x.b.totalReports))

const report = `# Data QA report

Generated by \`npm run data:build\`. Everything here needs a human decision —
fix it in the source spreadsheet, then re-run the build.

## Intake

| File | Rows | Kept |
|---|---:|---:|
${qa.perFile.map((f) => `| ${f.file} | ${f.rows} | ${f.kept} |`).join('\n')}

- **Records kept:** ${records.length}
- **Programs:** ${programs.length} (${withData.length} with a usable sample of ≥${MIN_SAMPLE})
- **Universities:** ${universities.length}

## Dropped rows

| Reason | Count |
|---|---:|
| Unrecognised university | ${qa.droppedNoUniversity} |
| No usable program name | ${qa.droppedNoProgram} |
| No usable decision | ${qa.droppedNoDecision} |
| Blank row (no university) | ${qa.droppedEmptyRow} |
| Spreadsheet banner/junk row | ${qa.droppedJunkRow} |

## Unrecognised university spellings (${unmapped.length})

Add a real school to \`scripts/universities-map.mjs\`; ignore genuine junk.

${unmapped.length ? unmapped.map(([n, c]) => `- \`${n}\` — ${c} row(s)`).join('\n') : '_None._'}

## Rejected averages (${qa.badAverages.length})

Outside ${'`40–100`'} after fraction conversion, or non-numeric.

${
  qa.badAverages.length
    ? [...new Map(qa.badAverages.map((b) => [`${b.file}|${b.raw}`, b])).values()]
        .slice(0, 40)
        .map((b) => `- \`${b.raw}\` — ${b.reason} (${b.file})`)
        .join('\n')
    : '_None._'
}

## Possible duplicate programs (${dupes.length})

One name extends another at the same school. Some are genuinely different
(co-op vs regular); others are the same program written two ways. **Not merged
automatically** — decide per row and standardise the wording in the sheet.

${
  dupes.length
    ? dupes
        .slice(0, 30)
        .map(
          (d) =>
            `- **${d.uid}** — \`${d.a.name}\` (${d.a.totalReports}) vs \`${d.b.name}\` (${d.b.totalReports})`,
        )
        .join('\n')
    : '_None._'
}

## Programs just below the reporting threshold

These show as "not enough data yet" on the site. A few more submissions each
would bring them over the line.

${
  nearMiss.length
    ? nearMiss.map((p) => `- ${p.universityId} — ${p.name} (${p.sampleSize})`).join('\n')
    : '_None._'
}
`

writeFileSync(join(ROOT, 'data', 'qa-report.md'), report, 'utf8')

// --------------------------------------------------------------------- stdout

console.log(`\nRecords kept       ${records.length}`)
console.log(`Programs           ${programs.length}  (${withData.length} with sample >= ${MIN_SAMPLE})`)
console.log(`Universities       ${universities.length}`)
console.log(`Unmapped unis      ${unmapped.length}`)
console.log(`Rejected averages  ${qa.badAverages.length}`)
console.log(`\nWrote: ${written.map((w) => `${w.name} (${w.kb}kB)`).join(', ')}`)
console.log(`Wrote: data/qa-report.md\n`)
