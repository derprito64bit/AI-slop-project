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
// HOW THE SQUARING WORKS. Sources are a mix of SVG, PNG and JPEG at wildly
// different aspect ratios, so each is rendered into a 256x256 transparent
// canvas with object-fit: contain and a small inset. Chrome does the
// rasterizing — the same headless browser the sweeps already use, so there is
// no image library to add. A wide wordmark stays wide inside the square; it is
// letterboxed, not stretched.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/images/universities/square')
const WRITE = process.argv.includes('--write')
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const USER_AGENT =
  'acceptiversity-logo-fetch/1.0 (student project; https://github.com/derprito64bit/AI-slop-project)'

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
  brock: { url: `${W}/7/7f/BrockU_CoA.jpg`, depicts: 'arms' },
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

  alberta: { url: `${W}/9/92/University_of_Alberta_Coat_of_Arms.png`, depicts: 'arms' },
  windsor: { url: `${W}/8/8a/Coat_of_Arms_of_the_University_of_Windsor.png`, depicts: 'arms' },
  laurentian: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/43/Laurentian_University_Escutcheon.png',
    depicts: 'arms',
  },
  lakehead: { url: `${W}/3/33/LakeheadU_Coat_of_Arms.jpg`, depicts: 'arms' },
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
  victoria: { url: `${W}/3/37/UVic_CoA.svg`, depicts: 'arms' },
  concordia: { url: `${W}/b/b6/Concordia_coa.png`, depicts: 'arms' },

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

async function download(url) {
  await pause(THROTTLE_MS)
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
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
async function square(page, buffer, type, background = 'transparent') {
  const data = `data:${type};base64,${buffer.toString('base64')}`
  await page.setContent(
    `<style>
       html,body{margin:0;padding:0;background:${background}}
       body{width:${SIZE}px;height:${SIZE}px;display:flex;align-items:center;justify-content:center}
       img{max-width:${SIZE - INSET * 2}px;max-height:${SIZE - INSET * 2}px;object-fit:contain}
     </style><img src="${data}">`,
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
  const inked = await page.$eval('img', (el) => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')
    ctx.drawImage(el, 0, 0, 64, 64)
    const { data } = ctx.getImageData(0, 0, 64, 64)
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      if (a > 24 && !(r > 244 && g > 244 && b > 244)) n += 1
    }
    return n / (64 * 64)
  })
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
    const { buffer, type } = await download(source.url)
    const { png, drawn, inked } = await square(page, buffer, type, source.background)
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
