import { describe, expect, it } from 'vitest'
import { STEPS, stepIndexFromParam } from './surveySteps'

describe('stepIndexFromParam', () => {
  it('opens the question the id names', () => {
    // The link this exists for: BalanceView asks for an average and sends the
    // student to /survey?step=average. Landing on question one instead means
    // walking through four already-answered questions to reach it.
    expect(stepIndexFromParam('average')).toBe(STEPS.indexOf('average'))
    expect(stepIndexFromParam('field')).toBe(0)
    expect(stepIndexFromParam('ambition')).toBe(STEPS.length - 1)
  })

  it('falls back to the first question for an id that is not a step', () => {
    expect(stepIndexFromParam('marks')).toBe(0)
    expect(stepIndexFromParam('Average')).toBe(0)
  })

  it('treats an empty value and a missing param the same way', () => {
    expect(stepIndexFromParam('')).toBe(0)
    expect(stepIndexFromParam(null)).toBe(0)
    expect(stepIndexFromParam(undefined)).toBe(0)
  })

  it('rejects a number, rather than reading it as an index', () => {
    // `?step=4` would work by accident today and silently point somewhere else
    // the next time a question is added. `?step=99` is worse: STEPS[99] is
    // undefined, so the card renders with no question in it at all.
    expect(stepIndexFromParam('4')).toBe(0)
    expect(stepIndexFromParam('0')).toBe(0)
    expect(stepIndexFromParam('99')).toBe(0)
    expect(stepIndexFromParam('-1')).toBe(0)
  })

  it('never points past the end of STEPS', () => {
    for (const raw of ['average', 'nonsense', '', '7', 'courses']) {
      const i = stepIndexFromParam(raw)
      expect(STEPS[i]).toBeDefined()
    }
  })
})
