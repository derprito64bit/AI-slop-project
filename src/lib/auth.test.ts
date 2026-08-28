import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthError,
  changePassword,
  confirmError,
  currentAccount,
  deleteAccount,
  passwordError,
  signIn,
  signOut,
  signUp,
  usernameError,
  verifySession,
} from './auth'
import {
  activeAccountId,
  activeToken,
  localAccountsWereMoved,
  migrateLocalAccounts,
  profileKeyFor,
} from './session'
import { EMPTY_PROFILE, clearProfile, loadProfile, saveProfile, updateProfile } from './profile'
import { applyRemoteProfile, flushProfile, pendingAccountId, queueProfilePush } from './sync'
import type { SurveyAnswers } from './profile'

// The suite runs in node, so localStorage and fetch are both stood in for. Both
// stand-ins are deliberately dumb: the point is to assert what the client SENDS
// and what it KEEPS, which is where the interesting decisions are.

/* --------------------------------------------------------------- storage --- */

function fakeStorage(): void {
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
}

/* ----------------------------------------------------------------- fetch --- */

type Call = {
  path: string
  method: string
  headers: Record<string, string>
  body: Record<string, unknown> | null
}

type Reply = { status: number; body?: unknown } | { throws: 'offline' | 'timeout' }

let calls: Call[] = []
let replies: Reply[] = []

/** Queue what the server will answer, in order. */
function willReply(...next: Reply[]): void {
  replies.push(...next)
}

