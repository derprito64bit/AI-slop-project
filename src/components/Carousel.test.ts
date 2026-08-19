import { describe, it, expect } from 'vitest'
import { copiesNeeded } from './Carousel'

// The numbers below are the ones measured on the live page when the bug was
// found: one copy of the home-page logo band is 1,357px and one copy of the
// trending row is 1,668px. They are kept as literals so this test fails if the
// fix ever regresses to "two copies is always enough".
const LOGO_COPY = 1357
const TRENDING_COPY = 1668

describe('copiesNeeded', () => {
  it('keeps two copies when one already covers the container', () => {
    expect(copiesNeeded(1280, LOGO_COPY)).toBe(2)
  })

  it('adds copies on the wide screens where the gap appeared', () => {
    // 1920 / 1357 -> 2 copies of coverage, plus the one that is sliding away.
    expect(copiesNeeded(1920, LOGO_COPY)).toBe(3)
    expect(copiesNeeded(2560, LOGO_COPY)).toBe(3)
    expect(copiesNeeded(2560, TRENDING_COPY)).toBe(3)
  })

  it('always leaves a full container covered after one copy has slid away', () => {
    for (const container of [375, 768, 1280, 1512, 1920, 2560, 3840]) {
      for (const copy of [LOGO_COPY, TRENDING_COPY, 220, 640]) {
        const n = copiesNeeded(container, copy)
        expect((n - 1) * copy).toBeGreaterThanOrEqual(container)
      }
    }
  })

  it('never returns fewer than two, whatever it is handed', () => {
    expect(copiesNeeded(1920, 0)).toBe(2)
    expect(copiesNeeded(0, 0)).toBe(2)
    expect(copiesNeeded(Number.NaN, 300)).toBe(2)
    expect(copiesNeeded(1920, -50)).toBe(2)
  })
})
