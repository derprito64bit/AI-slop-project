import { describe, it, expect } from 'vitest'
import { levenshtein, similarity, bestMatches } from './similarity.mjs'
import { UNIVERSITIES } from './universities-map.mjs'

const candidates = UNIVERSITIES.map((u) => ({ id: u.id, values: [u.name, ...u.aliases] }))
const topId = (raw) => bestMatches(raw, candidates, 1)[0]?.id
const topScore = (raw) => bestMatches(raw, candidates, 1)[0]?.score ?? 0

/** Matches the SUGGEST_CONFIDENT threshold in build-data.mjs. */
const CONFIDENT = 0.6

describe('levenshtein', () => {
  it('measures edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('same', 'same')).toBe(0)
    expect(levenshtein('', 'abc')).toBe(3)
  })
})

describe('similarity', () => {
  it('scores identical strings as 1', () => {
    expect(similarity('Waterloo', 'waterloo')).toBe(1)
  })

  it('scores word-order variants highly', () => {
    expect(similarity('Ottawa University', 'University of Ottawa')).toBeGreaterThan(CONFIDENT)
  })

  it('scores typos highly', () => {
    expect(similarity('Wilfrid Laurier Univesity', 'Wilfrid Laurier University')).toBeGreaterThan(CONFIDENT)
  })

  it('scores unrelated names low', () => {
    expect(similarity('Waterloo', 'McGill University')).toBeLessThan(0.3)
  })

  // Regression: dividing overlap by the SMALLER token set scored a single
  // shared word as a perfect match, so these all came back confident. Each of
  // these is a genuinely different institution that shares a word with a
  // Canadian school, and confidently mapping one would misattribute records.
  it('does not treat one shared word as a match', () => {
    expect(similarity('New York University', 'York University')).toBeLessThan(CONFIDENT)
    expect(similarity('Columbia', 'University of British Columbia')).toBeLessThan(CONFIDENT)
    expect(similarity("King's College London", "University of King's College")).toBeLessThan(CONFIDENT)
    expect(similarity('Humber College', 'University of Guelph-Humber')).toBeLessThan(CONFIDENT)
  })

  it('still scores exact alias hits as perfect', () => {
    expect(similarity('waterloo', 'Waterloo')).toBe(1)
    expect(similarity('TMU', 'tmu')).toBe(1)
  })
})

describe('bestMatches against the real canonical list', () => {
  it('resolves genuine variants', () => {
    expect(topId('Ottawa University')).toBe('ottawa')
    expect(topId('University Of Waterloo')).toBe('waterloo')
    expect(topId('Queens University')).toBe('queens')
  })

  // These are real values from the source sheets that must NOT be confidently
  // mapped onto a Canadian school — mislabelling a record is worse than
  // leaving it unmapped for a human.
  it('is not confident about other schools that share a word', () => {
    for (const raw of ['New York University', 'Columbia', "King's College London", 'Humber college']) {
      expect(topScore(raw)).toBeLessThan(CONFIDENT)
    }
  })

  it('returns ranked results', () => {
    const m = bestMatches('University of Waterloo', candidates, 3)
    expect(m).toHaveLength(3)
    expect(m[0].score).toBeGreaterThanOrEqual(m[1].score)
  })
})
