import { gapFor, parseRequirement } from './courses'
import { getProgramInfo } from '../data/program-info'

// What the WHOLE LIST needs, rather than what one program is missing.
//
// `gapFor` answers "is this program blocked", once per program, and every view
// that wanted a list-level answer re-asked it and then rendered the same
// sentence again on each card. A student choosing next semester's timetable is
// not asking about one program — they are asking which single course clears the
// most doors, and whether the course they already ticked is doing anything.
//
// BUILT ON gapFor, NOT BESIDE IT. There is one requirement parser and it stays
// that way: a second implementation that disagreed about a choice group would be
// worse than no aggregate at all.
//
// IT MUST LEAD WITH WHAT IT DOES NOT KNOW. 74 of 2,436 programs have researched
// requirements, so most shortlists are mostly unverified — `unverified` is
// returned beside the counts it can speak for, and "nothing missing" is never
// the same claim as "you are clear". One live example of why: the only
// requirement recorded for western::medical-science is "Any Grade 12 U English",
// which the parser deliberately treats as a note it cannot check, so that
// program is `satisfied` for a student with no courses ticked at all.

/**
 * A stable id for a choice rule, so the same rule from two programs is one row.
 *
 * `Requirement.codes` follows the order the university wrote them, so
 * "Two of: Biology, Chemistry, or Physics" and "Two of: Physics, Chemistry or
 * Biology" are the same rule and two different arrays. courses.test.ts already
 * sorts before asserting, which is that test conceding the problem. Without a
 * canonical key the same rule renders twice and "3 of your programs want this"
 * cannot be counted at all.
 */
export function choiceKey(count: number, codes: string[]): string {
  return `${count}:${[...codes].sort().join(',')}`
}

export type MissingCourse = {
  code: string
  /** ids of the kept programs that require it */
  programIds: string[]
}

export type MissingChoice = {
  key: string
  count: number
  /** sorted, so two programs with the same rule read identically */
  codes: string[]
  /** how many of `codes` the student already holds */
  have: number
  programIds: string[]
}

export type ListNeeds = {
  /** required courses the student lacks, most-demanded first */
  missing: MissingCourse[]
  /** unmet choice groups, deduped */
  choices: MissingChoice[]
  /** every named course the list requires, held or not */
  requiredCodes: string[]
  /** of `requiredCodes`, the ones the student has */
  heldCodes: string[]
  /**
   * Ticked courses that no VERIFIED program on the list asks for.
   *
   * Empty when nothing on the list is verified — with no requirements read, a
   * course being "unused" is not something we know, and saying so would be the
   * checklist inventing a fact.
   */
  unused: string[]
  /** programs with at least one outstanding requirement */
  blocked: number
  /** programs whose requirements are all met */
  covered: number
  /** programs whose requirements have not been researched */
  unverified: number
}

/**
 * Roll the kept programs up into one answer.
 *
 * `requirementsFor` is injectable so this stays a pure function the node-only
 * test runner can reach without standing up the whole data module.
 */
export function listNeeds(
  programs: Array<{ id: string }>,
  taking: string[],
  requirementsFor: (id: string) => string[] | undefined = (id) =>
    getProgramInfo(id)?.requiredCourses,
): ListNeeds {
  const have = new Set(taking)

  const missing = new Map<string, string[]>()
  const choices = new Map<string, MissingChoice>()
  const required = new Set<string>()
  /** every code any requirement so much as mentions — what makes a tick "used" */
  const wanted = new Set<string>()

  let blocked = 0
  let covered = 0
  let unverified = 0

  for (const program of programs) {
    const raw = requirementsFor(program.id)
    const gap = gapFor(raw, taking)

    if (!gap) {
      unverified += 1
      continue
    }
    if (gap.satisfied) covered += 1
    else blocked += 1

    // Parsed a second time only to learn what the list requires in TOTAL —
    // gapFor reports what is outstanding, and a course the student already holds
    // is correctly absent from that. "3 of the 4 your list needs" needs the 4.
    for (const text of raw ?? []) {
      const req = parseRequirement(text)
      if (req.kind === 'course') {
        required.add(req.code)
        wanted.add(req.code)
      } else if (req.kind === 'choice') {
        for (const code of req.codes) wanted.add(code)
      }
    }

    for (const code of gap.missing) {
      const list = missing.get(code)
      if (list) list.push(program.id)
      else missing.set(code, [program.id])
    }

    for (const choice of gap.choices) {
      const key = choiceKey(choice.count, choice.codes)
      const row = choices.get(key)
      if (row) row.programIds.push(program.id)
      else {
        choices.set(key, {
          key,
          count: choice.count,
          codes: [...choice.codes].sort(),
          // `have` depends only on the codes and what the student holds, so it
          // is identical for every program sharing this key.
          have: choice.have,
          programIds: [program.id],
        })
      }
    }
  }

  const anyVerified = blocked + covered > 0

  return {
    missing: [...missing.entries()]
      .map(([code, programIds]) => ({ code, programIds }))
      // Most-demanded first — that is the course worth adding. Ties broken by
      // code so the order is stable rather than insertion-dependent.
      .sort((a, b) => b.programIds.length - a.programIds.length || a.code.localeCompare(b.code)),
    choices: [...choices.values()].sort(
      (a, b) => b.programIds.length - a.programIds.length || a.key.localeCompare(b.key),
    ),
    requiredCodes: [...required].sort(),
    heldCodes: [...required].filter((c) => have.has(c)).sort(),
    unused: anyVerified ? taking.filter((c) => !wanted.has(c)).sort() : [],
    blocked,
    covered,
    unverified,
  }
}

/**
 * The single course that would clear the most programs, if there is one.
 *
 * Only ever a named requirement — never an option from a choice group, because
 * "add one of these three" is the student's call and picking for them would be
 * advice this site is not in a position to give.
 */
export function bestNextCourse(needs: ListNeeds): MissingCourse | null {
  return needs.missing[0] ?? null
}
