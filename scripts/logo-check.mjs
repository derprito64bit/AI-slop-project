// Render every square mark at the sizes the site actually uses.
//
//   node scripts/logo-check.mjs        writes .logo-check.png (gitignored)
//
// WHY THIS EXISTS. CREST_MARKS in src/components/UniversityMark.tsx decides
// which schools draw their artwork below 48px and which fall back to a
// monogram. That decision cannot be made from the file: "University of
// Waterloo" set in three lines is a perfectly good logo and an unreadable grey
// smudge at 32px, while a shield is still a shield at 24px. The only way to
// know is to look at all of them at once, at the real sizes, which is what this
// prints.
//
// Read the output as a question: at 24 and 32, can you tell which school this
// is? If yes, the id belongs in CREST_MARKS. If it is a grey rectangle, leave
// it out — the monogram is genuinely more useful than an illegible logo.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'public/images/universities/square')
const OUT = join(ROOT, '.logo-check.png')

/** The sizes UniversityMark is actually called at across the site. */
const SIZES = [24, 32, 48, 64]

const files = readdirSync(DIR)
  .filter((f) => /\.(png|svg)$/.test(f))
  .sort()

const rows = files
  .map((f) => {
    const id = f.replace(/\.(png|svg)$/, '')
    const type = f.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
    const src = `data:${type};base64,${readFileSync(join(DIR, f)).toString('base64')}`
    const tile = (px, bg, border) =>
      `<td style="padding:4px"><img src="${src}" style="width:${px}px;height:${px}px;` +
      `object-fit:contain;border:1px solid ${border};border-radius:6px;padding:1px;background:${bg}"></td>`
    const light = SIZES.map((px) => tile(px, '#fff', '#ddd')).join('')
    // The same marks on the dark surface. A black shield on a transparent
    // background is invisible in dark mode, and so is a white knockout on the
    // light one — neither is visible in a single-background contact sheet, and
    // both ship looking like a working logo.
    const dark = SIZES.map((px) => tile(px, '#14161a', '#333')).join('')
    return `<tr><td style="font:12px system-ui;padding:4px 10px">${id}</td>${light}` +
      `<td style="width:14px"></td>${dark}</tr>`
  })
  .join('')

const browser = await launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const page = await browser.newPage()
await page.setViewport({ width: 880, height: 900 })
await page.setContent(
  `<body style="margin:0;background:#faf9f7">
     <table style="border-collapse:collapse;margin:8px">
       <tr><td></td>${SIZES.map((s) => `<td style="font:11px system-ui">${s}</td>`).join('')}
       <td></td>${SIZES.map((s) => `<td style="font:11px system-ui;color:#555">${s} dk</td>`).join('')}</tr>
       ${rows}
     </table>
   </body>`,
  { waitUntil: 'domcontentloaded' },
)
await page.screenshot({ path: OUT, fullPage: true })
await browser.close()

console.log(`${files.length} marks -> .logo-check.png`)
