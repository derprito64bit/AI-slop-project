import { describe, expect, it } from 'vitest'
import { parseRequirement, gapFor, COURSES } from './courses'
import { PROGRAM_INFO } from '../data/program-info'

describe('parseRequirement', () => {
  it('reads an explicit code', () => {
    expect(parseRequirement('MCV4U')).toMatchObject({ kind: 'course', code: 'MCV4U' })
  })

  it('reads a course written by name', () => {
    expect(parseRequirement('Advanced Functions')).toMatchObject({ kind: 'course', code: 'MHF4U' })
    expect(parseRequirement('Calculus & Vectors')).toMatchObject({ kind: 'course', code: 'MCV4U' })
  })

  it('treats the many spellings of one course as that course', () => {
    for (const spelling of [
      'English (ENG4U)',
      'English 4U',
      'English 4U (minimum 80%)',
      'Grade 12U English (ENG4U)',
      'English/anglais (ENG4U/EAE4U preferred)',
      'English at 70%',
    ]) {
      expect(parseRequirement(spelling)).toMatchObject({ kind: 'course', code: 'ENG4U' })
    }
  })

  it('does not double-count a course written as both name and code', () => {
    const req = parseRequirement('Calculus and Vectors (MCV4U)')
    expect(req).toMatchObject({ kind: 'course', code: 'MCV4U' })
  })

  it('reads "Two of:" as a choice group', () => {
    const req = parseRequirement('Two of: Biology (SBI4U), Chemistry (SCH4U), Physics (SPH4U)')
    expect(req.kind).toBe('choice')
    if (req.kind === 'choice') {
      expect(req.count).toBe(2)
      expect(req.codes.sort()).toEqual(['SBI4U', 'SCH4U', 'SPH4U'])
    }
  })

  it('reads a bare "A or B" as a choice of one', () => {
    const req = parseRequirement('SCH4U or SPH4U')
    expect(req.kind).toBe('choice')
    if (req.kind === 'choice') {
      expect(req.count).toBe(1)
      expect(req.codes.sort()).toEqual(['SCH4U', 'SPH4U'])
    }
  })

  // The important safety property: a category is never a hard requirement.
  it('treats category phrases as notes, not courses', () => {
    for (const wildcard of [
      'One additional 4U Mathematics course',
      'Two additional 4U/4M courses',
      'Six Grade 12 U/M subjects in total',
      'Any Grade 12 U English',
      'Any 4U Mathematics course',
      '4U Math',
      'A mathematics course for university-bound students',
    ]) {
      expect(parseRequirement(wildcard).kind).toBe('note')
    }
  })

  it('never maps a generic maths phrase onto one specific maths course', () => {
    const req = parseRequirement('Any 4U Mathematics course')
    expect(req.kind).toBe('note')
    expect(JSON.stringify(req)).not.toContain('MHF4U')
  })

  it('falls back to a note rather than guessing', () => {
    expect(parseRequirement('Portfolio review and audition').kind).toBe('note')
  })

  // Every string the researchers actually wrote must survive the parser.
  it('handles every requirement string in the dataset', () => {
    const all = Object.values(PROGRAM_INFO).flatMap((i) => i.requiredCourses ?? [])
    expect(all.length).toBeGreaterThan(200)

    const tally = { course: 0, choice: 0, note: 0 }
    for (const raw of all) {
      const req = parseRequirement(raw)
      expect(['course', 'choice', 'note']).toContain(req.kind)
      // Whatever happens, the original wording is kept so the UI can show it.
      expect(req.text.length).toBeGreaterThan(0)
      tally[req.kind] += 1
    }
    // Most mentions should resolve to something checkable, or the tool is
    // pointless — this guards against a refactor quietly degrading matching.
    expect(tally.course + tally.choice).toBeGreaterThan(all.length * 0.6)
  })
})

describe('gapFor', () => {
  const req = ['English (ENG4U)', 'Advanced Functions (MHF4U)', 'Chemistry (SCH4U)']

  it('returns null when the program has no verified requirements', () => {
    expect(gapFor(undefined, ['ENG4U'])).toBeNull()
    expect(gapFor([], ['ENG4U'])).toBeNull()
  })

  it('lists the specific courses a student is missing', () => {
    const gap = gapFor(req, ['ENG4U'])!
    expect(gap.missing.sort()).toEqual(['MHF4U', 'SCH4U'])
    expect(gap.satisfied).toBe(false)
  })

  it('is satisfied once every specific course is held', () => {
    const gap = gapFor(req, ['ENG4U', 'MHF4U', 'SCH4U'])!
    expect(gap.missing).toEqual([])
    expect(gap.satisfied).toBe(true)
  })

  it('counts a choice group as met once enough options are held', () => {
    const rule = ['Two of: Biology (SBI4U), Chemistry (SCH4U), Physics (SPH4U)']
    expect(gapFor(rule, ['SBI4U'])!.satisfied).toBe(false)
    expect(gapFor(rule, ['SBI4U', 'SPH4U'])!.satisfied).toBe(true)
  })

  it('reports how far along an unmet choice group is', () => {
    const rule = ['Two of: Biology (SBI4U), Chemistry (SCH4U), Physics (SPH4U)']
    expect(gapFor(rule, ['SBI4U'])!.choices[0]).toMatchObject({ count: 2, have: 1 })
  })

  // A program whose requirements are all categories must not read as failed.
  it('never fails a program on category notes alone', () => {
    const gap = gapFor(['One additional 4U Mathematics course'], [])!
    expect(gap.missing).toEqual([])
    expect(gap.satisfied).toBe(true)
    expect(gap.notes).toHaveLength(1)
  })
})

describe('COURSES', () => {
  it('uses well-formed Ontario codes', () => {
    for (const c of COURSES) expect(c.code).toMatch(/^[A-Z]{3}4[UMC]$/)
  })
})
