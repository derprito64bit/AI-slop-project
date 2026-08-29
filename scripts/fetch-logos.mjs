// Fetch and square the university marks in public/images/universities/square/.
//
//   node scripts/fetch-logos.mjs             report what it would do, write nothing
//   node scripts/fetch-logos.mjs --write     download and write the PNGs
//   node scripts/fetch-logos.mjs --write ubc trent      just those ids
//
// WHY THIS EXISTS. `UniversityMark` renders square/<id>.png and falls back to a
// coloured monogram tile when there is no file. That fallback is real design,
// not a placeholder — every school renders with or without art — but 30 of the
// 39 were monograms, including Toronto Metropolitan at 7.2% of every report the
// site holds. A wall of two-letter tiles is the visual version of "we do not
// know these schools", which is the opposite of what the data says.
//
// WHY A COMMITTED SCRIPT AND NOT JUST THE FILES. The same reason
// campus-points.mjs exists: a binary dropped into a folder carries no record of
// where it came from. SOURCES below is the provenance — every mark names its
// URL and what it depicts, so a wrong or newly-rebranded logo is a diff
// somebody can see rather than a mystery PNG. Re-running is how you refresh one.
//
// WHAT MAKES A GOOD SOURCE, in order:
//   1. the school's own current mark, whatever shape it is. Prefer the file the
//      university actually publishes over a heraldic variant found elsewhere.
//   2. the coat of arms, crest or shield, for a school that publishes one on
//      its own. Square by construction and legible at 24px.
//   3. a square icon or monogram mark.
// Never a campus photograph. Wikipedia's pageimages API returns one of those
// for several schools, which is why nothing here is taken from it blindly.
//
// This list used to rank a crest above the published lockup, and the eight
// entries under "the full lockups" below were cropped down to obey it. That
// ordering optimised for the 24px tile and paid for it by shipping a mark no
// university publishes. Legibility is now CREST_MARKS' problem, not the
// artwork's.
//
// LICENSING. These are institutional arms and wordmarks used to identify each
// school's programs — ordinary nominative use, and no university has been
// asked. That is a deliberate, recorded decision rather than an oversight; see
// HANDOFF-NEXT.md §3. Pulling one is a one-line deletion and the monogram comes
// back on its own.
//
// LOCAL SOURCES. A source with `local` reads a file from scripts/lockups/
// instead of fetching anything. That is how the eight schools whose mark is a
// full lockup are built — the artwork was supplied rather than downloaded, so
// there is no URL to record, and the file itself is the provenance. See the
// block that starts "the full lockups, uncropped" in SOURCES.
//
// `crop` still works and nothing uses it. It takes a fractional region of the
// source instead of the whole image, clipping rather than centring. It was
// added to cut the crest out of those eight lockups and it did that correctly;
// the reason it is unused is a design decision, not a defect, and it is kept
// because the next mark that arrives buried in a sheet of other artwork will
// want it.
//
// HOW THE SQUARING WORKS. Sources are a mix of SVG, PNG and JPEG at wildly
// different aspect ratios, so each is rendered into a 256x256 transparent
// canvas with object-fit: contain and a small inset. Chrome does the
// rasterizing — the same headless browser the sweeps already use, so there is
// no image library to add. A wide wordmark stays wide inside the square; it is
// letterboxed, not stretched.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/images/universities/square')
const WRITE = process.argv.includes('--write')
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
// Mozilla-prefixed on purpose. Two university CDNs answer 403 to anything that
// does not look like a browser, and the point of the string is to identify who
// is asking rather than to pretend otherwise — the project name and its repo
// are still in it.
const USER_AGENT =
  'Mozilla/5.0 (compatible; acceptiversity-logo-fetch/1.0; ' +
  '+https://github.com/derprito64bit/AI-slop-project)'

/** Rendered canvas, and the breathing room left around the art inside it. */
const SIZE = 256
const INSET = 8

