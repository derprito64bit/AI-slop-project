import { describe, it, expect } from 'vitest'
import { matchOptions, type Option } from './Combobox'
import { FIELD_LABELS, PROVINCE_LABELS } from '../../lib/profile'

const fields: Option[] = Object.entries(FIELD_LABELS).map(([value, label]) => ({ value, label }))
const provinces: Option[] = Object.entries(PROVINCE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

describe('matchOptions', () => {
  it('shows everything for an empty query, so focusing the box is still browsing', () => {
    expect(matchOptions(fields, '')).toHaveLength(fields.length)
    expect(matchOptions(fields, '   ')).toHaveLength(fields.length)
  })

  // The reason this is substring and not prefix matching. Prefix looks tidier
  // and would return nothing here, which reads as "we don't have that" for the
  // three fields that plainly do.
  it('finds a word anywhere in the label, not just at the start', () => {
    const labels = matchOptions(fields, 'science').map((o) => o.label)
    expect(labels).toContain('Computer science')
    expect(labels).toContain('Life sciences')
    expect(labels).toContain('Physical sciences')
  })

  it('ignores case, because nobody capitalises a search box', () => {
    expect(matchOptions(fields, 'ENGINEERING').map((o) => o.value)).toEqual(['engineering'])
    expect(matchOptions(fields, 'engineering').map((o) => o.value)).toEqual(['engineering'])
  })

  it('narrows to one as the query gets longer', () => {
    expect(matchOptions(provinces, 'o').length).toBeGreaterThan(1)
    expect(matchOptions(provinces, 'onta').map((o) => o.value)).toEqual(['ON'])
  })

  it('returns nothing for a query that matches nothing, rather than falling back to all', () => {
    // The empty list is what the component turns into "nothing matches — try
    // fewer letters, or skip this one". Silently showing everything instead
    // would look like the filter had been ignored.
    expect(matchOptions(fields, 'basket weaving')).toEqual([])
  })

  it('matches on the label, never the value', () => {
    // Values are slugs: 'arts-humanities', 'computer-science'. A student typing
    // a hyphen is not expressing intent about our URL keys.
    expect(matchOptions(fields, 'arts-humanities')).toEqual([])
    expect(matchOptions(fields, 'arts &').map((o) => o.value)).toEqual(['arts-humanities'])
  })

  it('leaves the option order alone, so the no-preference entry stays first', () => {
    const withAny: Option[] = [{ value: '', label: 'Anywhere' }, ...provinces]
    expect(matchOptions(withAny, '')[0].label).toBe('Anywhere')
  })
})
