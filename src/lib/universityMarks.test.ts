import { describe, expect, it } from 'vitest'
import UNIVERSITIES from '../data/generated/universities.json'
import { BANNERS, bannerFor, initialsFor, toneFor } from './universityMarks'
import type { University } from '../data/types'

const unis = UNIVERSITIES as University[]

describe('initialsFor', () => {
  it('skips the words that carry no identity', () => {
    expect(initialsFor('University of Waterloo')).toBe('WA')
    expect(initialsFor('Toronto Metropolitan University')).toBe('TM')
    expect(initialsFor('University of British Columbia')).toBe('BC')
  })

  it("keeps Queen's as one word", () => {
    // Splitting on the apostrophe would give QS. The replace runs before the
    // split for exactly this.
    expect(initialsFor("Queen's University")).toBe('QU')
  })

  it('falls back sensibly when there is little to work with', () => {
    expect(initialsFor('Waterloo')).toBe('WA')
    expect(initialsFor('University')).toBe('UN')
    expect(initialsFor('of the')).toBe('OF')
  })

  it('always returns exactly two characters for a real school', () => {
    // The monogram tile is a fixed square with fontSize: size * 0.36, so a
    // third character overflows it. Nothing in the component catches that,
    // which is why this is asserted over the whole dataset rather than over a
    // handful of examples.
    for (const u of unis) {
      const initials = initialsFor(u.name)
      expect(initials, `${u.id}: ${u.name} -> ${initials}`).toHaveLength(2)
      expect(initials).toBe(initials.toUpperCase())
    }
  })
})

describe('toneFor and bannerFor', () => {
  it('give the same school the same answer every time', () => {
    for (const u of unis) {
      expect(toneFor(u.id)).toBe(toneFor(u.id))
      expect(bannerFor(u.id)).toBe(bannerFor(u.id))
    }
  })

  it('stay inside their lists for every real id', () => {
    // Asserting the property, not the values: a snapshot of which school gets
    // which tint would be a change-detector, and the tints are arbitrary.
    // What matters is that the modulus matches the list length — get that
    // wrong and some school renders `undefined` as a class name.
    for (const u of unis) {
      const tone = toneFor(u.id)
      expect(Number.isInteger(tone)).toBe(true)
      expect(tone).toBeGreaterThanOrEqual(0)
      expect(tone).toBeLessThan(4)
      expect(BANNERS).toContain(bannerFor(u.id))
    }
  })

  it('spread across more than one tone, so the wall is not one colour', () => {
    expect(new Set(unis.map((u) => toneFor(u.id))).size).toBeGreaterThan(1)
    expect(new Set(unis.map((u) => bannerFor(u.id))).size).toBeGreaterThan(1)
  })

  it('handles an empty id without throwing', () => {
    expect(toneFor('')).toBe(0)
    expect(BANNERS).toContain(bannerFor(''))
  })
})
