import { useState } from 'react'

// Square university mark for program listings.
//
// Renders public/images/universities/square/<id>.svg, then .png, and finally
// falls back to a monogram tile. That means all 39 schools have a usable mark
// today, and real logos replace monograms one file at a time as they land —
// no code change needed.
//
// Note this is deliberately separate from the wide wordmarks in
// public/images/universities/, which the Home logo band uses. Wordmarks are
// unreadable at this size.

const EXTENSIONS = ['svg', 'png'] as const

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
  const [attempt, setAttempt] = useState(0)
  const exhausted = attempt >= EXTENSIONS.length

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
      onError={() => setAttempt((a) => a + 1)}
      className={`${box} border border-line bg-paper object-contain p-1`}
      style={style}
    />
  )
}
