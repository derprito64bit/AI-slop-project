import { describe, it, expect, beforeEach } from 'vitest'
import { DEMO_PROFILE, clearDemo, isDemoActive, maybeSeedDemo } from './demo'
import { loadProfile, saveProfile, EMPTY_PROFILE } from './profile'

// Same in-memory stand-in the other suites use: node, not jsdom, so there is no
// localStorage and adding jsdom for one API would slow the whole run down.
beforeEach(() => {
  let store: Record<string, string> = {}
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = String(v)
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      store = {}
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length
    },
  } as Storage
})

describe('maybeSeedDemo', () => {
  it('does nothing without the parameter', () => {
    expect(maybeSeedDemo('')).toBe('not-requested')
    expect(maybeSeedDemo('?q=waterloo')).toBe('not-requested')
    expect(loadProfile()).toBeNull()
  })

  it('seeds on ?demo=1', () => {
    expect(maybeSeedDemo('?demo=1')).toBe('seeded')
    const p = loadProfile()
    expect(p?.shortlist).toHaveLength(6)
    expect(p?.answers?.average).toBe(88)
    expect(isDemoActive()).toBe(true)
  })

  // The rule that matters: a real visitor's work is never collateral.
  it('refuses to overwrite a profile it did not create', () => {
    saveProfile({ ...EMPTY_PROFILE, shortlist: ['mine::own'] })
    expect(maybeSeedDemo('?demo=1')).toBe('refused-real-profile')
    expect(loadProfile()?.shortlist).toEqual(['mine::own'])
    expect(isDemoActive()).toBe(false)
  })

  it('is idempotent — a second visit does not double-seed', () => {
    maybeSeedDemo('?demo=1')
    expect(maybeSeedDemo('?demo=1')).toBe('already-demo')
    expect(loadProfile()?.shortlist).toHaveLength(6)
  })
})

describe('clearDemo', () => {
  it('removes the demo profile and the flag', () => {
    maybeSeedDemo('?demo=1')
    clearDemo()
    expect(loadProfile()).toBeNull()
    expect(isDemoActive()).toBe(false)
  })

  it('never touches a real profile', () => {
    saveProfile({ ...EMPTY_PROFILE, shortlist: ['mine::own'] })
    clearDemo()
    expect(loadProfile()?.shortlist).toEqual(['mine::own'])
  })
})

describe('the seeded student', () => {
  it('spans several fields and both sides of the average, so no view is flat', () => {
    expect(new Set(DEMO_PROFILE.shortlist.map((id) => id.split('::')[0])).size).toBeGreaterThan(3)
  })

  it('leaves a real prerequisite gap rather than a full set of ticks', () => {
    expect(DEMO_PROFILE.courses).not.toContain('MCV4U')
    expect(DEMO_PROFILE.courses.length).toBeGreaterThan(0)
  })
})