/**
 * Where each mark comes from, and what it is.
 *
 * `depicts` is not decoration — it is what decides whether an id belongs in
 * CREST_MARKS in src/components/UniversityMark.tsx. Only 'arms' is legible at
 * 24px. Anything marked 'wordmark' keeps the 48px floor and draws a monogram in
 * listings, which is correct rather than a shortfall.
 *
 * The nine ids not listed here already had files before this script existed.
 */
const C = 'https://upload.wikimedia.org/wikipedia/commons/thumb'
const W = 'https://upload.wikimedia.org/wikipedia/en'

const SOURCES = {
  // --- Ontario, by report volume ------------------------------------------
  tmu: {
    url: `${C}/6/64/Escutcheon_of_Toronto_Metropolitan_University.svg/500px-Escutcheon_of_Toronto_Metropolitan_University.svg.png`,
    depicts: 'arms',
    // The escutcheon, not the full achievement. The complete arms carry a crest
    // and supporters that collapse into noise at 24px; the shield alone is the
    // part that still reads.
  },
  carleton: {
    url: `${C}/6/6b/Carleton_University_Escutcheon.png/500px-Carleton_University_Escutcheon.png`,
    depicts: 'arms',
  },
  brock: {
    url: `${W}/7/7f/BrockU_CoA.jpg`,
    depicts: 'arms',
    // Stays the full achievement, and so stays out of CREST_MARKS. Searched:
    // Brock has no escutcheon file under any spelling, its brand site publishes
    // a wordmark only, and its athletics mark is a badger plus wordmark.
  },
  'ontario-tech': {
    url: 'https://shared.ontariotechu.ca/shared/department/communications/brand/visual-identities/9_coat_of_arms/UOIT_crest-100.jpg',
    depicts: 'arms',
    // Fine blue linework with a motto scroll — correct shape, but judge it on
    // the contact sheet before adding it to CREST_MARKS.
  },
  // UTSC and UTM have no heraldry of their own; both campuses use the one
  // university's arms. Giving all three Toronto rows the identical shield would
  // be accurate and useless — the student is trying to tell them apart. So each
  // campus gets its own wordmark, which names the campus. Wide, so both stay
  // out of CREST_MARKS and draw a monogram in listings, exactly as `toronto`
  // already does.
  'toronto-scarborough': {
    url: `${W}/6/62/UofT_Scarborough_logo.svg`,
    depicts: 'wordmark',
    background: '#fff',
  },
  'toronto-mississauga': {
    url: `${W}/2/20/UofT-Mi-logo.svg`,
    depicts: 'wordmark',
    background: '#fff',
  },

  // --- out of province ------------------------------------------------------
  mcgill: {
    url: `${C}/7/76/Mcgill_university_coa.png/500px-Mcgill_university_coa.png`,
    depicts: 'arms',
  },
  ubc: {
    url: `${C}/f/fb/British_columbia_univ_coat_arms.svg/500px-British_columbia_univ_coat_arms.svg.png`,
    depicts: 'arms',
  },
  dalhousie: {
    url: `${C.replace('/commons/', '/en/')}/c/c3/Dalhousie_University_Seal.svg/500px-Dalhousie_University_Seal.svg.png`,
    depicts: 'arms',
  },

  alberta: {
    // The university's own shield, not the full achievement that was here
    // before. Single-colour green, and it survives 24px where the achievement
    // did not.
    url: 'https://www.ualberta.ca/favicon.svg',
    depicts: 'arms',
  },
  windsor: {
    url: 'https://www.uwindsor.ca/sites/all/themes/uwindsor_bootstrap/images/uwindsor_shield.svg',
    depicts: 'arms',
    // The institutional shield rather than the Lancers athletics one, which is
    // marginally cleaner small but is the sports mark, not the university's.
  },
  laurentian: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/43/Laurentian_University_Escutcheon.png',
    depicts: 'arms',
  },
  lakehead: {
    url: 'https://www.lakeheadu.ca/apple-touch-icon.png',
    depicts: 'arms',
    // Lakehead's brand shield, which is the escutcheon out of its full arms.
  },
  calgary: {
    url: `${C}/7/7e/University_of_Calgary_coat_of_arms_without_motto_scroll.svg/500px-University_of_Calgary_coat_of_arms_without_motto_scroll.svg.png`,
    depicts: 'arms',
    // The version WITHOUT the motto scroll. Calgary publishes both, and the
    // scroll is the first thing to turn to mush below 32px.
  },
  nipissing: { url: `${W}/4/4e/Nipissing_University_Coat_of_Arms.png`, depicts: 'arms' },
  'guelph-humber': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Guelph-Humber_logo.png',
    depicts: 'wordmark',
    background: '#fff',
    // A joint Guelph/Humber program with no heraldry of its own. Its only other
    // asset is 8.3:1, which is far worse in a square tile than this.
  },
  'ubc-okanagan': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/British_columbia_univ_coat_arms.svg',
    depicts: 'arms',
    // The parent shield. UBC treats the crest as one institutional mark across
    // both campuses and distinguishes Okanagan only by a wordmark descriptor,
    // so unlike the two Toronto campuses there is no campus-specific art to
    // prefer. The rule throughout is the most specific mark that exists.
  },
  victoria: {
    // The escutcheon file, NOT a thumb of it: the source is 313px and Wikimedia
    // will not upscale past that, so a 500px request 404s.
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/University_of_Victoria_Escutcheon.png',
    depicts: 'arms',
  },
  concordia: {
    url: `${C}/0/0a/Coat_of_arms_of_Concordia_University.svg/500px-Coat_of_arms_of_Concordia_University.svg.png`,
    depicts: 'arms',
    // Named "Coat of arms of" on Commons but is escutcheon-only, and CC0.
  },

  // --- the full lockups, uncropped -------------------------------------------
  //
  // These eight ship a LOCKUP - the crest set beside or above the school's name
  // - and for a while this script cropped the crest out of each, because a
  // lockup is illegible at 24px and the 48px floor in UniversityMark caught
  // them. The crops were tight and they were still damage: a shield cut out of
  // the mark its owner publishes is not that mark, and on a page of program
  // rows the seams showed.
  //
  // So the crop boxes are gone. Each of these is now the whole supplied file,
  // letterboxed into the square - nothing cut off, nothing zoomed. The cost is
  // real and it is deliberate: see the note above CREST_MARKS in
  // src/components/UniversityMark.tsx for what a 3.2:1 lockup does in a 24px
  // tile, and the contact sheet from `npm run logos:check` for the rest.
  //
  // PROVENANCE. Unlike every other entry here these carry no URL. They were
  // supplied by the maintainer as files (dropped in ~/Downloads/logos on
  // 2026-08-28) and copied into scripts/lockups/ under their school id -
  // `uoft.png` became `toronto.png`, `uottawa.png` became `ottawa.png`. Where
  // each was originally downloaded from was NOT recorded, and saying so is the
  // honest version of that rather than a URL reconstructed after the fact.
  // Four of the eight (queens, toronto, ottawa, waterloo) arrived with a
  // transparent background, which is better artwork than the white-composited
  // 640x640 files they replace; git history of scripts/lockups/ holds those.
  //
  // BACKGROUND IS WHITE, NOT TRANSPARENT, for all eight. Every one sets the
  // school's name in dark type - navy, black, slate, crimson - and dark type on
  // transparency is invisible on the dark surface. Same reason the two U of T
  // campus wordmarks are composited, and what the marks already in this folder
  // do.
  waterloo: { local: 'waterloo.png', depicts: 'lockup', background: '#fff' },
  mcmaster: { local: 'mcmaster.png', depicts: 'lockup', background: '#fff' },
  western: { local: 'western.png', depicts: 'lockup', background: '#fff' },
  toronto: {
    // Was the only one of the eight NOT extracted - the crest inside the lockup
    // is about 1:2, so it cropped to a sliver, and this entry fetched the
    // published 180x180 arms from Commons instead. That was the right answer to
    // a question nobody is asking any more: the lockup is what U of T puts on
    // things, so the lockup is what goes here.
    local: 'toronto.png',
    depicts: 'lockup',
    background: '#fff',
  },
  queens: { local: 'queens.png', depicts: 'lockup', background: '#fff' },
  ottawa: {
    // 250x212, the smallest input here by a distance, against a 256 canvas - so
    // it draws about 1:1 and gains nothing from the inset. Legible, but this is
    // the first one to replace if a larger file turns up.
    local: 'ottawa.png',
    depicts: 'lockup',
    background: '#fff',
  },
  york: { local: 'york.png', depicts: 'lockup', background: '#fff' },
  guelph: {
    // Supplied on a light grey (#d9d9d9) card rather than on white, so this one
    // draws a faint frame inside the tile that the other seven do not. Left in:
    // trimming it is a crop, and the point of this block is that nothing here
    // is cropped.
    local: 'guelph.png',
    depicts: 'lockup',
    background: '#fff',
  },

  ocad: {
    url: 'https://www.ocadu.ca/themes/custom/ocad/img/favicons/web-app-manifest-512x512.png',
    depicts: 'monogram',
    background: '#fff',
    // OCAD U has no arms. This is their own square icon mark; the Commons file
    // carries the full "OCAD UNIVERSITY" wordmark and is worse small.
  },
  rmc: {
    url: `${C}/3/3f/Royal_Military_College_Arms.svg/500px-Royal_Military_College_Arms.svg.png`,
    depicts: 'arms',
    // Also stays the full achievement. Everything RMC publishes carries the
    // crown, wreath and TRUTH DUTY VALOUR scroll; the Paladins mark is a
    // wordmark lockup and rmc-cmr.ca's icon is the generic federal maple leaf.
  },
  unb: {
    url: `${C}/8/80/Coat_of_Arms_of_the_University_of_New_Brunswick.png/500px-Coat_of_Arms_of_the_University_of_New_Brunswick.png`,
    depicts: 'arms',
    // The CC0 raster rather than the CC BY-SA vector of the same arms — same
    // picture, no attribution string to carry.
  },
  stfx: {
    url: `${C.replace('/commons/', '/en/')}/f/f7/StFXCoatofArms.svg/500px-StFXCoatofArms.svg.png`,
    depicts: 'arms',
    // Stays the full achievement, and so stays out of CREST_MARKS. StFX does
    // publish a clean brand shield at
    // goxgo.ca/assets/favicons/web-app-manifest-512x512.png, but that host
    // answers 403 to a script under any User-Agent tried, and a source this
    // file cannot actually fetch is not a source.
  },
  acadia: { url: `${W}/0/06/Acadia_University_Coat_of_Arms_2017.jpg`, depicts: 'arms' },
  'mount-allison': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/Mount_Allison_University_Escutcheon.png',
    depicts: 'arms',
  },
  polytechnique: {
    url: `${C.replace('/commons/', '/en/')}/4/4f/%C3%89cole_Polytechnique_de_Montr%C3%A9al_Logo.svg/500px-%C3%89cole_Polytechnique_de_Montr%C3%A9al_Logo.svg.png`,
    depicts: 'arms',
    background: '#fff',
    // Dark line-art on transparency: invisible on the dark surface without it.
    // polymtl.ca sits behind bot protection, so nothing official could be
    // fetched. This is the historic seal, which Polytechnique still uses as its
    // protocol ecusson; every Commons alternative is a wide wordmark.
  },
  smu: {
    url: 'https://www.smu.ca/favicons/android-chrome-384x384.png',
    depicts: 'monogram',
    // Saint Mary's HALIFAX, which has no arms on Commons. Not to be confused
    // with the Canadian Heraldic Authority entry for St. Mary's University
    // College, which is the Calgary institution.
  },
  'kings-college': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/13/UKings_Crest.png',
    depicts: 'arms',
  },
  regina: {
    url: `${C}/c/cf/URegina_Coat_of_Arms.svg/500px-URegina_Coat_of_Arms.svg.png`,
    depicts: 'arms',
  },

  // Trent is deliberately absent. Its official crest is a WHITE KNOCKOUT on
  // transparency — invisible on the light tile these are drawn on — and Trent
  // is one of the few Canadian universities with no granted arms of its own
  // (only its colleges have heraldry, which is the wrong level of institution
  // for this). Its only other mark is a 3.2:1 wordmark, worse at 24px than the
  // monogram it would replace. The blank check below refuses the knockout on
  // its own if anyone adds it back without reading this.
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms))

