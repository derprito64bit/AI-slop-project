import { useState } from 'react'

// Square university mark for program listings.
//
// Renders public/images/universities/square/<id>.png, then .svg, and finally
// falls back to a monogram tile. That means all 39 schools have a usable mark
// today, and real logos replace monograms one file at a time as they land —
// no code change needed.
//
// PNG IS TRIED FIRST because every file in that directory is a .png. With svg
// first, each real mark cost a guaranteed 404 before the browser asked for the
// file that exists — dozens of failed requests per page, which is console noise
// on every screen and a wasted round trip on a phone. Nothing breaks either
// way; the fallback always caught it. If a .svg is ever added, put it first for
// that school by renaming the .png away.
//
// Note this is deliberately separate from the wide wordmarks in
// public/images/universities/, which the Home logo band uses. Wordmarks are
// unreadable at this size.

const EXTENSIONS = ['png', 'svg'] as const

/**
 * Schools whose square file is CREST OR ICON art rather than a wordmark lockup.
 *
 * This replaced a blanket `size < 48` rule, which existed because the only
 * files in that directory then were lockups — "University of Waterloo" set in
 * three lines is an unreadable grey smudge at 36px, so every listing on the
 * site drew a monogram instead and the logos only ever appeared on program
 * pages. Those eight lockups have since had their crests cropped out, which is
 * why they are in the set below rather than excluded by it.
 *
 * The rule was right about the files and wrong about the reason: a crest is
 * legible at 24px. So the threshold is per school now. An id in this set draws
 * its artwork at any size; everything else keeps the 48px floor.
 *
 * ADD AN ID HERE ONLY WHEN THAT SCHOOL'S FILE IS ACTUALLY SQUARE ART. Look at
 * it at 32px first. Getting this wrong does not break anything — it just puts
 * an illegible smudge in every program row, which is the state this replaced.
 */
const CREST_MARKS = new Set<string>([
  // Wilfrid Laurier — circular crest, reads down to about 20px.
  'laurier',
  // Everything below was judged on the contact sheet from
  // `npm run logos:check`, which draws every mark at 24/32/48/64 on both the
  // light and the dark surface. The test is not "is this a crest" — it is "at
  // 24px, can you still tell which school this is".
  'tmu', // escutcheon: yellow field, blue chevron. Unmistakable at 24.
  'carleton', // black shield, red maple leaf. The strongest of the set.
  'mcgill', // red-on-white shield, three martlets still countable at 32.
  'ubc', // blue and gold shield, holds its blocking at 24.
  'dalhousie', // gold seal. Detail goes at 24, but a gold roundel is distinctive.
  'calgary', // red shield, heavy blocking. Survives 24 easily.
  'laurentian', // blue and white shield with a gold sun. The cleanest of the set.
  'nipissing', // blue shield, strong white waves.
  'ubc-okanagan', // the UBC shield — see the note in fetch-logos.mjs.
  // The eight that shipped a CREST-PLUS-NAME LOCKUP and therefore drew a
  // two-letter monogram in every listing despite having artwork. Between them
  // they are 84% of every report the site holds, so they were most of the
  // placeholder text left on it. The crest was cropped out of the lockup each
  // already had — see the `crop` boxes in fetch-logos.mjs — except Toronto,
  // whose crest is about 1:2 and became a sliver in a square tile, so it takes
  // the published arms instead.
  'waterloo',
  'mcmaster',
  'western',
  'toronto',
  'queens',
  'ottawa', // the portico device, not heraldry — it exists only in the lockup
  'york', // likewise the red U block
  'guelph',
  'mount-allison', // gold escutcheon, three white books. Reads at 20.
  'unb', // red shield. Strong at 24.
  'smu', // maroon brand shield, not heraldry, but square and high-contrast.
  'kings-college', // blue and white saltire shield.
  'acadia', // blue and white shield, clean blocking.
  'regina', // green shield — the only green in the set, which is half of why it works.
  // These six were full achievements and are now the escutcheon alone, either
  // from Commons' `<University> Escutcheon` series or from the school's own
  // brand shield. Same institutions, a third of the artwork, and legible where
  // the achievement was mud.
  'alberta', // green shield, open book and wheat sheaves.
  'windsor', // blue and white, a large W. The clearest of the six.
  'lakehead', // red chief over blue and white waves.
  'concordia', // black shield, gold sun. Unmistakable.
  'victoria', // blue shield, three red martlets over an open book.
  // DELIBERATELY NOT HERE, having looked at every one of them at 24px:
  //   brock, rmc, stfx
  //     — full heraldic ACHIEVEMENTS: crest, helm, mantling, supporters and a
  //       motto scroll. Beautiful at 64 and an indistinct blob at 24, because
  //       the shield is only a third of the artwork. Searched for an escutcheon
  //       for all three and none exists under any spelling; StFX publishes a
  //       clean brand shield on a host that 403s every script.
  //   ontario-tech, polytechnique
  //     — fine linework; a smudge below 48.
  //   ocad
  //     — a lettering monogram. Square, but it is TEXT, and text at 24px is the
  //       exact thing the 48px floor exists to stop.
  // Every one of those is correct square art and renders properly at 48 and up,
  // which is all the 48px floor asks. The monogram is genuinely more useful
  // than an illegible logo, and that is why this set is opt-in rather than
  // "has a file". If a shield-only variant of any of them turns up, it is a
  // one-line change here plus a new URL in fetch-logos.mjs.
])

