// Fetch and square-crop the university marks in public/images/universities/square/.
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
//   1. the coat of arms, crest or shield. Square by construction, and legible
//      at 24px, which is the whole reason CREST_MARKS exists in UniversityMark.
//   2. a square icon or monogram mark.
//   3. a wide wordmark lockup, and only if nothing else exists. These stay OUT
//      of CREST_MARKS: "University of Waterloo" set in three lines is a grey
//      smudge at 36px, which is the state the 48px floor was added to fix.
// Never a campus photograph. Wikipedia's pageimages API returns one of those
// for several schools, which is why nothing here is taken from it blindly.
//
// LICENSING. These are institutional arms and wordmarks used to identify each
// school's programs — ordinary nominative use, and no university has been
// asked. That is a deliberate, recorded decision rather than an oversight; see
// HANDOFF-NEXT.md §3. Pulling one is a one-line deletion and the monogram comes
// back on its own.
//
// EXTRACTING A CREST FROM A LOCKUP. Eight schools shipped a lockup — the crest
// set beside or above the school's name — and a lockup is unreadable at 24px, so
// those eight drew a two-letter monogram in every listing despite having
// artwork. The crest inside them is perfectly good: the files are 640x640, so
// the crest region is 150-300px, which is more than the 256 this writes. A
// source with `crop` takes that region instead of the whole image, and `local`
// reads the file already in the folder rather than fetching anything. Boundaries
// came from an ink-band scan of each file, not from eyeballing.
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

  // --- crests extracted from the lockups these schools shipped with ----------
  //
  // All eight had artwork and all eight still drew a two-letter monogram in
  // every listing, because a crest-plus-name lockup is illegible at 24px and
  // the 48px floor caught them. Between them they are 84% of every report the
  // site holds, so this was most of the "placeholder text" left on the site.
  //
  // The crest inside each is the school's own current mark, at 150-300px in a
  // 640x640 file — better provenance than a heraldic variant fetched from
  // elsewhere, and no new licensing surface, since the file already shipped.
  // Boxes are tight ink bounds computed from each file, not eyeballed.
  waterloo: {
    local: 'waterloo.png',
    depicts: 'arms',
    crop: { x: 0.383, y: 0.449, w: 0.23, h: 0.262 },
  },
  mcmaster: {
    local: 'mcmaster.png',
    depicts: 'arms',
    // Top edge sits BELOW the baseline of "McMaster", which runs right over
    // the shield — an ink-bounds scan alone kept catching the "ter".
    crop: { x: 0.645, y: 0.447, w: 0.19, h: 0.248 },
  },
  western: {
    local: 'western.png',
    depicts: 'arms',
    crop: { x: 0.32, y: 0.203, w: 0.379, h: 0.465 },
  },
  toronto: {
    // NOT extracted. The crest inside the lockup is genuinely tall and narrow
    // — about 1:2 — so cropped into a square it renders as a sliver a quarter
    // the height of every shield beside it. The published arms are 180x180 and
    // hold their detail at 24px, which is the whole test.
    url: `${C.replace('/commons/', '/en/')}/0/04/Utoronto_coa.svg/500px-Utoronto_coa.svg.png`,
    depicts: 'arms',
  },
  queens: {
    local: 'queens.png',
    depicts: 'arms',
    crop: { x: 0.355, y: 0.215, w: 0.293, h: 0.359 },
  },
  ottawa: {
    local: 'ottawa.png',
    depicts: 'arms',
    // Not heraldry — the portico device uOttawa uses as its mark. It exists
    // nowhere except inside this lockup, which is the case extraction is for.
    crop: { x: 0.25, y: 0.063, w: 0.5, h: 0.566 },
  },
  york: {
    local: 'york.png',
    depicts: 'arms',
    // The red U block, likewise a brand device rather than arms.
    crop: { x: 0.609, y: 0.352, w: 0.352, h: 0.258 },
  },
  guelph: {
    local: 'guelph.png',
    depicts: 'arms',
    crop: { x: 0.402, y: 0.156, w: 0.199, h: 0.309 },
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
 * Read one of the original lockups — the crest-extraction path.
 *
 * From scripts/lockups/, NOT from the output folder: this script overwrites
 * square/<id>.png with the crest it crops out, so reading the input from there
 * would crop its own output on the second run and zoom further in every time.
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