// upload.wikimedia.org answers 429 "does not comply with our robot policy" when
// a script asks for several files in quick succession. This is a one-off build
// step over 30 rows, so waiting is free.
const THROTTLE_MS = 500

/**
 * Read a supplied source file from scripts/lockups/.
 *
 * From scripts/lockups/, NOT from the output folder. This script overwrites
 * square/<id>.png, so an input read from there would be reprocessed on every
 * run — harmless while nothing is cropped, and it silently zoomed further in
 * on every run back when the eight lockups were being cropped. Keeping the
 * input and the output in separate folders is what makes the step repeatable.
 */
function readLocal(name) {
  return { buffer: readFileSync(join(ROOT, 'scripts/lockups', name)), type: 'image/png' }
}

async function download(url, attempt = 0) {
  await pause(THROTTLE_MS * (attempt + 1))
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  // A 429 says the server is busy, NOT that the URL is wrong. Treating one as a
  // dead link is how a perfectly good file gets replaced with a worse one:
  // three of these were nearly swapped out over a rate limit that cleared on
  // the next try.
  if (res.status === 429 && attempt < 4) return download(url, attempt + 1)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const type = res.headers.get('content-type') ?? ''
  if (!/^image\//.test(type)) throw new Error(`not an image: ${type}`)
  return { buffer: Buffer.from(await res.arrayBuffer()), type }
}

/**
 * Draw whatever it is into a SIZE x SIZE PNG, contained not cropped.
 *
 * Transparent by default, because a self-contained colour shield looks right on
 * both themes that way. `background` exists for the marks that do not: dark
 * lettering on transparency disappears completely on the dark surface, which is
 * how the two U of T campus wordmarks first rendered — solid black tiles at
 * 24px, visibly worse than the monogram they replaced. Compositing those onto
 * white matches what every pre-existing mark in this folder already does.
 */
async function square(page, buffer, type, background = 'transparent', crop = null) {
  const data = `data:${type};base64,${buffer.toString('base64')}`
  // With a crop box the image is blown up and shifted so the wanted region
  // fills the frame, and the frame hides the rest. Scaling by 1/w keeps the
  // aspect ratio, so a crest is never stretched to fill a square.
  // The crop must CLIP, not just centre. An earlier version scaled by
  // 1/max(w,h) and let the shorter axis show whatever was beside it, so a tall
  // narrow crest came out with the wordmark next to it still in frame — which
  // is the exact thing cropping was for. The box is now its own clipping
  // window, sized to the crop's aspect and centred, and the image is shifted
  // inside it.
  const fit = SIZE - INSET * 2
  const k = crop ? fit / Math.max(crop.w, crop.h) : 0
  const frame = crop
    ? `<div style="width:${crop.w * k}px;height:${crop.h * k}px;overflow:hidden;position:relative">` +
      `<img src="${data}" style="position:absolute;width:${k}px;height:${k}px;` +
      `left:${-crop.x * k}px;top:${-crop.y * k}px;max-width:none">` +
      `</div>`
    : `<img src="${data}" style="max-width:${fit}px;max-height:${fit}px;object-fit:contain">`
  await page.setContent(
    `<style>
       html,body{margin:0;padding:0;background:${background}}
       body{width:${SIZE}px;height:${SIZE}px;display:flex;align-items:center;justify-content:center}
     </style>${frame}`,
    // NOT networkidle0. Several of these SVGs reference a webfont that never
    // resolves offline, so the network never goes idle and a perfectly good
    // logo times out after 30s. What actually matters is that the image
    // decoded, so wait for that instead.
    { waitUntil: 'domcontentloaded' },
  )
  await page.evaluate(
    () => document.querySelector('img').decode().catch(() => {}),
  )
  // Chrome reports a decode failure as a zero-sized image rather than throwing,
  // and a 0x0 source silently produces a blank tile that looks like a working
  // logo until you open the page.
  const drawn = await page.$eval('img', (el) => ({ w: el.naturalWidth, h: el.naturalHeight }))
  if (!drawn.w || !drawn.h) throw new Error('decoded to nothing')

  // And a BLANK image decodes perfectly well. One of these sources turned out
  // to be a 256x256 sheet of white, which would have shipped as an invisible
  // logo — worse than the monogram it replaced, because nothing looks broken.
  // So measure how much of the canvas is actually inked.
  const inked = await page.$eval('img', (el, box) => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')
    // The CROPPED region, when there is one. Measuring the whole source would
    // score a lockup by its wordmark and tell us nothing about whether the
    // crest we actually cut out has anything in it.
    if (box) {
      ctx.drawImage(
        el,
        box.x * el.naturalWidth, box.y * el.naturalHeight,
        box.w * el.naturalWidth, box.h * el.naturalHeight,
        0, 0, 64, 64,
      )
    } else {
      ctx.drawImage(el, 0, 0, 64, 64)
    }
    const { data } = ctx.getImageData(0, 0, 64, 64)
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      if (a > 24 && !(r > 244 && g > 244 && b > 244)) n += 1
    }
    return n / (64 * 64)
  }, crop)
  if (inked < 0.02) throw new Error(`blank — only ${(inked * 100).toFixed(1)}% inked`)

  return { png: await page.screenshot({ omitBackground: background === 'transparent' }), drawn, inked }
}

