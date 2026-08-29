import { describe, expect, it } from 'vitest'
import UNIVERSITIES from '../data/generated/universities.json'
import { CITY_POINTS, mapCity } from '../data/campus-locations'
import { NEAR_KM, nearHome, nearHomeNote } from './nearHome'
import type { Program, University } from '../data/types'

const uni = (id: string, name: string, city: string, province = 'ON'): University => ({
  id,
  name,
  city,
  province,
  programCount: 1,
  reportCount: 1,
})

const prog = (id: string, universityId: string, name = id): Program =>
  ({ id, universityId, name, slug: id }) as Program

const UNIS = [
  uni('mcmaster', 'McMaster University', 'Hamilton'),
  uni('waterloo', 'University of Waterloo', 'Waterloo'),
  uni('queens', "Queen's University", 'Kingston'),
  uni('toronto-scarborough', 'U of T Scarborough', 'Scarborough'),
  uni('dalhousie', 'Dalhousie University', 'Halifax', 'NS'),
]

const KEPT = [
  prog('a', 'mcmaster', 'Engineering'),
  prog('b', 'waterloo', 'Computer Science'),
  prog('c', 'queens', 'Commerce'),
]

describe('nearHome', () => {
  it('measures every kept program from home, nearest first', () => {
    const r = nearHome('Mississauga', KEPT, UNIS)
    expect(r).not.toBeNull()
    if (!r) return
    expect(r.placed.map((p) => p.school)).toEqual([
      'McMaster University',
      'University of Waterloo',
      "Queen's University",
    ])
    expect(r.placed.map((p) => p.km)).toEqual([41, 72, 262])
    expect(r.unplaced).toBe(0)
    expect(r.near).toBe(2)
    expect(r.nearKm).toBe(NEAR_KM)
  })

  it('counts a school it cannot place instead of dropping it', () => {
    // Halifax has no CITY_POINTS entry, so Dalhousie has no point to measure
    // from. Silently leaving it out would shrink the denominator.
    const r = nearHome('Mississauga', [...KEPT, prog('d', 'dalhousie')], UNIS)
    expect(r?.unplaced).toBe(1)
    expect(r?.placed).toHaveLength(3)
  })

  it('folds Scarborough into Toronto, exactly as the map does', () => {
    const r = nearHome('Mississauga', [prog('e', 'toronto-scarborough')], UNIS)
    expect(r?.unplaced).toBe(0)
    expect(r?.placed[0].city).toBe('Toronto')
  })

  it('counts a program whose university is missing entirely as unplaceable', () => {
    const r = nearHome('Mississauga', [prog('f', 'nowhere')], UNIS)
    expect(r?.unplaced).toBe(1)
    expect(r?.placed).toHaveLength(0)
  })

  it('refuses a home city it cannot place, however it arrived', () => {
    // sync.ts copies homeCity across with `?? ''` and no whitelist, so this is
    // not hypothetical — another client can store anything.
    for (const bad of ['', 'Atlantis', 'mississauga', 'Halifax']) {
      expect(nearHome(bad, KEPT, UNIS)).toBeNull()
    }
  })

  it('has nothing to say about an empty list', () => {
    expect(nearHome('Mississauga', [], UNIS)).toBeNull()
  })
})

describe('the dataset makes "outside Ontario" true', () => {
  const unis = UNIVERSITIES as University[]

  it('every Ontario university sits in a city the map can place', () => {
    const missing = unis.filter((u) => u.province === 'ON' && !CITY_POINTS[mapCity(u.city)])
    expect(missing.map((u) => `${u.id} (${u.city})`)).toEqual([])
  })

  it('and no university outside Ontario can be placed', () => {
    // Together these two are what let the copy say "outside Ontario" rather
    // than the literal-but-clumsy "we hold no coordinates for it". The day an
    // Ontario city is added without a point, the first test fails and the
    // wording has to change — which is the point.
    const placeable = unis.filter((u) => u.province !== 'ON' && CITY_POINTS[mapCity(u.city)])
    expect(placeable.map((u) => `${u.id} (${u.city})`)).toEqual([])
  })
})

describe('nearHomeNote', () => {
  const note = (kept: Program[], home = 'Mississauga') => {
    const r = nearHome(home, kept, UNIS)
    return r ? nearHomeNote(r) : null
  }

  it('names the count, the threshold and the city', () => {
    expect(note(KEPT)?.headline).toBe(
      '2 of your 3 kept programs are within 100km of Mississauga.',
    )
  })

  it('states what was left out rather than shrinking the denominator', () => {
    const n = note([...KEPT, prog('d', 'dalhousie')])
    expect(n?.headline).toBe(
      '2 of the 3 kept programs we can place are within 100km of Mississauga. ' +
        '1 more is outside Ontario, where we hold no coordinates.',
    )
  })

  it('pluralises the remainder', () => {
    const n = note([...KEPT, prog('d', 'dalhousie'), prog('g', 'nowhere')])
    expect(n?.headline).toContain('2 more are outside Ontario')
  })

  it('reports none-near as information, with the extremes beside it', () => {
    const n = note([prog('c', 'queens'), prog('h', 'queens', 'Nursing')])
    expect(n?.headline).toBe(
      'None of the 2 kept programs we can place are within 100km of Mississauga.',
    )
    expect(n?.extremes).toContain("Queen's University, 262km")
  })

  it('does not count to one', () => {
    // "1 of 1 is within 100km" is a silly sentence; give the distance instead.
    const n = note([prog('a', 'mcmaster', 'Engineering')])
    expect(n?.headline).toBe('Your one kept program we can place is 41km from Mississauga.')
    expect(n?.extremes).toBe('')
  })

  it('says nothing at all when it can place nothing', () => {
    expect(note([prog('d', 'dalhousie')])).toBeNull()
  })

  it('always carries the straight-line and city-centre qualifier', () => {
    // The two halves the map already states on screen. This test is what stops
    // either being trimmed as wordy.
    for (const kept of [KEPT, [prog('a', 'mcmaster')], [...KEPT, prog('d', 'dalhousie')]]) {
      const q = note(kept)?.qualifier ?? ''
      expect(q).toContain('Straight-line')
      expect(q).toContain('city centres')
      expect(q).toContain('not campus addresses')
    }
  })

  it('never states a probability of admission', () => {
    const n = note([...KEPT, prog('d', 'dalhousie')])
    for (const s of [n?.headline, n?.extremes, n?.qualifier]) {
      expect(s).not.toMatch(/\bodds\b|\bchance\b|\blikely\b|probab|acceptance/i)
    }
  })

  it('cannot be mistaken for the kept-programs count the sweep reads', () => {
    // scripts/sweep.mjs matches /\d+ programs? kept/i against the whole of
    // <main>, first match wins, and this renders above the list header.
    for (const kept of [KEPT, [prog('a', 'mcmaster')], [...KEPT, prog('d', 'dalhousie')]]) {
      const n = note(kept)
      for (const s of [n?.headline, n?.extremes]) {
        expect(s ?? '').not.toMatch(/\d+ programs? kept/i)
      }
    }
  })
})
