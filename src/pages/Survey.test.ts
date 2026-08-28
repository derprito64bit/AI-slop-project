import { describe, it, expect } from 'vitest'
import { STEPS, averageError, gradYearOptions, withSkipped } from './Survey'
import { toFilters, type SurveyAnswers } from '../lib/profile'

const answers = (over: Partial<SurveyAnswers> = {}): SurveyAnswers => ({
  field: 'engineering',
  province: 'ON',
  average: 88,
  ambition: 'balanced',
  homeCity: 'Toronto',
  coop: 'yes',
  gradYear: 2027,
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

  it('opens co-op up to both rather than excluding one', () => {
    expect(withSkipped(answers(), 'coop').coop).toBe('')
  })

  it('clears the home city, so no distance is implied', () => {
    expect(withSkipped(answers(), 'homeCity').homeCity).toBe('')
  })

  it('makes a skipped graduating year null, never 0', () => {
    expect(withSkipped(answers(), 'gradYear').gradYear).toBeNull()
  })

  // Courses are not a survey answer — they live on SavedProfile, because the
  // Courses tool owns them. Skipping that step must not disturb the answers.
  it('leaves the answers untouched when the courses step is skipped', () => {
    const before = answers()
    expect(withSkipped(before, 'courses')).toEqual(before)
  })

  it('touches only the question that was skipped', () => {
    const before = answers()
    const after = withSkipped(before, 'field')
    expect(after.province).toBe(before.province)
    expect(after.average).toBe(before.average)
    expect(after.ambition).toBe(before.ambition)
    expect(after.homeCity).toBe(before.homeCity)
    expect(after.coop).toBe(before.coop)
    expect(after.gradYear).toBe(before.gradYear)
  })

  // The guard against the four-place change going wrong. Every key of
  // SurveyAnswers has to be reachable by some step, or that question's answer
  // can never be undone — and a field nothing can clear is usually a field
  // somebody forgot to wire through sync.ts as well.
  it('covers every answer key across the whole step list', () => {
    const full = answers()
    const cleared = STEPS.reduce(withSkipped, full)
    const untouched = (Object.keys(full) as Array<keyof SurveyAnswers>).filter(
      (k) => cleared[k] === full[k],
    )
    // Ambition is the deliberate exception: 'balanced' IS its empty value.
    expect(untouched).toEqual(['ambition'])
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
    expect(filters.coop).toBeUndefined()
    // Still true: a program with no reported median cannot be matched on one.
    expect(filters.withDataOnly).toBe(true)
  })

  it('keeps the ceiling when only the average is given', () => {
    const onlyAverage = withSkipped(withSkipped(answers(), 'field'), 'province')
    expect(toFilters(onlyAverage).medianAtMost).toBe(91)
  })
})

describe('toFilters carries co-op through', () => {
  it('asks for co-op programs only when co-op was chosen', () => {
    expect(toFilters(answers({ coop: 'yes' })).coop).toBe('yes')
    expect(toFilters(answers({ coop: 'no' })).coop).toBe('no')
  })

  it('drops the filter entirely on no preference, rather than excluding both', () => {
    expect(toFilters(answers({ coop: '' })).coop).toBeUndefined()
  })
})

describe('gradYearOptions', () => {
  it('offers this year and the next four', () => {
    expect(gradYearOptions(2026).map((o) => o.value)).toEqual([
      '2026',
      '2027',
      '2028',
      '2029',
      '2030',
    ])
  })
})