const ids = ONLY.length ? ONLY : Object.keys(SOURCES)
if (!ids.length) {
  console.log('SOURCES is empty — nothing to do.')
  process.exit(0)
}

const browser = await launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 })

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const done = []
const failed = []

for (const id of ids) {
  const source = SOURCES[id]
  if (!source) {
    failed.push([id, 'no entry in SOURCES'])
    continue
  }
  try {
    const { buffer, type } = source.local
      ? readLocal(source.local)
      : await download(source.url)
    const { png, drawn, inked } = await square(page, buffer, type, source.background, source.crop)
    const target = join(OUT, `${id}.png`)
    if (WRITE) writeFileSync(target, png)
    done.push([
      id,
      source.depicts,
      `${drawn.w}x${drawn.h}`,
      `${(png.length / 1024).toFixed(1)}kB`,
      `${(inked * 100).toFixed(0)}% inked`,
    ])
  } catch (error) {
    failed.push([id, String(error.message).slice(0, 60)])
  }
}

await browser.close()

for (const [id, depicts, from, size, ink] of done) {
  console.log(
    `  ${WRITE ? 'wrote' : 'ok   '}  ${id.padEnd(22)} ${String(depicts).padEnd(10)} ${from.padEnd(12)} ${size.padEnd(9)} ${ink}`,
  )
}
for (const [id, why] of failed) console.log(`  FAIL   ${id.padEnd(22)} ${why}`)

console.log(`\n${done.length} ok, ${failed.length} failed${WRITE ? '' : '  (dry run — pass --write)'}`)

// A mark that is only legible large is worse than a monogram, so the CREST_MARKS
// suggestion is printed rather than written: somebody has to look at it at 32px.
const crest = done.filter(([id]) => SOURCES[id]?.depicts === 'arms').map(([id]) => id)
if (crest.length) {
  console.log(`\nDepicted as arms — candidates for CREST_MARKS, after looking at each at 32px:`)
  console.log(`  ${crest.join(', ')}`)
}

if (failed.length) process.exitCode = 1
