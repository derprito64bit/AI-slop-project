import { describe, it, expect } from 'vitest'
import {
  normalizeAverage,
  normalizeDecision,
  normalizeProgram,
  canonicalUniversityId,
  excelSerialToISO,
  programSlug,
  percentile,
  inferField,
} from './normalize.mjs'

// Fixtures are real values taken from the four source spreadsheets.

describe('normalizeAverage', () => {
  it('keeps percentages as-is', () => {
    expect(normalizeAverage('92').value).toBe(92)
    expect(normalizeAverage('94.8').value).toBe(94.8)
  })

  it('converts fraction form to a percentage', () => {
    // The "Responses" sheet stores averages as 0.86 / 0.96.
    expect(normalizeAverage('0.86').value).toBe(86)
    expect(normalizeAverage('0.96').value).toBe(96)
  })

  it('rejects out-of-range junk', () => {
    expect(normalizeAverage('11111').value).toBeNull()
    expect(normalizeAverage('0').value).toBeNull()
    expect(normalizeAverage('8.3').value).toBeNull()
    expect(normalizeAverage('33').value).toBeNull()
  })

  it('rejects blanks and non-numbers', () => {
    expect(normalizeAverage('').value).toBeNull()
    expect(normalizeAverage(null).value).toBeNull()
    expect(normalizeAverage('N/A').value).toBeNull()
  })

  it('tolerates a trailing percent sign', () => {
    expect(normalizeAverage('88%').value).toBe(88)
  })

  it('keeps the boundaries', () => {
    expect(normalizeAverage('40').value).toBe(40)
    expect(normalizeAverage('100').value).toBe(100)
  })
})

describe('normalizeDecision', () => {
  it('maps the many ways people say yes', () => {
    for (const raw of ['Offer', 'Accepted', 'accepted', 'accepeted', 'Accepted (conditional)', 'Accepted(conditional)']) {
      expect(normalizeDecision(raw)).toBe('offer')
    }
  })

  it('maps the other outcomes', () => {
    expect(normalizeDecision('Rejected')).toBe('rejected')
    expect(normalizeDecision('Waitlisted')).toBe('waitlisted')
    expect(normalizeDecision('Deferred')).toBe('deferred')
  })

  it('does not count a rejection after a waitlist as an offer', () => {
    expect(normalizeDecision('Waitlisted then accepted')).toBe('waitlisted')
    expect(normalizeDecision('Accepted, then rejected')).toBe('rejected')
  })

  it('returns null for nonsense', () => {
    expect(normalizeDecision('')).toBeNull()
    expect(normalizeDecision('maybe someday')).toBeNull()
  })
})

describe('canonicalUniversityId', () => {
  it('collapses the spellings of one school', () => {
    for (const raw of ['Waterloo', 'University Of Waterloo', 'University of Waterloo', 'uWaterloo']) {
      expect(canonicalUniversityId(raw)).toBe('waterloo')
    }
  })

  it('handles apostrophes and abbreviations', () => {
    expect(canonicalUniversityId("Queen's")).toBe('queens')
    expect(canonicalUniversityId('Queens University')).toBe('queens')
    expect(canonicalUniversityId('UofT - SG')).toBe('toronto')
    expect(canonicalUniversityId('University of Toronto')).toBe('toronto')
    expect(canonicalUniversityId('TMU')).toBe('tmu')
    expect(canonicalUniversityId('UOttawa')).toBe('ottawa')
  })

  it('keeps U of T satellite campuses distinct', () => {
    expect(canonicalUniversityId('UTSc')).toBe('toronto-scarborough')
    expect(canonicalUniversityId('UTM')).toBe('toronto-mississauga')
  })

  it('returns null for junk so it lands in the QA report', () => {
    expect(canonicalUniversityId('Skibidi toilet univeristyde')).toBeNull()
    expect(canonicalUniversityId('.')).toBeNull()
    expect(canonicalUniversityId('33.0')).toBeNull()
    expect(canonicalUniversityId('')).toBeNull()
  })
})

describe('normalizeProgram', () => {
  it('strips a repeated university prefix', () => {
    expect(normalizeProgram('Brock University - BSc Honours: Computer Science', 'Brock University'))
      .toBe('BSc Honours: Computer Science')
  })

  it('preserves intentional casing', () => {
    expect(normalizeProgram('BSc Honours', 'Brock University')).toBe('BSc Honours')
    expect(normalizeProgram('  Life   Sciences Gateway ', 'McMaster University'))
      .toBe('Life Sciences Gateway')
  })

  it('title-cases shouty entries', () => {
    expect(normalizeProgram('COMPUTER SCIENCE', 'Waterloo')).toBe('Computer Science')
  })

  it('rejects placeholder values', () => {
    expect(normalizeProgram('N/A', 'Waterloo')).toBeNull()
    expect(normalizeProgram('none', 'Waterloo')).toBeNull()
    expect(normalizeProgram('.', 'Waterloo')).toBeNull()
    expect(normalizeProgram('', 'Waterloo')).toBeNull()
  })
})

describe('programSlug', () => {
  it('groups singular and plural spellings together', () => {
    expect(programSlug('Health Sciences')).toBe(programSlug('Health science'))
    expect(programSlug('Life Sciences')).toBe(programSlug('Life Science'))
  })

  it('keeps genuinely different programs apart', () => {
    expect(programSlug('Engineering I')).not.toBe(programSlug('Engineering I (Co-op)'))
  })
})

describe('excelSerialToISO', () => {
  it('converts serials to ISO dates', () => {
    // Anchor: 45292 is 2024-01-01 in Excel's 1900 date system.
    expect(excelSerialToISO(45292)).toBe('2024-01-01')
    expect(excelSerialToISO(45603)).toBe('2024-11-07')
    expect(excelSerialToISO('45977.774305555555')).toBe('2025-11-16')
  })

  it('rejects impossible values', () => {
    expect(excelSerialToISO(0)).toBeNull()
    expect(excelSerialToISO('')).toBeNull()
    expect(excelSerialToISO('not a date')).toBeNull()
  })
})

describe('inferField', () => {
  it('buckets programs by subject', () => {
    expect(inferField('Engineering I (Co-op)')).toBe('engineering')
    expect(inferField('Computer Science')).toBe('computer-science')
    expect(inferField('Business Administration (BBA)')).toBe('business')
  })

  // Regression: a trailing \b in the patterns made every plural "… Sciences"
  // program fall through to "other".
  it('matches plural forms of multi-word stems', () => {
    expect(inferField('Life Sciences Gateway')).toBe('life-sciences')
    expect(inferField('Health Sciences')).toBe('health')
    expect(inferField('Medical Sciences')).toBe('health')
    expect(inferField('Environmental Sciences')).toBe('physical-sciences')
  })

  it('falls back to other', () => {
    expect(inferField('Something Unclassifiable')).toBe('other')
  })
})

describe('percentile', () => {
  it('computes median and quartiles', () => {
    const v = [80, 85, 90, 95, 100]
    expect(percentile(v, 0.5)).toBe(90)
    expect(percentile(v, 0.25)).toBe(85)
    expect(percentile(v, 0.75)).toBe(95)
  })

  it('interpolates between values', () => {
    expect(percentile([90, 92], 0.5)).toBe(91)
  })

  it('handles tiny and empty inputs', () => {
    expect(percentile([88], 0.5)).toBe(88)
    expect(percentile([], 0.5)).toBeNull()
  })
})
