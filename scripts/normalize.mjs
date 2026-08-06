// Pure normalization rules for the community admission spreadsheets.
// Kept dependency-free and side-effect free so they can be unit tested
// directly against the messy values found in the real sheets.

import { ALIAS_TO_ID } from './universities-map.mjs'

/** Averages outside this band are treated as data-entry errors. */
export const MIN_AVERAGE = 40
export const MAX_AVERAGE = 100

/**
 * Averages arrive as percentages ("92", "94.8") in some sheets and as
 * fractions ("0.86", "0.96") in others, with junk like "11111" and "0" mixed in.
 * @returns {{ value: number|null, reason?: string }}
 */
export function normalizeAverage(raw) {
  if (raw === null || raw === undefined) return { value: null, reason: 'missing' }
  const text = String(raw).trim().replace(/%$/, '')
  if (!text) return { value: null, reason: 'missing' }

  const n = Number(text)
  if (!Number.isFinite(n)) return { value: null, reason: 'not-a-number' }

  // Fraction form: 0.86 -> 86. (0 stays 0 and is rejected below.)
  const scaled = n > 0 && n <= 1 ? n * 100 : n

  if (scaled < MIN_AVERAGE || scaled > MAX_AVERAGE) {
    return { value: null, reason: `out-of-range (${scaled})` }
  }
  return { value: Math.round(scaled * 10) / 10 }
}

/**
 * Decisions appear as Offer/Accepted/accepted/accepeted(typo)/
 * "Accepted (conditional)"/Rejected/Waitlisted/Deferred.
 * @returns {'offer'|'rejected'|'waitlisted'|'deferred'|null}
 */
export function normalizeDecision(raw) {
  if (!raw) return null
  const t = String(raw).toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return null
  // Check rejection/waitlist/deferral first — "waitlisted then accepted" should
  // not silently count as a clean offer.
  if (t.includes('reject') || t.includes('decline') || t.includes('denied')) return 'rejected'
  if (t.includes('waitlist') || t.includes('wait list')) return 'waitlisted'
  if (t.includes('defer')) return 'deferred'
  if (t.includes('offer') || t.startsWith('accept') || t.includes('accepted') || t.includes('accepeted')) {
    return 'offer'
  }
  return null
}

/** Excel serial date -> ISO yyyy-mm-dd. Excel's epoch is 1899-12-30. */
export function excelSerialToISO(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0 || n > 80000) return null
  const ms = Math.round(n * 86400000) + Date.UTC(1899, 11, 30)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/**
 * Normalized lookup key for a university spelling. Exported so that
 * hand-written aliases in data/overrides.json get keyed exactly the same way
 * as the values coming out of the spreadsheets.
 */
export function aliasKey(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[‘’']/g, '') // curly + straight apostrophes
    .replace(/[.,!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Canonical university id, or null when the spelling isn't recognised.
 * @param extraAliases optional key->id map layered over the built-in aliases
 *        (this is how data/overrides.json resolves spellings without a code change)
 */
export function canonicalUniversityId(raw, extraAliases = null) {
  const key = aliasKey(raw)
  if (!key) return null
  if (extraAliases && key in extraAliases) return extraAliases[key]
  return ALIAS_TO_ID[key] ?? null
}

/**
 * Program names are free text and often repeat the university
 * ("Brock University - BSc Honours: Computer Science").
 */
export function normalizeProgram(raw, universityName) {
  if (!raw) return null
  let t = String(raw).replace(/\s+/g, ' ').trim()
  if (!t) return null

  // Strip a leading "<University> -" / "<University>:" prefix.
  if (universityName) {
    const esc = universityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(`^${esc}\\s*[-–—:]\\s*`, 'i'), '').trim()
  }
  t = t.replace(/^[-–—:,]\s*/, '').replace(/[-–—:,]\s*$/, '').trim()

  // Entries that are clearly not programs.
  if (t.length < 2) return null
  if (/^(n\/?a|none|null|-+|\.+|\d+(\.\d+)?)$/i.test(t)) return null

  // Shouty all-caps entries -> Title Case; otherwise keep the author's casing
  // so things like "BSc", "PhD", "iBBA" survive intact.
  if (t === t.toUpperCase() && /[A-Z]{4,}/.test(t)) {
    t = t
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
  }
  return t
}

/**
 * Stable key for grouping program variants that differ only cosmetically —
 * e.g. "Health Sciences" and "Health science" must land on the same key.
 * Trailing plurals are stripped per word; this only ever produces a grouping
 * key (never displayed), so over-stemming is harmless as long as it's
 * consistent. Genuinely different programs ("Engineering I" vs
 * "Engineering I (Co-op)") still keep distinct keys.
 */
export function programSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join('-')
}

// Coarse subject grouping so Explore can filter by area of study. Order
// matters: the first matching rule wins, so put specific before general.
// NOTE: these patterns anchor on a leading \b only. A trailing \b would break
// every stem-style rule — "health sci" would fail to match "Health Sciences"
// because "sci" is followed by a word character. Where a term must not match
// longer words, the \b is placed inside the alternation instead.
const FIELD_RULES = [
  ['engineering', /\b(?:engineering|mechatronic|software eng|nanotech)/i],
  ['computer-science', /\b(?:computer sci|computing|comp sci|cs\b|informatics|data science|artificial intelligence)/i],
  ['health', /\b(?:nursing|health sci|kinesiolog|medical sci|midwifery|pharmac|dental|paramedic|physiotherap|rehab)/i],
  ['life-sciences', /\b(?:life sci|biolog|biochem|biomed|neurosci|genetic|microbiolog|zoolog|physiolog)/i],
  ['business', /\b(?:business|commerce|bba\b|ibba\b|accounting|finance|management|marketing|economic)/i],
  ['physical-sciences', /\b(?:physic|chemistr|astronom|earth sci|geolog|environmental sci|math|statistic|actuarial)/i],
  ['social-sciences', /\b(?:psycholog|sociolog|political|criminolog|anthropolog|social work|geograph|international relations)/i],
  ['arts-humanities', /\b(?:art\b|arts\b|english|histor|philosoph|language|music|theatre|drama|fine art|design|media|journalism|communication)/i],
  ['education', /\b(?:education|teaching|concurrent educ)/i],
  ['law', /\b(?:law\b|legal studies|justice)/i],
  ['agriculture', /\b(?:agricultur|food sci|animal sci|veterinar)/i],
  ['architecture', /\b(?:architect|urban plan)/i],
]

/** @returns {string} a field id, or 'other' when nothing matches. */
export function inferField(programName) {
  const t = String(programName || '')
  for (const [id, re] of FIELD_RULES) {
    if (re.test(t)) return id
  }
  return 'other'
}

export const FIELDS = FIELD_RULES.map(([id]) => id).concat('other')

/** Linear-interpolated percentile over an unsorted numeric array. */
export function percentile(values, p) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  if (s.length === 1) return s[0]
  const idx = (s.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const val = lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo)
  return Math.round(val * 10) / 10
}
