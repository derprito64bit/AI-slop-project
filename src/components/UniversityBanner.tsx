import { useState } from 'react'
import UniversityMark from './UniversityMark'
import { bannerFor } from '../lib/universityMarks'

// Full-bleed university logo for the top band of a card.
//
// This is the large sibling of UniversityMark: same files
// (public/images/universities/square/<id>.svg|png), but filling the whole band
// instead of sitting in a small tile. Used by the Explore result cards and the
// Home "Where the data runs deepest" cards so the two stay visually identical.
//
// The band is white because the supplied logos have a white background baked
// in — anything else would show as a box around the art. object-contain, never
// cover: cropping a wordmark cuts off letters.
//
// Falls back to the original gradient-plus-monogram tile for the ~31 schools
// with no artwork yet, so nothing looks broken while files trickle in.

// PNG FIRST, for the same reason as UniversityMark: every file in that
// directory is a .png, so probing .svg first cost a guaranteed 404 per logo
// before the browser asked for the file that exists. UniversityMark was fixed
// on its own and this was missed — the check that proved it ran on /profile,
// which uses the mark, not the banner. If a .svg is ever added for a school,
// rename its .png away.
const EXTENSIONS = ['png', 'svg'] as const


export default function UniversityBanner({
  id,
  name,
  className = '',
}: {
  id: string
  name: string
  /** aspect/rounding for the band, e.g. "aspect-[16/9]" */
  className?: string
}) {
  const [attempt, setAttempt] = useState(0)

  if (attempt >= EXTENSIONS.length) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br ${bannerFor(id)} ${className}`}
      >
        <UniversityMark id={id} name={name} size={64} className="shadow-sm ring-1 ring-line" />
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
      onError={() => setAttempt((a) => a + 1)}
      className={`w-full bg-white object-contain ${className}`}
    />
  )
}
