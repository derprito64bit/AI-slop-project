import { describe, expect, it } from 'vitest'
import { bestNextCourse, choiceKey, listNeeds } from './courseNeeds'
import { PROGRAM_INFO } from '../data/program-info'

/** Requirements by program id, standing in for program-info. */
const from =
  (map: Record<string, string[]>) =>
  (id: string): string[] | undefined =>
    map[id]

const ids = (...names: string[]) => names.map((id) => ({ id }))

describe('choiceKey', () => {
  it('is the same for the same rule written in a different order', () => {
    // The defect this exists for: Requirement.codes follows the order the
    // university wrote them, so one real rule produces two arrays.
    expect(choiceKey(2, ['SCH4U', 'SPH4U', 'SBI4U'])).toBe(
      choiceKey(2, ['SPH4U', 'SCH4U', 'SBI4U']),
    )
  })

  it('separates rules that differ only by how many are needed', () => {
    expect(choiceKey(1, ['SCH4U', 'SPH4U'])).not.toBe(choiceKey(2, ['SCH4U', 'SPH4U']))
  })
})

describe('listNeeds', () => {
  it('counts a course once and names every program that wants it', () => {
    const needs = listNeeds(
      ids('a', 'b', 'c'),
      [],
      from({
        a: ['Chemistry (SCH4U)', 'English (ENG4U)'],
        b: ['Chemistry (SCH4U)'],
        c: ['English (ENG4U)'],
      }),
    )

    expect(needs.missing).toEqual([
      { code: 'ENG4U', programIds: ['a', 'c'] },
      { code: 'SCH4U', programIds: ['a', 'b'] },
    ])
    expect(needs.blocked).toBe(3)
  })

  it('orders missing courses by how many programs want them', () => {
    const needs = listNeeds(
      ids('a', 'b', 'c'),
      [],
      from({
        a: ['Chemistry (SCH4U)'],
        b: ['Chemistry (SCH4U)'],
        c: ['Physics (SPH4U)'],
      }),
    )
    expect(needs.missing.map((m) => m.code)).toEqual(['SCH4U', 'SPH4U'])
    expect(bestNextCourse(needs)?.code).toBe('SCH4U')
  })

  it('merges the same choice rule from two programs into one row', () => {
    // Written in a different order by each university, which is exactly how the
    // dataset has it — see the two "Two of:" science strings in program-info.
    const needs = listNeeds(
      ids('a', 'b'),
      ['SBI4U'],
      from({
        a: ['Two of: Biology (SBI4U), Chemistry (SCH4U), Physics (SPH4U)'],
        b: ['Two of: Physics (SPH4U), Chemistry (SCH4U) or Biology (SBI4U)'],
      }),
    )

    expect(needs.choices).toHaveLength(1)
    expect(needs.choices[0].programIds).toEqual(['a', 'b'])
    expect(needs.choices[0].codes).toEqual(['SBI4U', 'SCH4U', 'SPH4U'])
    expect(needs.choices[0].have).toBe(1)
  })

  it('splits verified programs into blocked and covered, and counts the rest', () => {
    const needs = listNeeds(
      ids('blocked', 'covered', 'unknown'),
      ['ENG4U'],
      from({ blocked: ['Chemistry (SCH4U)'], covered: ['English (ENG4U)'] }),
    )
    expect(needs).toMatchObject({ blocked: 1, covered: 1, unverified: 1 })
  })

  it('counts a category-only program as covered without calling the list clear', () => {
    // western::medical-science really is shaped like this. The parser refuses to
    // turn "Any Grade 12 U English" into a hard requirement, so the program is
    // satisfied for a student with nothing ticked — and the summary must not
    // read that as a clean bill of health for the list.
    const needs = listNeeds(
      ids('category', 'real'),
      [],
      from({ category: ['Any Grade 12 U English'], real: ['Chemistry (SCH4U)'] }),
    )
    expect(needs.covered).toBe(1)
    expect(needs.missing.map((m) => m.code)).toEqual(['SCH4U'])
  })

  it('reports which required courses are already held', () => {
    const needs = listNeeds(
      ids('a'),
      ['ENG4U', 'MHF4U'],
      from({ a: ['English (ENG4U)', 'Advanced Functions (MHF4U)', 'Chemistry (SCH4U)'] }),
    )
    expect(needs.requiredCodes).toEqual(['ENG4U', 'MHF4U', 'SCH4U'])
    expect(needs.heldCodes).toEqual(['ENG4U', 'MHF4U'])
  })

  it('finds a ticked course nothing on the list asks for', () => {
    const needs = listNeeds(ids('a'), ['ENG4U', 'MDM4U'], from({ a: ['English (ENG4U)'] }))
    expect(needs.unused).toEqual(['MDM4U'])
  })

  it('does not count a course that satisfies a choice group as unused', () => {
    const needs = listNeeds(
      ids('a'),
      ['SBI4U', 'SCH4U'],
      from({ a: ['Two of: Biology (SBI4U), Chemistry (SCH4U), Physics (SPH4U)'] }),
    )
    expect(needs.choices).toHaveLength(0)
    expect(needs.unused).toEqual([])
  })

  it('claims nothing is unused when nothing on the list is verified', () => {
    // With no requirements read, "no program wants MDM4U" is not something we
    // know — and a checklist that says it anyway has invented a fact.
    const needs = listNeeds(ids('a', 'b'), ['MDM4U'], from({}))
    expect(needs.unverified).toBe(2)
    expect(needs.unused).toEqual([])
  })

  it('is empty for an empty list', () => {
    const needs = listNeeds([], ['ENG4U'], from({}))
    expect(needs).toMatchObject({ blocked: 0, covered: 0, unverified: 0 })
    expect(needs.missing).toEqual([])
    expect(needs.unused).toEqual([])
  })

  it('never surfaces a recommended course as missing', () => {
    // The rule CLAUDE.md names by name, and the one with no test anywhere until
    // now. It is enforced only by gapFor taking a single list — nothing stops a
    // future call site passing the recommended one too. A student who drops a
    // required course because a recommendation looked like one loses a year.
    const withRecommended = Object.values(PROGRAM_INFO).filter(
      (info) => info.recommendedCourses?.length,
    )
    expect(withRecommended.length).toBeGreaterThan(0)

    for (const info of withRecommended) {
      const needs = listNeeds([{ id: info.programId }], [])
      const surfaced = [
        ...needs.missing.map((m) => m.code),
        ...needs.choices.flatMap((c) => c.codes),
      ]
      for (const recommended of info.recommendedCourses ?? []) {
        // Only meaningful when the recommendation names a course the parser can
        // resolve — a prose recommendation cannot be confused for a gap anyway.
        const codes = recommended.match(/\b([A-Z]{3}[34][UMC])\b/g) ?? []
        for (const code of codes) {
          const alsoRequired = (info.requiredCourses ?? []).some((r) => r.includes(code))
          if (!alsoRequired) expect(surfaced).not.toContain(code)
        }
      }
    }
  })
})
