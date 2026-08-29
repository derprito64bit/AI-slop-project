// The pure half of drawing a university mark: what a school's monogram says,
// and which tint its placeholder gets.
//
// These lived in UniversityMark.tsx and UniversityBanner.tsx, exported from
// component files so they *could* be tested — and never were, because the
// repo's Vitest runs in node and importing a .tsx drags in motion/react. They
// were also two of the sixteen react(only-export-components) warnings. Moving
// them here fixes both problems at once, and is the same split fields.ts,
// overview.ts and courseNeeds.ts already made.
//
// What did NOT move: CREST_MARKS and EXTENSIONS stayed in UniversityMark.tsx.
// Those are render policy — which schools may draw art below 48px, and which
// file extension to try first — and they are read by exactly one component.

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

/**
 * A stable number for a school id, so it always gets the same colour.
 *
 * `bannerFor` and the monogram's `toneFor` each carried a byte-identical copy
 * of this loop. Deduped — but note both callers still take it `% 4` against a
 * four-element list, and that is not incidental: change the multiplier, the
 * seed or the modulus and every school's placeholder colour changes at once.
 */
function hashId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return hash
}

/** Which of the four monogram tones this school's tile draws. */
export function toneFor(id: string): number {
  return hashId(id) % 4
}

// Placeholder banner tints, drawn from the theme tokens so they follow
// light/dark, and picked deterministically so a school always looks the same.
export const BANNERS = [
  'from-brand-100 to-brand-50',
  'from-cloud to-brand-100',
  'from-brand-50 to-surface',
  'from-surface to-cloud',
]

export function bannerFor(id: string): string {
  return BANNERS[hashId(id) % BANNERS.length]
}