function mockFetch(): void {
  calls = []
  replies = []
  globalThis.fetch = (async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    calls.push({
      path: url.replace(/^https?:\/\/[^/]+/, ''),
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : null,
    })

    const reply = replies.shift() ?? { status: 200, body: {} }

    if ('throws' in reply) {
      // What fetch actually does: rejects on network failure and on abort, never
      // on a 4xx/5xx.
      if (reply.throws === 'timeout') {
        throw new DOMException('The operation timed out.', 'TimeoutError')
      }
      throw new TypeError('Failed to fetch')
    }

    return new Response(reply.status === 204 ? null : JSON.stringify(reply.body ?? {}), {
      status: reply.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
}

const lastCall = () => calls[calls.length - 1]
const callTo = (path: string) => calls.filter((c) => c.path === path)

/* ---------------------------------------------------------------- shapes --- */

const answers = (over: Partial<SurveyAnswers> = {}): SurveyAnswers => ({
  field: 'engineering',
  province: 'ON',
  average: 88,
  ambition: 'balanced',
  homeCity: 'Toronto',
  coop: 'yes',
  gradYear: 2027,
  ...over,
})

const account = { id: 'acc_1', username: 'northstar', createdAt: '2026-08-18T00:00:00.000Z' }

const remoteProfile = (over: Record<string, unknown> = {}) => ({
  answers: { field: 'health', province: 'BC', average: 91, ambition: 'reach' },
  shortlist: ['ubc::nursing'],
  courses: ['SBI4U'],
  notes: {},
  tags: {},
  savedAt: '2026-08-17T00:00:00.000Z',
  ...over,
})

/** A successful signup/login body. */
const authOk = (profile: unknown = null) => ({
  status: 200,
  body: { token: 'tok_abc', account, profile },
})

beforeEach(() => {
  fakeStorage()
  mockFetch()
})

afterEach(() => {
  vi.useRealTimers()
})

/* ------------------------------------------------------------ validation --- */

describe('usernameError', () => {
  it('accepts a plain handle', () => {
    expect(usernameError('northstar_7')).toBeUndefined()
    expect(usernameError('a-b')).toBeUndefined()
  })

  it('rejects blank, short, long and odd shapes', () => {
    expect(usernameError('')).toBeDefined()
    expect(usernameError('ab')).toBeDefined()
    expect(usernameError('a'.repeat(21))).toBeDefined()
    expect(usernameError('has space')).toBeDefined()
    expect(usernameError('_leading')).toBeDefined()
    expect(usernameError('emoji🙂')).toBeDefined()
  })
})

describe('passwordError', () => {
  it('accepts anything long enough', () => {
    expect(passwordError('correct horse battery')).toBeUndefined()
  })

  it('rejects short, common, and password-is-username', () => {
    expect(passwordError('short')).toBeDefined()
    expect(passwordError('PASSWORD123')).toBeDefined()
    expect(passwordError('Northstar7', 'northstar7')).toBeDefined()
  })
})

describe('confirmError', () => {
  it('catches a mismatch and a blank', () => {
    expect(confirmError('abcdefgh', 'abcdefgh')).toBeUndefined()
    expect(confirmError('abcdefgh', 'abcdefgi')).toBeDefined()
    expect(confirmError('abcdefgh', '')).toBeDefined()
  })
})

/* ---------------------------------------------------------------- signup --- */

describe('signUp', () => {
  it('posts the username and password and starts a session', async () => {
    willReply({ status: 201, body: { token: 'tok_abc', account, profile: null } })

    const { account: created } = await signUp('northstar', 'a good long password')

    expect(lastCall().path).toBe('/api/auth/signup')
    expect(lastCall().method).toBe('POST')
    expect(lastCall().body).toEqual({ username: 'northstar', password: 'a good long password' })
    expect(created.username).toBe('northstar')
    expect(currentAccount()?.id).toBe('acc_1')
    expect(activeToken()).toBe('tok_abc')
  })

  it('never keeps the password on the device', async () => {
    willReply({ status: 201, body: { token: 'tok_abc', account, profile: null } })
    await signUp('northstar', 'a good long password')

    // Every value in storage, checked for the plaintext. The session holds a
    // token; nothing holds a password or a hash of one.
    const everything = Object.keys(localStorage)
      .map((k) => localStorage.getItem(k) ?? '')
      .join('|')
    expect(everything).not.toContain('a good long password')
  })

  it('sends the password in a body, never in a URL', async () => {
    willReply({ status: 201, body: { token: 'tok_abc', account, profile: null } })
    await signUp('northstar', 'a good long password')

    // A query string lands in server logs and browser history.
    for (const call of calls) {
      expect(call.path).not.toContain('a good long password')
      expect(call.path).not.toContain('password=')
    }
  })

  it('validates before making a request at all', async () => {
    await expect(signUp('ab', 'a good long password')).rejects.toThrow(/3 characters/)
    await expect(signUp('northstar', 'short')).rejects.toThrow(/8 characters/)
    expect(calls).toHaveLength(0)
  })

  it('maps a taken username onto the username field', async () => {
    willReply({
      status: 409,
      body: { error: { code: 'username_taken', message: 'That username is already taken.' } },
    })

    const error = await signUp('northstar', 'a good long password').catch((e) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.field).toBe('username')
    expect(currentAccount()).toBeNull()
  })

  it('explains a server with no account routes deployed', async () => {
    // What a client gets when it is pointed at the old build of the service. It
    // must not read as "wrong password".
    willReply({ status: 404, body: { error: { code: 'not_found', message: 'No route.' } } })

    const error = await signUp('northstar', 'a good long password').catch((e) => e)
    expect(error.message).toMatch(/aren’t available on the server yet/)
  })

  it('reports an unreachable server as retryable, and signs nobody in', async () => {
    willReply({ throws: 'offline' })

    const error = await signUp('northstar', 'a good long password').catch((e) => e)
    expect(error).toBeInstanceOf(AuthError)
    expect(error.retryable).toBe(true)
    expect(error.message).toMatch(/Couldn’t reach the server/)
    expect(currentAccount()).toBeNull()
  })

  it('says the server may be waking up when it times out', async () => {
    willReply({ throws: 'timeout' })
    const error = await signUp('northstar', 'a good long password').catch((e) => e)
    expect(error.message).toMatch(/waking up/)
    expect(error.retryable).toBe(true)
  })

  it('carries guest survey data into the new account and pushes it up', async () => {
    // The common path: four questions as a guest, then decide to make an account.
    saveProfile({ ...EMPTY_PROFILE, answers: answers(), shortlist: ['waterloo::se'] })

    willReply({ status: 201, body: { token: 'tok_abc', account, profile: null } }, { status: 200, body: { profile: null } })

    const { adopted } = await signUp('northstar', 'a good long password')
    expect(adopted).toBe(true)

    // Moved under the account, and gone from the guest key.
    expect(loadProfile()?.shortlist).toEqual(['waterloo::se'])
    expect(localStorage.getItem(profileKeyFor(null))).toBeNull()

    // And uploaded, rather than sitting in a queue: this is the moment the
    // student was told their work was safe.
    const push = callTo('/api/profile').at(-1)
    expect(push?.method).toBe('PUT')
    expect(push?.headers.Authorization).toBe('Bearer tok_abc')
    expect(push?.body?.shortlist).toEqual(['waterloo::se'])
    expect((push!.body!.answers as SurveyAnswers).average).toBe(88)
  })

  it('leaves guest data alone when the signup fails', async () => {
    saveProfile({ ...EMPTY_PROFILE, shortlist: ['waterloo::se'] })
    willReply({ status: 409, body: { error: { code: 'username_taken', message: 'Taken.' } } })

    await signUp('northstar', 'a good long password').catch(() => {})

    expect(localStorage.getItem(profileKeyFor(null))).toBeTruthy()
    expect(loadProfile()?.shortlist).toEqual(['waterloo::se'])
  })

  it('does not lose the adopted data when the first push fails', async () => {
    saveProfile({ ...EMPTY_PROFILE, shortlist: ['waterloo::se'] })
    willReply({ status: 201, body: { token: 'tok_abc', account, profile: null } }, { throws: 'offline' })

    const { adopted } = await signUp('northstar', 'a good long password')

    expect(adopted).toBe(true)
    expect(loadProfile()?.shortlist).toEqual(['waterloo::se'])
    // Still flagged as unsynced, so a later trigger retries it.
    expect(pendingAccountId()).toBe('acc_1')
  })
})

/* ----------------------------------------------------------------- login --- */

describe('signIn', () => {
  it('posts credentials and stores the session', async () => {
    willReply(authOk(null), { status: 200, body: { profile: null } })

    await signIn('  NorthStar  ', 'a good long password')

    const call = callTo('/api/auth/login')[0]
    // Trimmed, but not lower-cased here: matching case-insensitively is the
    // server's job, and mangling what they typed would be a guess.
    expect(call.body).toEqual({ username: 'NorthStar', password: 'a good long password' })
    expect(activeAccountId()).toBe('acc_1')
  })

  it('takes the server’s profile over whatever is on this device', async () => {
    // Signing in on a second device has to show the list built on the first.
    willReply(authOk(remoteProfile()))

    await signIn('northstar', 'a good long password')

    const loaded = loadProfile()
    expect(loaded?.shortlist).toEqual(['ubc::nursing'])
    expect(loaded?.answers?.average).toBe(91)
    expect(loaded?.answers?.ambition).toBe('reach')
  })

  it('falls back to a pull when the login response carries no profile', async () => {
    willReply(authOk(undefined), { status: 200, body: { profile: remoteProfile() } })

    await signIn('northstar', 'a good long password')

    expect(callTo('/api/profile')[0].method).toBe('GET')
    expect(loadProfile()?.shortlist).toEqual(['ubc::nursing'])
  })

  it('reports a wrong password against the password field', async () => {
    willReply({
      status: 401,
      body: { error: { code: 'invalid_credentials', message: 'That username and password don’t match.' } },
    })

    const error = await signIn('northstar', 'wrong but long').catch((e) => e)
    expect(error.field).toBe('password')
    expect(error.retryable).toBe(false)
    expect(currentAccount()).toBeNull()
  })

  it('does not sign in on a rate limit, and says so', async () => {
    willReply({
      status: 429,
      body: { error: { code: 'rate_limited', message: 'Too many sign-in attempts.' } },
    })

    const error = await signIn('northstar', 'a good long password').catch((e) => e)
    expect(error.message).toMatch(/Too many/)
    expect(currentAccount()).toBeNull()
  })

  it('leaves guest data where it is', async () => {
    // It belongs to whoever was browsing signed out, who may not be this person.
    saveProfile({ ...EMPTY_PROFILE, shortlist: ['someone-elses'] })
    willReply(authOk(remoteProfile()))

    await signIn('northstar', 'a good long password')
    expect(loadProfile()?.shortlist).toEqual(['ubc::nursing'])

    await signOut()
    expect(loadProfile()?.shortlist).toEqual(['someone-elses'])
  })
})

/* ---------------------------------------------------------- the session --- */

describe('verifySession', () => {
  beforeEach(async () => {
    willReply(authOk(null), { status: 200, body: { profile: null } })
    await signIn('northstar', 'a good long password')
    calls = []
  })

  it('refreshes the cached account from the server', async () => {
    willReply({ status: 200, body: { account: { ...account, username: 'renamed' } } })

    const verified = await verifySession()

    expect(callTo('/api/auth/me')[0].headers.Authorization).toBe('Bearer tok_abc')
    expect(verified?.username).toBe('renamed')
    expect(currentAccount()?.username).toBe('renamed')
  })

  it('signs out on a 401, because that token is finished', async () => {
    willReply({ status: 401, body: { error: { code: 'unauthorized', message: 'Please sign in again.' } } })

    expect(await verifySession()).toBeNull()
    expect(currentAccount()).toBeNull()
  })

  it('keeps the local profile when a token expires', async () => {
    // It is still that student's work. Wiping it because a token aged out would
    // be its own kind of data loss.
    updateProfile({ shortlist: ['keep-me'] })
    const key = profileKeyFor('acc_1')
    willReply({ status: 401, body: { error: { code: 'unauthorized', message: 'no' } } })

    await verifySession()

    expect(localStorage.getItem(key)).toContain('keep-me')
  })

  it('does NOT sign anyone out when the network is down', async () => {
    // Offline is not logged out. Dropping someone out of their own dashboard on a
    // train would be a bug, not a security measure.
    willReply({ throws: 'offline' })

    const still = await verifySession()

    expect(still?.id).toBe('acc_1')
    expect(currentAccount()?.id).toBe('acc_1')
  })

  it('does nothing at all when nobody is signed in', async () => {
    await signOut()
    calls = []
    expect(await verifySession()).toBeNull()
    expect(calls).toHaveLength(0)
  })
})

describe('signOut', () => {
  it('pushes unsynced work before ending the session', async () => {
    willReply(authOk(null), { status: 200, body: { profile: null } })
    await signIn('northstar', 'a good long password')
    updateProfile({ shortlist: ['last-minute'] })
    calls = []
    willReply({ status: 200, body: { profile: null } })

    await signOut()

    const push = callTo('/api/profile').at(-1)
    expect(push?.method).toBe('PUT')
    expect(push?.body?.shortlist).toEqual(['last-minute'])
    expect(currentAccount()).toBeNull()
  })

  it('still signs out when that push fails', async () => {
    willReply(authOk(null), { status: 200, body: { profile: null } })
    await signIn('northstar', 'a good long password')
    updateProfile({ shortlist: ['a'] })
    willReply({ throws: 'offline' })

    await signOut()

    expect(currentAccount()).toBeNull()
    // The work is still on the device, and still flagged.
    expect(localStorage.getItem(profileKeyFor('acc_1'))).toContain('a')
    expect(pendingAccountId()).toBe('acc_1')
  })

  it('leaves the local copy so signing back in is instant', async () => {
    willReply(authOk(null), { status: 200, body: { profile: null } })
    await signIn('northstar', 'a good long password')
    updateProfile({ shortlist: ['a'] })
    willReply({ status: 200, body: { profile: null } })
    await signOut()

    expect(localStorage.getItem(profileKeyFor('acc_1'))).toBeTruthy()
  })
})

/* ------------------------------------------------------------- password --- */

describe('changePassword', () => {
  beforeEach(async () => {
    willReply(authOk(null), { status: 200, body: { profile: null } })
    await signIn('northstar', 'a good long password')
    calls = []
  })

  it('sends both passwords to the server', async () => {
    willReply({ status: 204 })
    await changePassword('a good long password', 'a different long password')

    const call = callTo('/api/auth/password')[0]
    expect(call.method).toBe('POST')
    expect(call.headers.Authorization).toBe('Bearer tok_abc')
    expect(call.body).toEqual({
      currentPassword: 'a good long password',
      newPassword: 'a different long password',
    })
  })

  it('checks the new password locally before asking', async () => {
    await expect(changePassword('a good long password', 'short')).rejects.toThrow(/8 characters/)
    await expect(
      changePassword('a good long password', 'a good long password'),
    ).rejects.toThrow(/already have/)
    expect(calls).toHaveLength(0)
  })

  it('puts a wrong current password under the current-password field', async () => {
    willReply({
      status: 403,
      body: { error: { code: 'wrong_password', message: 'That’s not your current password.' } },
    })

    const error = await changePassword('not it', 'a different long password').catch((e) => e)
    expect(error.field).toBe('password')
  })

  it('keeps the session, because changing a password is not signing out', async () => {
    willReply({ status: 204 })
    await changePassword('a good long password', 'a different long password')
    expect(currentAccount()?.id).toBe('acc_1')
    expect(activeToken()).toBe('tok_abc')
  })
})

/* ---------------------------------------------------------------- delete --- */

describe('deleteAccount', () => {
  beforeEach(async () => {
    willReply(authOk(null), { status: 200, body: { profile: null } })
    await signIn('northstar', 'a good long password')
    updateProfile({ shortlist: ['a'] })
    calls = []
  })

  it('deletes on the server, then wipes the device', async () => {
    willReply({ status: 204 })

    await deleteAccount()

    const call = callTo('/api/account')[0]
    expect(call.method).toBe('DELETE')
    expect(call.headers.Authorization).toBe('Bearer tok_abc')
    expect(currentAccount()).toBeNull()
    expect(localStorage.getItem(profileKeyFor('acc_1'))).toBeNull()
  })

  it('touches nothing locally when the server call fails', async () => {
    // A local wipe with the account still live would mean signing in again
    // restores everything they asked to be rid of.
    willReply({ throws: 'offline' })

    await expect(deleteAccount()).rejects.toThrow(/Couldn’t reach the server/)

    expect(currentAccount()?.id).toBe('acc_1')
    expect(localStorage.getItem(profileKeyFor('acc_1'))).toContain('a')
  })

  it('leaves no pending-sync flag pointing at a deleted account', async () => {
    willReply({ status: 204 })
    await deleteAccount()
    // Otherwise every retry trigger keeps aiming at an account that is gone.
    expect(pendingAccountId()).toBeNull()
  })

  it('finishes the local half when the server says the token is already gone', async () => {
    willReply({ status: 401, body: { error: { code: 'unauthorized', message: 'no' } } })

    await deleteAccount()

    expect(currentAccount()).toBeNull()
    expect(localStorage.getItem(profileKeyFor('acc_1'))).toBeNull()
  })
})

/* ------------------------------------------------------------------ sync --- */

describe('profile sync', () => {
  async function signedIn() {
    willReply(authOk(null), { status: 200, body: { profile: null } })
    await signIn('northstar', 'a good long password')
    calls = []
  }

  it('pushes the whole profile, not a patch', async () => {
    await signedIn()
    updateProfile({ answers: answers(), shortlist: ['a', 'b'], courses: ['MHF4U'] })
    saveProfile({
      ...EMPTY_PROFILE,
      answers: answers(),
      shortlist: ['a', 'b'],
      courses: ['MHF4U'],
      notes: { a: 'ask Mr Patel' },
      tags: { a: ['reach'] },
    })
    willReply({ status: 200, body: { profile: null } })

    await flushProfile()

    const body = callTo('/api/profile').at(-1)!.body!
    expect(Object.keys(body).sort()).toEqual([
      'answers', 'courses', 'notes', 'savedAt', 'shortlist', 'tags',
    ])
    expect(body.notes).toEqual({ a: 'ask Mr Patel' })
    expect(body.tags).toEqual({ a: ['reach'] })
  })

  it('collects a burst of edits into one request', async () => {
    vi.useFakeTimers()
    await signedIn()

    // Six course ticks in a row is one push, not six.
    for (const code of ['MHF4U', 'MCV4U', 'SCH4U', 'SPH4U', 'ENG4U', 'SBI4U']) {
      updateProfile({ courses: [code] })
    }
    expect(callTo('/api/profile')).toHaveLength(0)

    willReply({ status: 200, body: { profile: null } })
    await vi.advanceTimersByTimeAsync(2_000)

    expect(callTo('/api/profile')).toHaveLength(1)
  })

  it('flags unsynced work and clears the flag once it lands', async () => {
    await signedIn()
    updateProfile({ shortlist: ['a'] })
    expect(pendingAccountId()).toBe('acc_1')

    willReply({ status: 200, body: { profile: null } })
    await flushProfile()

    expect(pendingAccountId()).toBeNull()
  })

  it('keeps the flag set when the push fails', async () => {
    vi.useFakeTimers()
    await signedIn()
    updateProfile({ shortlist: ['a'] })
    willReply({ throws: 'offline' })

    await flushProfile()

    expect(pendingAccountId()).toBe('acc_1')
    // And the data is untouched — a failed upload never costs the student an edit.
    expect(loadProfile()?.shortlist).toEqual(['a'])
  })

  it('does not push anything while signed out', async () => {
    saveProfile({ ...EMPTY_PROFILE, shortlist: ['a'] })
    queueProfilePush()
    await flushProfile()
    expect(callTo('/api/profile')).toHaveLength(0)
  })

  it('writes a server profile into the shape loadProfile expects', async () => {
    await signedIn()
    applyRemoteProfile('acc_1', remoteProfile())

    const loaded = loadProfile()!
    expect(loaded.answers?.field).toBe('health')
    expect(loaded.answers?.average).toBe(91)
    expect(loaded.shortlist).toEqual(['ubc::nursing'])
    expect(loaded.courses).toEqual(['SBI4U'])
    expect(loaded.savedAt).toBe('2026-08-17T00:00:00.000Z')
  })

  it('repairs a nonsense ambition rather than rendering undefined', async () => {
    await signedIn()
    applyRemoteProfile('acc_1', remoteProfile({ answers: { field: '', province: '', average: null, ambition: 'wildly-ambitious' } }))
    expect(loadProfile()?.answers?.ambition).toBe('balanced')
  })

  it('keeps a null answers as null, because skipping is a real answer', async () => {
    await signedIn()
    applyRemoteProfile('acc_1', remoteProfile({ answers: null }))
    expect(loadProfile()?.answers).toBeNull()
  })

  it('sends no token and no username with the anonymous telemetry', async () => {
    const { submitSurvey } = await import('./api')
    await signedIn()
    willReply({ status: 201, body: { ok: true } })

    await submitSurvey({
      field: 'engineering',
      province: 'ON',
      averageBand: '85-89',
      ambition: 'balanced',
      matchCount: 12,
    })

    const call = callTo('/api/data')[0]
    expect(call.headers.Authorization).toBeUndefined()
    expect(call.body).not.toHaveProperty('username')
    expect(call.body).not.toHaveProperty('average')
    expect(call.body?.averageBand).toBe('85-89')
  })
})

/* ------------------------------------------------------- deleting my data --- */

describe('clearProfile', () => {
  it('empties the server copy too, for a signed-in student', async () => {
    // Deleting locally only would mean the data came back on the next sign-in.
    willReply(authOk(null), { status: 200, body: { profile: null } })
    await signIn('northstar', 'a good long password')
    updateProfile({ answers: answers(), shortlist: ['a'] })
    calls = []

    clearProfile()
    willReply({ status: 200, body: { profile: null } })
    await flushProfile()

    expect(loadProfile()?.shortlist).toEqual([])
    expect(loadProfile()?.answers).toBeNull()
    const body = callTo('/api/profile').at(-1)!.body!
    expect(body.shortlist).toEqual([])
    expect(body.answers).toBeNull()
  })

  it('just removes the record for a guest', () => {
    saveProfile({ ...EMPTY_PROFILE, shortlist: ['a'] })
    clearProfile()
    expect(loadProfile()).toBeNull()
    expect(calls).toHaveLength(0)
  })
})

/* -------------------------------------------- retiring the local accounts --- */

describe('migrateLocalAccounts', () => {
  it('hands the last-used local account’s work back to the guest key', () => {
    // The build where accounts were a PBKDF2 hash in localStorage. Those accounts
    // cannot be signed into any more, but the student's list must not vanish.
    localStorage.setItem(
      'acceptiversity.accounts.v1',
      JSON.stringify([{ id: 'local_1', username: 'northstar' }]),
    )
    localStorage.setItem('acceptiversity.session.v1', JSON.stringify({ accountId: 'local_1' }))
    localStorage.setItem(
      profileKeyFor('local_1'),
      JSON.stringify({ ...EMPTY_PROFILE, answers: answers(), shortlist: ['a'], savedAt: 'x' }),
    )

    expect(migrateLocalAccounts()).toBe(true)

    expect(activeAccountId()).toBeNull()
    expect(loadProfile()?.shortlist).toEqual(['a'])
    expect(loadProfile()?.answers?.average).toBe(88)
    expect(localStorage.getItem('acceptiversity.accounts.v1')).toBeNull()
    expect(localAccountsWereMoved()).toBe(true)
  })

  it('uses the only account when there was no active session', () => {
    localStorage.setItem(
      'acceptiversity.accounts.v1',
      JSON.stringify([{ id: 'local_1', username: 'northstar' }]),
    )
    localStorage.setItem(profileKeyFor('local_1'), JSON.stringify({ ...EMPTY_PROFILE, shortlist: ['a'] }))

    migrateLocalAccounts()
    expect(loadProfile()?.shortlist).toEqual(['a'])
  })

  it('never overwrites guest work that is already there', () => {
    localStorage.setItem(
      'acceptiversity.accounts.v1',
      JSON.stringify([{ id: 'local_1', username: 'northstar' }]),
    )
    localStorage.setItem('acceptiversity.session.v1', JSON.stringify({ accountId: 'local_1' }))
    localStorage.setItem(profileKeyFor('local_1'), JSON.stringify({ ...EMPTY_PROFILE, shortlist: ['older'] }))
    localStorage.setItem(profileKeyFor(null), JSON.stringify({ ...EMPTY_PROFILE, shortlist: ['current'] }))

    migrateLocalAccounts()

    expect(loadProfile()?.shortlist).toEqual(['current'])
  })

  it('does nothing on a browser that never had a local account', () => {
    expect(migrateLocalAccounts()).toBe(false)
    expect(localAccountsWereMoved()).toBe(false)
  })

  it('survives a corrupted local store', () => {
    localStorage.setItem('acceptiversity.accounts.v1', '{ not json')
    expect(() => migrateLocalAccounts()).not.toThrow()
    expect(localStorage.getItem('acceptiversity.accounts.v1')).toBeNull()
  })
})
