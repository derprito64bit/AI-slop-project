// WHERE EACH CAMPUS ACTUALLY IS. Generated — see scripts/campus-points.mjs.
//
// Regenerate with:  node scripts/campus-points.mjs --write
//
// Distinct from CITY_POINTS in campus-locations.ts, which is a city centre and
// says so. These are the campuses themselves, so that a mark on a street-level
// basemap sits on the university rather than near it.
//
// Every row carries the OpenStreetMap object it came from. Open any of them at
// https://www.openstreetmap.org/<osm> to check it. Rows marked `approximate`
// could not be confirmed within 45km of the city we already knew the school
// was in, so they fall back to that city centre — the UI says "city centre"
// rather than pretending to a precision it does not have.
//
// Read 2026-08-28.

export type CampusPoint = {
  lat: number
  lon: number
  /** true when this is a city centre rather than a located campus */
  approximate: boolean
  /** the OpenStreetMap object this came from, or null when it fell back */
  osm: string | null
}

export const CAMPUS_POINTS: Record<string, CampusPoint> = {
  // University of Waterloo, Waterloo
  'waterloo': { lat: 43.4702, lon: -80.54524, approximate: false, osm: 'relation/11680616' },
  // McMaster University, Hamilton
  'mcmaster': { lat: 43.26394, lon: -79.91783, approximate: false, osm: 'way/23122301' },
  // Western University, London
  'western': { lat: 43.00542, lon: -81.2748, approximate: false, osm: 'way/174869710' },
  // University of Toronto, Toronto
  'toronto': { lat: 43.66737, lon: -79.39958, approximate: false, osm: 'node/773000486' },
  // Queen's University, Kingston
  'queens': { lat: 44.22635, lon: -76.49576, approximate: false, osm: 'relation/20513072' },
  // Toronto Metropolitan University, Toronto
  'tmu': { lat: 43.65853, lon: -79.37847, approximate: false, osm: 'relation/16358719' },
  // University of Ottawa, Ottawa
  'ottawa': { lat: 45.42253, lon: -75.68339, approximate: false, osm: 'way/351751481' },
  // York University, Toronto
  'york': { lat: 43.77418, lon: -79.50475, approximate: false, osm: 'way/15396822' },
  // Wilfrid Laurier University, Waterloo
  'laurier': { lat: 43.4728, lon: -80.52809, approximate: false, osm: 'way/226405688' },
  // University of Guelph, Guelph
  'guelph': { lat: 43.53279, lon: -80.225, approximate: false, osm: 'way/161269498' },
  // Carleton University, Ottawa
  'carleton': { lat: 45.38586, lon: -75.695, approximate: false, osm: 'way/10583513' },
  // Brock University, St. Catharines
  'brock': { lat: 43.11774, lon: -79.24986, approximate: false, osm: 'relation/16113732' },
  // Ontario Tech University, Oshawa
  'ontario-tech': { lat: 43.89845, lon: -78.86201, approximate: false, osm: 'way/486701228' },
  // U of T Scarborough, Scarborough
  'toronto-scarborough': { lat: 43.78532, lon: -79.18951, approximate: false, osm: 'relation/21058560' },
  // U of T Mississauga, Mississauga
  'toronto-mississauga': { lat: 43.55022, lon: -79.66266, approximate: false, osm: 'way/32875362' },
  // McGill University, Montreal
  'mcgill': { lat: 45.50689, lon: -73.57871, approximate: false, osm: 'way/19912449' },
  // University of British Columbia, Vancouver
  'ubc': { lat: 49.25789, lon: -123.24298, approximate: false, osm: 'relation/11678160' },
  // Trent University, Peterborough
  'trent': { lat: 44.35729, lon: -78.28938, approximate: false, osm: 'way/755549715' },
  // Dalhousie University, Halifax
  'dalhousie': { lat: 44.6362, lon: -63.592, approximate: false, osm: 'relation/17335000' },
  // University of Alberta, Edmonton
  'alberta': { lat: 53.52682, lon: -113.52449, approximate: false, osm: 'relation/10238561' },
  // University of Windsor, Windsor
  'windsor': { lat: 42.31749, lon: -83.0388, approximate: false, osm: 'node/3090114278' },
  // Laurentian University, Sudbury
  'laurentian': { lat: 46.46664, lon: -80.97387, approximate: false, osm: 'node/333473845' },
  // Lakehead University, Thunder Bay
  'lakehead': { lat: 48.41829, lon: -89.26172, approximate: false, osm: 'way/198508087' },
  // University of Calgary, Calgary
  'calgary': { lat: 51.07505, lon: -114.13881, approximate: false, osm: 'way/4814074' },
  // Nipissing University, North Bay
  'nipissing': { lat: 46.34382, lon: -79.48992, approximate: false, osm: 'relation/19536675' },
  // University of Guelph-Humber, Toronto
  'guelph-humber': { lat: 43.728, lon: -79.60599, approximate: false, osm: 'way/505933031' },
  // UBC Okanagan, Kelowna
  'ubc-okanagan': { lat: 49.94218, lon: -119.39903, approximate: false, osm: 'way/123757617' },
  // University of Victoria, Victoria
  'victoria': { lat: 48.46206, lon: -123.31142, approximate: false, osm: 'relation/1373463' },
  // Concordia University, Montreal
  'concordia': { lat: 45.45826, lon: -73.63935, approximate: false, osm: 'way/468560154' },
  // OCAD University, Toronto
  'ocad': { lat: 43.65235, lon: -79.39081, approximate: false, osm: 'node/12021387334' },
  // Royal Military College, Kingston
  'rmc': { lat: 44.23174, lon: -76.46811, approximate: false, osm: 'way/13732423' },
  // University of New Brunswick, Fredericton
  'unb': { lat: 45.94552, lon: -66.64019, approximate: false, osm: 'relation/17688619' },
  // St. Francis Xavier University, Antigonish
  'stfx': { lat: 45.61753, lon: -61.99488, approximate: false, osm: 'relation/17545384' },
  // Acadia University, Wolfville
  'acadia': { lat: 45.08825, lon: -64.36659, approximate: false, osm: 'relation/17539494' },
  // Mount Allison University, Sackville
  'mount-allison': { lat: 45.8994, lon: -64.3731, approximate: false, osm: 'way/23903148' },
  // Polytechnique Montréal, Montreal
  'polytechnique': { lat: 45.50474, lon: -73.61338, approximate: false, osm: 'node/7095735741' },
  // Saint Mary's University, Halifax
  'smu': { lat: 44.63111, lon: -63.58013, approximate: false, osm: 'relation/17335004' },
  // University of King's College, Halifax
  'kings-college': { lat: 44.63749, lon: -63.59484, approximate: false, osm: 'node/4436211690' },
  // University of Regina, Regina
  'regina': { lat: 50.41523, lon: -104.589, approximate: false, osm: 'way/155526740' },
}

/** The date the lookups above were made, shown wherever the points are. */
export const CAMPUS_POINTS_READ = '2026-08-28'
