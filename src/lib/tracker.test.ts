import { beforeEach, describe, expect, it } from 'vitest'
import {
  addDeadline,
  allDeadlines,
  clearTracker,
  isPast,
  loadTracker,
  removeDeadline,
  setStatus,
  statusOf,
  trackAll,
  untrack,
  withTracked,
} from './tracker'
import { saveProfile, loadProfile, EMPTY_PROFILE } from './profile'

// The same in-memory stand-in the other suites use: node, not jsdom.
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

describe('status', () => {
  it('starts untracked and records what it is set to', () => {
    expect(statusOf(loadTracker(), 'a::b')).toBeNull()
    setStatus('a::b', 'applying')
    expect(statusOf(loadTracker(), 'a::b')).toBe('applying')
  })

  it('moves through the stages and lands on an outcome', () => {
    for (const s of ['researching', 'applying', 'applied', 'offer'] as const) setStatus('a::b', s)
    expect(statusOf(loadTracker(), 'a::b')).toBe('offer')
  })

  // The bug this guards: deriving the next value from React state meant several
  // quick clicks all computed from the same stale snapshot (see toggleCourse).
  it('keeps every write when several land in a row', () => {
    setStatus('a::1', 'applied')
    setStatus('a::2', 'applying')
    setStatus('a::3', 'offer')
    const t = loadTracker()
    expect([statusOf(t, 'a::1'), statusOf(t, 'a::2'), statusOf(t, 'a::3')]).toEqual([
      'applied',
      'applying',
      'offer',
    ])
  })

  it('untracks a program without touching the others', () => {
    setStatus('a::1', 'applied')
    setStatus('a::2', 'applying')
    untrack('a::1')
    const t = loadTracker()
    expect(statusOf(t, 'a::1')).toBeNull()
    expect(statusOf(t, 'a::2')).toBe('applying')
  })
})

describe('bulk add', () => {
  it('starts every untracked program at the first stage', () => {
    trackAll(['a::1', 'a::2'])
    const t = loadTracker()
    expect([statusOf(t, 'a::1'), statusOf(t, 'a::2')]).toEqual(['researching', 'researching'])
  })

  // The button this exists for is offered over the WHOLE kept list, so it is
  // pressed against work already done. Sending an applied program back to
  // researching would be silent and there is nothing to undo it from.
  it('does not touch a program the student has already moved', () => {
    setStatus('a::1', 'applied')
    addDeadline('a::1', { label: 'close', date: '2026-02-01', source: '' })
    const before = loadTracker()['a::1']

    trackAll(['a::1', 'a::2'])

    expect(loadTracker()['a::1']).toEqual(before)
    expect(statusOf(loadTracker(), 'a::2')).toBe('researching')
  })

  it('is idempotent — a second press adds nothing and resets nothing', () => {
    trackAll(['a::1', 'a::2'])
    setStatus('a::2', 'offer')
    const before = loadTracker()

    trackAll(['a::1', 'a::2'])

    expect(loadTracker()).toEqual(before)
  })

  it('collapses a repeated id instead of writing it twice', () => {
    const merged = withTracked({}, ['a::1', 'a::1'], '2026-01-01T00:00:00.000Z')
    expect(Object.keys(merged)).toEqual(['a::1'])
    expect(merged['a::1'].updatedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('merges without mutating or saving — that is trackAll’s job', () => {
    setStatus('a::1', 'applied')
    const original = loadTracker()

    const merged = withTracked(original, ['a::1', 'a::2'], '2026-01-01T00:00:00.000Z')

    expect(Object.keys(original)).toEqual(['a::1'])
    expect(Object.keys(merged).sort()).toEqual(['a::1', 'a::2'])
    expect(statusOf(loadTracker(), 'a::2')).toBeNull()
  })
})

describe('deadlines', () => {
  const d = (date: string, label = 'Applications close') => ({
    label,
    date,
    source: 'https://example.edu/admissions',
  })

  it('round-trips a deadline with its source', () => {
    addDeadline('a::b', d('2026-02-01'))
    const saved = loadTracker()['a::b'].deadlines[0]
    expect(saved.date).toBe('2026-02-01')
    expect(saved.source).toBe('https://example.edu/admissions')
  })

  it('keeps them in date order, not entry order', () => {
    addDeadline('a::b', d('2026-03-01'))
    addDeadline('a::b', d('2026-01-15'))
    addDeadline('a::b', d('2026-02-01'))
    expect(loadTracker()['a::b'].deadlines.map((x) => x.date)).toEqual([
      '2026-01-15',
      '2026-02-01',
      '2026-03-01',
    ])
  })

  it('removes one by position and leaves the rest', () => {
    addDeadline('a::b', d('2026-01-15', 'first'))
    addDeadline('a::b', d('2026-02-01', 'second'))
    removeDeadline('a::b', 0)
    const left = loadTracker()['a::b'].deadlines
    expect(left).toHaveLength(1)
    expect(left[0].label).toBe('second')
  })

  it('gathers every program’s dates into one ordered timeline', () => {
    addDeadline('a::1', d('2026-03-01'))
    addDeadline('a::2', d('2026-01-15'))
    const all = allDeadlines(loadTracker())
    expect(all.map((x) => x.programId)).toEqual(['a::2', 'a::1'])
  })

  it('compares dates as strings so a timezone cannot age one early', () => {
    expect(isPast('2026-01-01', '2026-01-02')).toBe(true)
    expect(isPast('2026-01-02', '2026-01-02')).toBe(false)
    expect(isPast('2026-01-03', '2026-01-02')).toBe(false)
  })
})

describe('separation from the synced profile', () => {
  // The reason this store exists at all. sync.ts rebuilds the profile from a
  // fixed whitelist on every pull, so anything kept inside it would be erased;
  // these two must not be able to reach each other.
  it('survives the profile being rewritten wholesale', () => {
    setStatus('a::b', 'applied')
    addDeadline('a::b', { label: 'close', date: '2026-02-01', source: '' })

    // exactly what applyRemoteProfile does on a pull
    saveProfile({ ...EMPTY_PROFILE, shortlist: ['something::else'] })

    expect(statusOf(loadTracker(), 'a::b')).toBe('applied')
    expect(loadTracker()['a::b'].deadlines).toHaveLength(1)
  })

  it('is not carried inside the profile record', () => {
    setStatus('a::b', 'applied')
    expect(JSON.stringify(loadProfile() ?? {})).not.toContain('applied')
  })

  it('clears independently of the profile', () => {
    setStatus('a::b', 'applied')
    saveProfile({ ...EMPTY_PROFILE, shortlist: ['a::b'] })
    clearTracker()
    expect(loadTracker()).toEqual({})
    expect(loadProfile()?.shortlist).toEqual(['a::b'])
  })
})
