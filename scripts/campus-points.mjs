// Look up where each university's main campus actually is.
//
//   node scripts/campus-points.mjs            print what it finds, write nothing
//   node scripts/campus-points.mjs --write    rewrite src/data/campus-points.ts
//
// WHY THIS EXISTS. `campus-locations.ts` holds approximate CITY CENTRES and says
// so at the top: they answer "how far is that from home" and nothing finer. On a
// real basemap that stops being enough — a mark on the city hall of Hamilton
// while the page shows you McMaster's actual streets is visibly wrong, and the
// whole argument of this site is that what it shows is true.
//
// WHERE THE NUMBERS COME FROM. OpenStreetMap, via Nominatim. That is a
// deliberate choice against the rule this project holds about researched facts:
// no fact from a search summary, only fetched sources, every entry carrying
// where it came from and when. OSM is not a summary — it is surveyed geodata,
// the same data the basemap itself is drawn from, and each row below records
// the exact OSM object id so anybody can open it and check.
//
// It is still SECOND-HAND and community-maintained, so:
//   - every result is sanity-checked against the city we already know the school
//     is in, and anything more than CITY_RADIUS_KM away is refused rather than
//     written;
//   - anything refused falls back to the city centre and is marked `approximate`,
//     which the UI can then be honest about;
//   - the generated file is committed and reviewable, so a wrong point is a diff
//     somebody can see rather than a silent runtime lookup.
//
// RATE LIMIT. Nominatim's usage policy allows at most one request a second and
// requires a real User-Agent. This waits 1.1s between calls and identifies
// itself. It is a one-off build step over 39 rows, not a runtime dependency —
// nothing at page load ever talks to Nominatim.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WRITE = process.argv.includes('--write')

const USER_AGENT =
  'Acceptiversity-campus-points/1.0 (student project; https://github.com/derprito64bit/AI-slop-project)'

/** Anything further than this from the known city centre is not that campus. */
const CITY_RADIUS_KM = 45

const PROVINCE_NAMES = {
  ON: 'Ontario',
  QC: 'Quebec',
  BC: 'British Columbia',
  AB: 'Alberta',
  NS: 'Nova Scotia',
  NB: 'New Brunswick',
  SK: 'Saskatchewan',
}

/**
 * Search terms for the schools whose dataset name is a nickname.
 *
 * "U of T Scarborough" and "UBC Okanagan" are what students call them and what
 * the spreadsheets say; they are not what the campus is called on a map.
 */
const QUERY_ALIAS = {
  'toronto-scarborough': 'University of Toronto Scarborough',
  'toronto-mississauga': 'University of Toronto Mississauga',
  // Plain "UBC Okanagan Campus" finds the Clinical Academic Campus, a separate
  // site about 9km from where the students are.
  'ubc-okanagan': 'UBC Okanagan, Kelowna',
  tmu: 'Toronto Metropolitan University',
  rmc: 'Royal Military College of Canada',
  'guelph-humber': 'University of Guelph-Humber',
  ocad: 'OCAD University',
  stfx: 'St. Francis Xavier University',
  smu: "Saint Mary's University Halifax",
  'kings-college': "King's College, Halifax, Nova Scotia",
  unb: 'University of New Brunswick Fredericton',
  toronto: 'University of Toronto St. George Campus',
  western: 'Western University London Ontario',
  laurier: 'Wilfrid Laurier University Waterloo',
  // Unqualified, this lands on the Macdonald Campus in Sainte-Anne-de-Bellevue —
  // a real McGill campus, 30km from the one nearly every applicant means.
  mcgill: 'McGill University, Rue Sherbrooke Ouest, Montréal',
  victoria: 'University of Victoria, Saanich, British Columbia',
  concordia: 'Concordia University, Montreal',
  polytechnique: 'Polytechnique Montréal, Chemin de Polytechnique',
  'mount-allison': 'Mount Allison University, Sackville, New Brunswick',
}

/* ------------------------------------------------------------- the inputs --- */

const universities = JSON.parse(
  readFileSync(join(ROOT, 'src/data/generated/universities.json'), 'utf8'),
)

/**
 * CITY_POINTS out of campus-locations.ts, by reading the file.
 *
 * A regex over a TypeScript source rather than an import, because this is a
 * plain .mjs build script and that file is the single place those coordinates
 * are maintained. Duplicating them here to avoid the parse would be the actual
 * mistake.
 */
function readCityPoints() {
  const source = readFileSync(join(ROOT, 'src/data/campus-locations.ts'), 'utf8')
  const block = /CITY_POINTS: Record<string, Point> = \{([\s\S]*?)\n\}/.exec(source)
  if (!block) throw new Error('Could not find CITY_POINTS in campus-locations.ts')
  const points = {}
  for (const m of block[1].matchAll(
    /'?([A-Za-z. ]+)'?:\s*\{\s*lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)\s*\}/g,
  )) {
    points[m[1].trim()] = { lat: Number(m[2]), lon: Number(m[3]) }
  }
  return points
}

const CITY_POINTS = readCityPoints()

/* ---------------------------------------------------------------- helpers --- */

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Great-circle distance, same formula as distanceKm in campus-locations.ts. */
function distanceKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(la1) * Math.cos(la2)
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

/**
 * Do two province names refer to the same province?
 *
 * Nominatim answers in the province's own languages: "Québec" with the accent,
 * and "New Brunswick / Nouveau-Brunswick" for the officially bilingual one. A
 * string equality against our English list rejected five real campuses as being
 * in the wrong province, which is the kind of check that looks like it is
 * working right up until it throws away correct data.
 */
