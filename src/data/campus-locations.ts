// Where the campuses are, roughly.
//
// APPROXIMATE CITY CENTRES, not survey data and not campus addresses. They are
// here to answer "how far is this from home, and what else is near it" — a
// question the site could not answer at all — and they are accurate to about
// the scale of a city, which is the scale the map is drawn at.
//
// This is deliberately NOT in the generated dataset. `scripts/build-data.mjs`
// emits what the spreadsheets say; coordinates are hand-entered here, and the
// distinction matters: everything under src/data/generated is derived and
// disposable, and this is neither.
//
// Plotted BY CITY rather than by university, because five of the twenty-three
// Ontario schools are in Toronto and another two share Waterloo. Twenty-three
// marks would be a pile-up in the south and a lie about how many places there
// are to go; sixteen cities, each sized by what it holds, is the honest shape.

export type Point = { lat: number; lon: number }

/**
 * Every Ontario city in the dataset. Keyed by the `city` field on the
 * university records, so a new school in a listed city needs no change here —
 * only a genuinely new city does, and `CampusMap` reports any it cannot place
 * rather than dropping it.
 */
export const CITY_POINTS: Record<string, Point> = {
  Guelph: { lat: 43.55, lon: -80.25 },
  Hamilton: { lat: 43.26, lon: -79.87 },
  Kingston: { lat: 44.23, lon: -76.49 },
  London: { lat: 42.98, lon: -81.25 },
  Mississauga: { lat: 43.59, lon: -79.64 },
  'North Bay': { lat: 46.31, lon: -79.46 },
  Oshawa: { lat: 43.9, lon: -78.86 },
  Ottawa: { lat: 45.42, lon: -75.7 },
  Peterborough: { lat: 44.3, lon: -78.32 },
  Scarborough: { lat: 43.77, lon: -79.23 },
  'St. Catharines': { lat: 43.16, lon: -79.25 },
  Sudbury: { lat: 46.49, lon: -80.99 },
  'Thunder Bay': { lat: 48.38, lon: -89.25 },
  Toronto: { lat: 43.65, lon: -79.38 },
  Waterloo: { lat: 43.47, lon: -80.52 },
  Windsor: { lat: 42.32, lon: -83.04 },
}

/**
 * Cities the dataset names separately that are one place on a map.
 *
 * Scarborough is a district of Toronto, not a neighbouring city — the dataset
 * records where the campus sits (UTSC is in Scarborough) and that is right for
 * an address and wrong for a map: two marks 18km apart overlap at this scale,
 * so the smaller one covers the larger and "Toronto" becomes the hard thing to
 * point at.
 *
 * Mississauga deliberately stays its own mark. It is a separate municipality
 * and a student choosing UTM over UTSG is choosing a different commute.
 */
export const CITY_ALIASES: Record<string, string> = {
  Scarborough: 'Toronto',
}

/** The map name for a dataset city. */
export function mapCity(city: string): string {
  return CITY_ALIASES[city] ?? city
}

/**
 * Straight-line distance in kilometres. Haversine, because over the 1,200km
 * from Windsor to Thunder Bay a flat approximation is out by enough to be
 * visibly wrong, and the number is shown to students.
 *
 * It is "as the crow flies" and the UI says so — nobody drives it in a straight
 * line, and quoting a driving time we have not measured would be inventing a
 * fact.
 */
export function distanceKm(a: Point, b: Point): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

/**
 * Project a point into a box, equirectangular with a cosine correction.
 *
 * Without the correction Ontario comes out visibly stretched sideways: at 45°N
 * a degree of longitude is about 70% of a degree of latitude, so a raw lat/lon
 * plot puts Windsor and Ottawa much further apart than they look on any map a
 * student has seen.
 */
export function project(
  p: Point,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  box: { width: number; height: number; pad: number },
): { x: number; y: number } {
  const midLat = (bounds.minLat + bounds.maxLat) / 2
  const squeeze = Math.cos((midLat * Math.PI) / 180)
  const lonSpan = (bounds.maxLon - bounds.minLon) * squeeze
  const latSpan = bounds.maxLat - bounds.minLat
  const w = box.width - box.pad * 2
  const h = box.height - box.pad * 2
  // One scale for both axes, so the drawing keeps its proportions instead of
  // stretching to fill whatever box it is given.
  const scale = Math.min(w / lonSpan, h / latSpan)
  const cx = box.pad + (w - lonSpan * scale) / 2
  const cy = box.pad + (h - latSpan * scale) / 2
  return {
    x: cx + (p.lon - bounds.minLon) * squeeze * scale,
    // y grows downward in SVG; latitude grows northward.
    y: cy + (bounds.maxLat - p.lat) * scale,
  }
}
