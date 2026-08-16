import { describe, it, expect } from 'vitest'
import { STEPS, averageError, withSkipped } from './Survey'
import { toFilters, type SurveyAnswers } from '../lib/profile'

const answers = (over: Partial<SurveyAnswers> = {}): SurveyAnswers => ({
  field: 'engineering',
  province: 'ON',
  average: 88,
  ambition: 'balanced',
  ...over,
})

describe('averageError', () => {
  it('accepts a blank box — that is a skip, not a mistake', () => {
    expect(averageError('')).toBeUndefined()
    expect(averageError('   ')).toBeUndefined()
  })

  it('accepts a plausible average', () => {
    expect(averageError('88')).toBeUndefined()
    expect(averageError('40')).toBeUndefined()
    expect(averageError('100')).toBeUndefined()
  })

  it('catches the typos that would produce a nonsense shortlist', () => {
    expect(averageError('8')).toBeDefined()
    expect(averageError('880')).toBeDefined()
    expect(averageError('-5')).toBeDefined()
    expect(averageError('eighty')).toBeDefined()
  })
})

describe('withSkipped', () => {
  it('clears the field so no subject filter is applied', () => {
    expect(withSkipped(answers(), 'field').field).toBe('')
  })

  it('opens province up to anywhere rather than leaving it on Ontario', () => {
    expect(withSkipped(answers(), 'province').province).toBe('')
  })

  it('makes a skipped average null, never 0', () => {
    expect(withSkipped(answers(), 'average').average).toBeNull()
  })

  it('leaves ambition at balanced — it is a view setting, not a fact', () => {
    expect(withSkipped(answers({ ambition: 'reach' }), 'ambition').ambition).toBe('balanced')
  })

  it('touches only the question that was skipped', () => {
    const before = answers()
    const after = withSkipped(before, 'field')
    expect(after.province).toBe(before.province)
    expect(after.average).toBe(before.average)
    expect(after.ambition).toBe(before.ambition)
  })

  it('handles every step, so no question can be unskippable', () => {
    for (const step of STEPS) {
      expect(() => withSkipped(answers(), step)).not.toThrow()
    }
  })
})

describe('skipping everything', () => {
  // The failure this guards against: a skipped average used to arrive as 0,
  // and `medianAtMost: 0 + 3` asks for programs whose admitted median was at
  // most 3% — which is every program filtered out, presented as "no matches".
  it('widens the shortlist instead of emptying it', () => {
    const skippedAll = STEPS.reduce(withSkipped, answers())
    const filters = toFilters(skippedAll)
    expect(filters.medianAtMost).toBeUndefined()
    expect(filters.field).toBeUndefined()
    expect(filters.province).toBeUndefined()
    // Still true: a program with no reported median cannot be matched on one.
    expect(filters.withDataOnly).toBe(true)
  })

  it('keeps the ceiling when only the average is given', () => {
    const onlyAverage = withSkipped(withSkipped(answers(), 'field'), 'province')
    expect(toFilters(onlyAverage).medianAtMost).toBe(91)
  })
})