function sameProvince(actual, expected) {
  if (!actual) return false
  // \p{Diacritic} rather than a hand-written range of combining marks: the
  // range is invisible in an editor, and "strip the accents" is what is meant.
  const flatten = (s) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
  const wanted = flatten(expected)
  return actual.split('/').some((part) => flatten(part) === wanted)
}

async function geocode(query) {
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      q: query,
      format: 'json',
      limit: '3',
      countrycodes: 'ca',
      addressdetails: '1',
    })
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`Nominatim answered ${response.status}`)
  return response.json()
}

/* ------------------------------------------------------------------ main --- */

const rows = []
const problems = []

for (const uni of universities) {
  const query = QUERY_ALIAS[uni.id] ?? `${uni.name}, ${uni.city}, ${PROVINCE_NAMES[uni.province] ?? ''}`
  let results = []
  try {
    results = await geocode(query)
  } catch (error) {
    problems.push(`${uni.id}: lookup failed — ${error.message}`)
  }
  await wait(1100)

  const cityPoint = CITY_POINTS[uni.city] ?? null

  // Prefer a result that is actually a university, then one near the right city.
  const scored = results
    .map((r) => {
      const point = { lat: Number(r.lat), lon: Number(r.lon) }
      const away = cityPoint ? distanceKm(cityPoint, point) : null
      return { r, point, away }
    })
    .filter((c) => Number.isFinite(c.point.lat) && Number.isFinite(c.point.lon))
    .sort((a, b) => {
      const uniA = a.r.type === 'university' ? 0 : 1
      const uniB = b.r.type === 'university' ? 0 : 1
      if (uniA !== uniB) return uniA - uniB
      return (a.away ?? 0) - (b.away ?? 0)
    })

  const best = scored[0]
  const provinceOk =
    !best || !PROVINCE_NAMES[uni.province]
      ? true
      : sameProvince(best.r.address?.state, PROVINCE_NAMES[uni.province])
  const nearOk = !best || best.away === null ? true : best.away <= CITY_RADIUS_KM

  if (!best) {
    problems.push(`${uni.id}: no result for "${query}"`)
  } else if (!provinceOk) {
    problems.push(`${uni.id}: landed in ${best.r.address?.state}, expected ${PROVINCE_NAMES[uni.province]}`)
  } else if (!nearOk) {
    problems.push(`${uni.id}: ${best.away}km from ${uni.city}, refused (limit ${CITY_RADIUS_KM}km)`)
  }

  const usable = best && provinceOk && nearOk

  rows.push({
    id: uni.id,
    name: uni.name,
    city: uni.city,
    lat: usable ? Number(best.point.lat.toFixed(5)) : cityPoint?.lat ?? null,
    lon: usable ? Number(best.point.lon.toFixed(5)) : cityPoint?.lon ?? null,
    approximate: !usable,
    osm: usable ? `${best.r.osm_type}/${best.r.osm_id}` : null,
    away: best?.away ?? null,
    matched: best?.r.display_name?.slice(0, 60) ?? '—',
  })

  const flag = usable ? '  ' : '~~'
  console.log(
    `${flag} ${uni.id.padEnd(22)} ${String(rows.at(-1).lat).padStart(9)}, ${String(rows.at(-1).lon).padStart(10)}  ${
      best?.away !== null && best?.away !== undefined ? `${best.away}km` : ''
    }  ${rows.at(-1).matched}`,
  )
}

console.log(`\n${rows.filter((r) => !r.approximate).length}/${rows.length} placed from OpenStreetMap`)
if (problems.length) {
  console.log('\nFell back to the city centre:')
  for (const p of problems) console.log(`  ${p}`)
}

if (!WRITE) {
  console.log('\n(dry run — pass --write to update src/data/campus-points.ts)')
  process.exit(0)
}

/* ----------------------------------------------------------------- write --- */

const today = new Date().toISOString().slice(0, 10)

const file = `// WHERE EACH CAMPUS ACTUALLY IS. Generated — see scripts/campus-points.mjs.
//
// Regenerate with:  node scripts/campus-points.mjs --write
//
// Distinct from CITY_POINTS in campus-locations.ts, which is a city centre and
// says so. These are the campuses themselves, so that a mark on a street-level
// basemap sits on the university rather than near it.
//
// Every row carries the OpenStreetMap object it came from. Open any of them at
// https://www.openstreetmap.org/<osm> to check it. Rows marked \`approximate\`
// could not be confirmed within ${CITY_RADIUS_KM}km of the city we already knew the school
// was in, so they fall back to that city centre — the UI says "city centre"
// rather than pretending to a precision it does not have.
//
// Read ${today}.

export type CampusPoint = {
  lat: number
  lon: number
  /** true when this is a city centre rather than a located campus */
  approximate: boolean
  /** the OpenStreetMap object this came from, or null when it fell back */
  osm: string | null
}

export const CAMPUS_POINTS: Record<string, CampusPoint> = {
${rows
  .filter((r) => r.lat !== null)
  .map(
    (r) =>
      `  // ${r.name}, ${r.city}\n  '${r.id}': { lat: ${r.lat}, lon: ${r.lon}, approximate: ${r.approximate}, osm: ${
        r.osm ? `'${r.osm}'` : 'null'
      } },`,
  )
  .join('\n')}
}

/** The date the lookups above were made, shown wherever the points are. */
export const CAMPUS_POINTS_READ = '${today}'
`

writeFileSync(join(ROOT, 'src/data/campus-points.ts'), file)
console.log(`\nWrote src/data/campus-points.ts (${rows.filter((r) => r.lat !== null).length} rows)`)
