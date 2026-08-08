import { useState } from 'react'
import UniversityMark from './UniversityMark'

// Full-bleed university logo for the top band of a card.
//
// This is the large sibling of UniversityMark: same files
// (public/images/universities/square/<id>.svg|png), but filling the whole band
// instead of sitting in a small tile. Used by the Explore result cards and the
// Home "Popular right now" cards so the two stay visually identical.
//
// The band is white because the supplied logos have a white background baked
// in — anything else would show as a box around the art. object-contain, never
// cover: cropping a wordmark cuts off letters.
//
// Falls back to the original gradient-plus-monogram tile for the ~31 schools
// with no artwork yet, so nothing looks broken while files trickle in.

const EXTENSIONS = ['svg', 'png'] as const

// Placeholder banner tints, drawn from the theme tokens so they follow
// light/dark, and picked deterministically so a school always looks the same.
const BANNERS = [
  'from-brand-100 to-brand-50',
  'from-cloud to-brand-100',
  'from-brand-50 to-surface',
  'from-surface to-cloud',
]

export function bannerFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return BANNERS[hash % BANNERS.length]
}

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
        <UniversityMark id={id} name={name} size={64} className="shadow-sm ring-1 ring-black/5" />
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
