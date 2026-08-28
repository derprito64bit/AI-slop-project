import { describe, it, expect } from 'vitest'
import { catalogueTotals, featuredCards, startSteps } from './overview'
import { COURSES } from './courses'
import { EMPTY_PROFILE, type SavedProfile, type SurveyAnswers } from './profile'
import PROGRAMS from '../data/generated/programs.json'
import type { Program } from '../data/types'

const profile = (over: Partial<SavedProfile> = {}): SavedProfile => ({
  ...EMPTY_PROFILE,
  savedAt: '2026-08-28T00:00:00.000Z',
  ...over,
})

/** Every question skipped, but walked through — a real answers object. */
const skippedAnswers: SurveyAnswers = {
  field: '',
  province: '',
  average: null,
  ambition: 'balanced',
  homeCity: '',
  coop: '',
  gradYear: null,
}

describe('startSteps', () => {
  it('starts a fresh profile at none of three done', () => {
    const steps = startSteps(profile())
    expect(steps.map((s) => s.key)).toEqual(['answers', 'kept', 'courses'])
    expect(steps.every((s) => !s.done)).toBe(true)
    expect(steps.map((s) => s.value)).toEqual(['Not yet', '0 of 1', 'none ticked yet'])
  })

  it('ticks the questions when they were walked through and skipped', () => {
    // Skipping every question still finishes the survey and writes an answers
    // object. That student did the step, and a checklist that refused to tick
    // until they gave up an average would be nagging for the one number the
    // site is most careful about.
    expect(startSteps(profile({ answers: skippedAnswers }))[0].done).toBe(true)
  })

  it('leaves the questions unticked when the survey was abandoned', () => {
    // 'Skip all — just let me browse' stores answers: null. That student did
    // not answer them, and the path should say so.
    expect(startSteps(profile({ answers: null }))[0].done).toBe(false)
  })

  it('counts one kept program as the whole step', () => {
    const [, kept] = startSteps(profile({ shortlist: ['waterloo::computer-science'] }))
    expect(kept.done).toBe(true)
    expect(kept.value).toBe('1 of 1')
  })

  it('does not let a long shortlist read as more than one of one', () => {
    const [, kept] = startSteps(profile({ shortlist: ['a', 'b', 'c'] }))
    expect(kept.value).toBe('1 of 1')
  })

  it('is done at the first course ticked, not the ninth', () => {
    // Nine is the length of the list, not a target: nobody takes all of ENG4U
    // through SES4U, so a step requiring the full set could never complete.
    const [, , courses] = startSteps(profile({ courses: ['ENG4U'] }))
    expect(courses.done).toBe(true)
    expect(courses.value).toBe('1 ticked')
  })

  it('counts only codes the course list knows, so it can never exceed the total', () => {
    const [, , courses] = startSteps(
      profile({ courses: [...COURSES.map((c) => c.code), 'XYZ4U', 'ABC4U'] }),
    )
    expect(courses.value).toBe(`${COURSES.length} ticked`)
  })

  it('never states a denominator the student cannot reach', () => {
    // "0 of 9" implied a target nobody hits — nine is the length of the pick
    // list, not a goal — and it contradicted the tick, which goes green at one.
    for (const courses of [[], ['ENG4U'], ['ENG4U', 'MHF4U']]) {
      const [, , step] = startSteps(profile({ courses }))
      expect(step.value).not.toMatch(/ of /)
    }
  })

  it('links every step at an absolute path', () => {
    // A relative link from /profile resolves under it and lands on a non-route.
    for (const s of startSteps(profile())) expect(s.to.startsWith('/')).toBe(true)
  })

  it('never says anything that reads as a probability', () => {
    for (const s of startSteps(profile())) {
      expect(`${s.label} ${s.value}`).not.toMatch(/\bodds\b|\bchance\b|\blikely\b|probab/i)
    }
  })
})

describe('featuredCards', () => {
  const cards = featuredCards()

  it('carries the six featured programs with their ids attached', () => {
    expect(cards).toHaveLength(6)
    for (const c of cards) expect(c.id).toBe(`${c.universityId}::${c.slug}`)
  })

  it('names one program per school', () => {
    // build-data.mjs dedupes by university, and the copy on the page says so.
    expect(new Set(cards.map((c) => c.universityId)).size).toBe(cards.length)
  })

  it('builds ids that actually resolve in the catalogue', () => {
    // The failure this guards against is silent: localStorage accepts any
    // string, so a wrong id becomes a shortlist entry that never resolves in
    // byId and simply never appears on the dashboard.
    const known = new Set((PROGRAMS as Program[]).map((p) => p.id))
    for (const c of cards) expect(known.has(c.id)).toBe(true)
  })
})

describe('catalogueTotals', () => {
  it('reports the dataset, not a hand-typed figure', () => {
    const t = catalogueTotals()
    expect(t.programs).toBe((PROGRAMS as Program[]).length)
    expect(t.programsWithCharts).toBeLessThanOrEqual(t.programs)
    expect(t.reports).toBeGreaterThan(t.programs)
    expect(t.universities).toBeGreaterThan(0)
  })
})
