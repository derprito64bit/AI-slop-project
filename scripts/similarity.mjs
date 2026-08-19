// Fuzzy string matching for the data QA report — no dependencies.
//
// Used to suggest which canonical university an unrecognised spelling probably
// means. Suggestions are never applied automatically; they exist so resolving a
// new spelling is a copy-paste into data/overrides.json rather than research.

/** Classic Levenshtein edit distance. */
export function levenshtein(a, b) {
  const s = String(a)
  const t = String(b)
  if (s === t) return 0
  if (!s.length) return t.length
  if (!t.length) return s.length

  let prev = Array.from({ length: t.length + 1 }, (_, i) => i)
  const curr = new Array(t.length + 1)

  for (let i = 1; i <= s.length; i++) {
    curr[0] = i
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = [...curr]
  }
  return prev[t.length]
}

const clean = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Words that carry no signal when comparing school names. */
const STOP = new Set(['university', 'universite', 'college', 'of', 'the', 'at', 'de'])

/**
 * Words that, when present on one side only, usually mean a *different*
 * institution rather than a spelling variant: "New York" vs "York",
 * "Toronto Metropolitan" vs "Toronto", "UBC Okanagan" vs "UBC".
 * A name differing by one of these is never reported as a confident match.
 */
const DISTINGUISHERS = new Set([
  'new', 'north', 'northern', 'south', 'southern', 'east', 'eastern', 'west', 'western',
  'saint', 'st', 'royal', 'metropolitan', 'okanagan', 'scarborough', 'mississauga',
  'humber', 'london', 'kelowna',
])

const contentTokens = (s) => clean(s).split(' ').filter((w) => w && !STOP.has(w))

/**
 * Similarity in 0..1, blending edit distance with token overlap.
 *
 * Token overlap is what catches "Ottawa University" -> "University of Ottawa",
 * where word order differs enough that edit distance alone scores poorly.
 */
export function similarity(a, b) {
  const ca = clean(a)
  const cb = clean(b)
  if (!ca || !cb) return 0
  if (ca === cb) return 1

  const dist = levenshtein(ca, cb)
  const editScore = 1 - dist / Math.max(ca.length, cb.length)

  const ta = new Set(contentTokens(a))
  const tb = new Set(contentTokens(b))
  let overlap = 0
  for (const w of ta) if (tb.has(w)) overlap++

  // Balanced overlap, NOT overlap/min(size). Dividing by the smaller set scores
  // a single shared word as a perfect match, which suggested "New York
  // University" -> york and "Columbia" -> ubc. Those would misattribute a
  // student's record, so unmatched tokens on either side must cost something.
  // Recall is weighted above precision (beta 1.5): a word present in the raw
  // spelling but missing from the candidate is the more dangerous signal.
  let tokenScore = 0
  if (overlap && ta.size && tb.size) {
    const precision = overlap / tb.size
    const recall = overlap / ta.size
    const b2 = 1.5 * 1.5
    tokenScore = ((1 + b2) * precision * recall) / (b2 * precision + recall)
  }

  // Tokens dominate; edit distance only breaks ties and catches single-word
  // typos. It is kept deliberately weak because substring containment
  // ("york university" inside "new york university") scores misleadingly high.
  let score = tokenScore * 0.8 + editScore * 0.2

  // A leftover distinguishing word means a different school, not a variant.
  const unmatched = [...ta].filter((w) => !tb.has(w)).concat([...tb].filter((w) => !ta.has(w)))
  if (unmatched.some((w) => DISTINGUISHERS.has(w))) score = Math.min(score, 0.5)

  // One word matching part of a longer name is ambiguous, not confident:
  // "Columbia" is not UBC, "Humber College" is not Guelph-Humber. An exact
  // alias hit already returned 1 above, so this only affects partial matches.
  if (ta.size === 1 && tb.size > 1) score = Math.min(score, 0.5)

  return Math.max(0, Math.min(1, score))
}

/**
 * Rank candidates against a raw spelling.
 * @param {string} needle
 * @param {{id:string, values:string[]}[]} candidates canonical id + the strings to match against
 * @returns {{id:string, score:number, matched:string}[]} best first
 */
export function bestMatches(needle, candidates, limit = 3) {
  const scored = candidates.map((c) => {
    let best = 0
    let matched = c.values[0] ?? c.id
    for (const v of c.values) {
      const s = similarity(needle, v)
      if (s > best) {
        best = s
        matched = v
      }
    }
    return { id: c.id, score: Math.round(best * 100) / 100, matched }
  })
  return scored.sort((a, b) => b.score - a.score).slice(0, limit)
}
