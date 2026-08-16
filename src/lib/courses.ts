// Ontario course requirements: turning the researched free text into something
// a checklist can reason about.
//
// `program-info.ts` records requirements exactly as each university words them,
// which is right for provenance and useless for comparison: 69 distinct strings
// describe about ten real courses. "English (ENG4U)", "English 4U", "Any Grade
// 12 U English" and "Grade 12 U English/anglais (ENG4U/EAE4U preferred)" are
// one course.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: never tell a student they are missing
// something unless we are sure. Anything this parser cannot confidently resolve
// becomes a note showing the university's original wording — it is never
// counted as a gap. Being unhelpful is recoverable; telling someone they are
// short a prerequisite they actually hold is not.

/** The Grade 12 courses students pick from. Codes are Ontario's. */
export const COURSES: Array<{ code: string; name: string }> = [
  { code: 'ENG4U', name: 'English' },
  { code: 'MHF4U', name: 'Advanced Functions' },
  { code: 'MCV4U', name: 'Calculus and Vectors' },
  { code: 'MDM4U', name: 'Mathematics of Data Management' },
  { code: 'SCH4U', name: 'Chemistry' },
  { code: 'SPH4U', name: 'Physics' },
  { code: 'SBI4U', name: 'Biology' },
  { code: 'ICS4U', name: 'Computer and Information Science' },
  { code: 'SES4U', name: 'Earth and Space Science' },
]

const CODES = new Set(COURSES.map((c) => c.code))
export const COURSE_NAMES: Record<string, string> = Object.fromEntries(
  COURSES.map((c) => [c.code, c.name]),
)

/**
 * Name fragments that identify a specific course.
 *
 * Deliberately does NOT include a bare "math" — "any 4U Mathematics course"
 * means any of four maths, not Advanced Functions, and mapping it to one would
 * invent a requirement. Those are caught as wildcards before this runs.
 */
const NAME_TO_CODE: Array<[RegExp, string]> = [
  [/advanced function/i, 'MHF4U'],
  [/calculus/i, 'MCV4U'],
  [/data management/i, 'MDM4U'],
  [/chemistry/i, 'SCH4U'],
  [/physics/i, 'SPH4U'],
  [/biology/i, 'SBI4U'],
  [/english|anglais/i, 'ENG4U'],
  [/computer and information/i, 'ICS4U'],
  [/earth and space/i, 'SES4U'],
]

/** Phrases that describe a *category* of course rather than a named one. */
const WILDCARD = [
  /^one (additional|other)/i,
  /^two (additional|other)/i,
  /^six /i,
  /^any /i,
  /^a mathematics course/i,
  /^\d?\s*4u math/i,
  /subjects in total/i,
  /^grade 11/i,
]

export type Requirement =
  /** a specific course the student either has or does not */
  | { kind: 'course'; code: string; text: string }
  /** pick `count` from `codes` — satisfied once enough are held */
  | { kind: 'choice'; count: number; codes: string[]; text: string }
  /** a category ("one additional 4U math"); shown, never counted as missing */
  | { kind: 'note'; text: string }

/** Pull every course code out of a string, by code or by name. */
function codesIn(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(/\b([A-Z]{3}[34][UMC])\b/g)) {
    if (CODES.has(m[1])) found.add(m[1])
  }
  // Only fall back to names when no code was written — a string like
  // "Calculus and Vectors (MCV4U)" must not count twice.
  if (found.size === 0) {
    for (const [re, code] of NAME_TO_CODE) {
      if (re.test(text)) found.add(code)
    }
  }
  return [...found]
}

/**
 * Parse one researched requirement string.
 *
 * Order matters: choice groups and category phrases are recognised before any
 * attempt to pin the string to a single course, because both contain course
 * names that would otherwise be read as a hard requirement.
 */
export function parseRequirement(raw: string): Requirement {
  const text = raw.trim()

  // "Two of: A, B, C" / "One of: A, B or C"
  const group = /^(one|two|three)\s+of\s*:?\s*(.+)$/i.exec(text)
  if (group) {
    const count = { one: 1, two: 2, three: 3 }[group[1].toLowerCase()] ?? 1
    const codes = codesIn(group[2])
    // A group we cannot resolve into two or more options is not a group we can
    // check — show it and move on.
    if (codes.length >= count && codes.length > 1) {
      return { kind: 'choice', count, codes, text }
    }
    return { kind: 'note', text }
  }

  if (WILDCARD.some((re) => re.test(text))) return { kind: 'note', text }

  // "A or B" without a leading "One of:"
  if (/\bor\b/i.test(text)) {
    const codes = codesIn(text)
    if (codes.length > 1) return { kind: 'choice', count: 1, codes, text }
  }

  const codes = codesIn(text)
  if (codes.length === 1) return { kind: 'course', code: codes[0], text }

  // More than one course named with no "or" between them, or nothing
  // recognised at all — either way, do not guess.
  return { kind: 'note', text }
}

export type Gap = {
  /** specific courses the student does not have */
  missing: string[]
  /** choice groups not yet satisfied */
  choices: Array<{ count: number; codes: string[]; have: number }>
  /** requirements shown for information only */
  notes: string[]
  /** true when nothing specific is outstanding */
  satisfied: boolean
}

/**
 * Compare a program's requirements against the courses a student is taking.
 *
 * `satisfied` ignores notes on purpose: a category like "one additional 4U
 * course" cannot be verified from a checkbox list, so counting it as
 * outstanding would leave every program permanently red.
 */
export function gapFor(required: string[] | undefined, taking: string[]): Gap | null {
  if (!required?.length) return null

  const have = new Set(taking)
  const gap: Gap = { missing: [], choices: [], notes: [], satisfied: true }

  for (const raw of required) {
    const req = parseRequirement(raw)
    if (req.kind === 'course') {
      if (!have.has(req.code)) gap.missing.push(req.code)
    } else if (req.kind === 'choice') {
      const held = req.codes.filter((c) => have.has(c)).length
      if (held < req.count) gap.choices.push({ count: req.count, codes: req.codes, have: held })
    } else {
      gap.notes.push(req.text)
    }
  }

  gap.satisfied = gap.missing.length === 0 && gap.choices.length === 0
  return gap
}
