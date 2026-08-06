// Canonical universities + the alias spellings observed across the source
// spreadsheets. Aliases are matched lowercased with apostrophes and periods
// stripped (see canonicalUniversityId in normalize.mjs).
//
// Anything not listed here lands in the QA report rather than being silently
// dropped, so new spellings surface as a task instead of disappearing.

/** @type {{id:string,name:string,city:string,province:string,aliases:string[]}[]} */
export const UNIVERSITIES = [
  // ---- Ontario (primary focus) ----
  { id: 'waterloo', name: 'University of Waterloo', city: 'Waterloo', province: 'ON',
    aliases: ['waterloo', 'university of waterloo', 'uwaterloo', 'uw'] },
  { id: 'toronto', name: 'University of Toronto', city: 'Toronto', province: 'ON',
    aliases: ['university of toronto', 'uoft - sg', 'uoft st george', 'uoft', 'u of t',
              'toronto', 'uoft - st george', 'university of toronto st george'] },
  { id: 'toronto-scarborough', name: 'U of T Scarborough', city: 'Scarborough', province: 'ON',
    aliases: ['utsc', 'utscarborough', 'uoft - utsc', 'university of toronto scarborough'] },
  { id: 'toronto-mississauga', name: 'U of T Mississauga', city: 'Mississauga', province: 'ON',
    aliases: ['utm', 'uoft - utm', 'university of toronto mississauga'] },
  { id: 'mcmaster', name: 'McMaster University', city: 'Hamilton', province: 'ON',
    aliases: ['mcmaster', 'mcmaster university', 'mac'] },
  { id: 'western', name: 'Western University', city: 'London', province: 'ON',
    aliases: ['western', 'western university', 'uwo', 'western - huron', 'western - kings',
              'western huron', 'western kings'] },
  { id: 'queens', name: "Queen's University", city: 'Kingston', province: 'ON',
    aliases: ['queens', 'queens university', 'queen s', 'queen s university'] },
  { id: 'tmu', name: 'Toronto Metropolitan University', city: 'Toronto', province: 'ON',
    aliases: ['tmu', 'toronto metropolitan university', 'ryerson', 'ryerson university'] },
  { id: 'ottawa', name: 'University of Ottawa', city: 'Ottawa', province: 'ON',
    aliases: ['uottawa', 'university of ottawa', 'ottawa', 'u ottawa'] },
  { id: 'york', name: 'York University', city: 'Toronto', province: 'ON',
    aliases: ['york', 'york university'] },
  { id: 'laurier', name: 'Wilfrid Laurier University', city: 'Waterloo', province: 'ON',
    aliases: ['laurier', 'wilfrid laurier university', 'wlu', 'wilfrid laurier'] },
  { id: 'guelph', name: 'University of Guelph', city: 'Guelph', province: 'ON',
    aliases: ['guelph', 'university of guelph'] },
  { id: 'guelph-humber', name: 'University of Guelph-Humber', city: 'Toronto', province: 'ON',
    aliases: ['guelph-humber', 'guelph humber', 'university of guelph-humber',
              'university of guelph humber'] },
  { id: 'carleton', name: 'Carleton University', city: 'Ottawa', province: 'ON',
    aliases: ['carleton', 'carleton university'] },
  { id: 'ontario-tech', name: 'Ontario Tech University', city: 'Oshawa', province: 'ON',
    aliases: ['ontario tech', 'ontario tech university', 'uoit'] },
  { id: 'brock', name: 'Brock University', city: 'St. Catharines', province: 'ON',
    aliases: ['brock', 'brock university'] },
  { id: 'trent', name: 'Trent University', city: 'Peterborough', province: 'ON',
    aliases: ['trent', 'trent university'] },
  { id: 'windsor', name: 'University of Windsor', city: 'Windsor', province: 'ON',
    aliases: ['windsor', 'university of windsor'] },
  { id: 'laurentian', name: 'Laurentian University', city: 'Sudbury', province: 'ON',
    aliases: ['laurentian', 'laurentian university', 'laurentienne'] },
  { id: 'lakehead', name: 'Lakehead University', city: 'Thunder Bay', province: 'ON',
    aliases: ['lakehead', 'lakehead university'] },
  { id: 'nipissing', name: 'Nipissing University', city: 'North Bay', province: 'ON',
    aliases: ['nipissing', 'nipissing university'] },
  { id: 'ocad', name: 'OCAD University', city: 'Toronto', province: 'ON',
    aliases: ['ocad', 'ocad university'] },
  { id: 'rmc', name: 'Royal Military College', city: 'Kingston', province: 'ON',
    aliases: ['rmc', 'royal military college'] },

  // ---- Rest of Canada ----
  { id: 'mcgill', name: 'McGill University', city: 'Montreal', province: 'QC',
    aliases: ['mcgill', 'mcgill university'] },
  { id: 'ubc', name: 'University of British Columbia', city: 'Vancouver', province: 'BC',
    aliases: ['ubc', 'university of british columbia', 'ubc!'] },
  { id: 'ubc-okanagan', name: 'UBC Okanagan', city: 'Kelowna', province: 'BC',
    aliases: ['ubco', 'ubc kelowna', 'ubc okanagan'] },
  { id: 'alberta', name: 'University of Alberta', city: 'Edmonton', province: 'AB',
    aliases: ['uofalberta', 'university of alberta', 'alberta', 'ualberta'] },
  { id: 'calgary', name: 'University of Calgary', city: 'Calgary', province: 'AB',
    aliases: ['ucalgary', 'university of calgary', 'calgary'] },
  { id: 'dalhousie', name: 'Dalhousie University', city: 'Halifax', province: 'NS',
    aliases: ['dalhousie', 'dalhousie university', 'dal', 'kings dal'] },
  { id: 'victoria', name: 'University of Victoria', city: 'Victoria', province: 'BC',
    aliases: ['uvic', 'university of victoria'] },
  { id: 'concordia', name: 'Concordia University', city: 'Montreal', province: 'QC',
    aliases: ['concordia', 'concordia university'] },
  { id: 'unb', name: 'University of New Brunswick', city: 'Fredericton', province: 'NB',
    aliases: ['unb', 'university of new brunswick'] },
  { id: 'mount-allison', name: 'Mount Allison University', city: 'Sackville', province: 'NB',
    aliases: ['mount allison', 'mount allison university'] },
  { id: 'acadia', name: 'Acadia University', city: 'Wolfville', province: 'NS',
    aliases: ['acadia', 'acadia university'] },
  { id: 'stfx', name: 'St. Francis Xavier University', city: 'Antigonish', province: 'NS',
    aliases: ['st francis xavier university', 'stfx', 'st francis xavier'] },
  { id: 'smu', name: "Saint Mary's University", city: 'Halifax', province: 'NS',
    aliases: ['saint marys university', 'saint mary s university', 'smu'] },
  { id: 'kings-college', name: "University of King's College", city: 'Halifax', province: 'NS',
    aliases: ['university of kings college', 'university of king s college'] },
  { id: 'regina', name: 'University of Regina', city: 'Regina', province: 'SK',
    aliases: ['university of regina', 'uregina'] },
  { id: 'polytechnique', name: 'Polytechnique Montréal', city: 'Montreal', province: 'QC',
    aliases: ['polytechnique montreal', 'polytechnique montréal', 'polytechnique'] },
]

/** alias -> canonical id */
export const ALIAS_TO_ID = Object.fromEntries(
  UNIVERSITIES.flatMap((u) => u.aliases.map((a) => [a, u.id])),
)

/** id -> university record */
export const BY_ID = Object.fromEntries(UNIVERSITIES.map((u) => [u.id, u]))
