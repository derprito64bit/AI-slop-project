import { describe, it, expect } from 'vitest'
import { shouldOffer, PROGRAMS_BEFORE, SCROLL_PX } from './SurveyNudge'

const idle = {
  dismissed: false,
  hasProfile: false,
  programsSeen: 0,
  dwellReached: false,
  scrolledPx: 0,
}

describe('shouldOffer', () => {
  it('stays quiet for someone who has just arrived', () => {
    expect(shouldOffer(idle)).toBe(false)
  })

  it('offers after a couple of program pages', () => {
    expect(shouldOffer({ ...idle, programsSeen: PROGRAMS_BEFORE - 1 })).toBe(false)
    expect(shouldOffer({ ...idle, programsSeen: PROGRAMS_BEFORE })).toBe(true)
  })

  it('needs BOTH time and scrolling on the dwell path', () => {
    // an abandoned tab: the timer fires, nothing was read
    expect(shouldOffer({ ...idle, dwellReached: true, scrolledPx: 0 })).toBe(false)
    // a fast scroller who has not been here long
    expect(shouldOffer({ ...idle, dwellReached: false, scrolledPx: SCROLL_PX * 3 })).toBe(false)
    expect(shouldOffer({ ...idle, dwellReached: true, scrolledPx: SCROLL_PX })).toBe(true)
  })

  it('never reappears once dismissed, however engaged they are', () => {
    expect(shouldOffer({ ...idle, dismissed: true, programsSeen: 12 })).toBe(false)
    expect(
      shouldOffer({ ...idle, dismissed: true, dwellReached: true, scrolledPx: 99_999 }),
    ).toBe(false)
  })

  it('never shows to someone who already has a profile', () => {
    expect(shouldOffer({ ...idle, hasProfile: true, programsSeen: 12 })).toBe(false)
  })
})