/**
 * What we know about each school's file, remembered for the session.
 *
 * Without this every instance probes independently: a program list is dozens of
 * rows, and a school with no file costs two failed requests PER ROW rather than
 * two per page. The cache is seeded on mount and written on error, so the first
 * row pays for the discovery and the rest read the answer.
 *
 * Deliberately not persisted. A logo file that lands between two visits should
 * show up on the second one, not after a cache is manually cleared.
 */
const resolved = new Map<string, number>()

/** Words that carry no identity in a school name. */
const STOP = /^(university|universite|college|of|the|at|de)$/i

/** "University of Waterloo" -> "WA", "Toronto Metropolitan University" -> "TM" */
export function initialsFor(name: string): string {
  const words = name
    // Drop apostrophes rather than splitting on them, so "Queen's" stays one
    // word and yields "QU" instead of "QS".
    .replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .filter((w) => w && !STOP.test(w))

  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

/** Stable per-school colour: the same school always gets the same tile. */
function toneFor(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return hash % 4
}

export default function UniversityMark({
  id,
  name,
  size = 40,
  className = '',
}: {
  id: string
  name: string
  size?: number
  className?: string
}) {
  // Seeded from the session cache: a school already known to have no file
  // starts exhausted and never asks for it again.
  const [attempt, setAttempt] = useState(() => resolved.get(id) ?? 0)

  // A wordmark lockup below ~48px is an unreadable smudge — at 36px in "Similar
  // programs" those marks read as blank white squares. Crest art does not have
  // that problem, so the floor applies only to the schools whose file is a
  // lockup. See CREST_MARKS above.
  const tooSmallForArt = size < 48 && !CREST_MARKS.has(id)
  const exhausted = tooSmallForArt || attempt >= EXTENSIONS.length

  const box = `shrink-0 overflow-hidden rounded-md ${className}`
  const style = { width: size, height: size }

  if (exhausted) {
    return (
      <div
        className={`${box} mono-${toneFor(id)} flex items-center justify-center font-600`}
        style={{ ...style, fontSize: Math.round(size * 0.36) }}
        aria-hidden="true"
      >
        {initialsFor(name)}
      </div>
    )
  }

  return (
    <img
      // Remount on each attempt so the browser retries with the next extension.
      key={EXTENSIONS[attempt]}
      src={`${import.meta.env.BASE_URL}images/universities/square/${id}.${EXTENSIONS[attempt]}`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() =>
        setAttempt((a) => {
          const next = a + 1
          // Record the miss so the other rows on this page skip straight past
          // an extension we already know is not there.
          resolved.set(id, next)
          return next
        })
      }
      // max-w-none is load-bearing. Tailwind's preflight sets
      // `img { max-width: 100% }`, so inside a SHRINKING flex item the image is
      // capped at the shrunken parent rather than at `size` — the Fields marks
      // row squeezed 28px marks down to 10px and they read as blank tiles. The
      // monogram branch is a <div> and was never affected, so the bug only
      // showed on schools that actually had artwork, which for a long time was
      // just Laurier.
      className={`${box} max-w-none border border-line bg-paper object-contain p-1`}
      style={style}
    />
  )
}
