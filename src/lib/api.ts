// Everything that talks to the Render service. One file, so "what leaves this
// device?" has one answer you can read top to bottom.
//
// Rewritten on 2026-08-18 to carry accounts. The transport half is still James
// Zeng's — the base-URL override, the trailing-slash strip, the long timeout for
// Render's cold start, and the note that fetch does not reject on 4xx/5xx were
// all right and are all still here.
//
// WHAT LEAVES THE DEVICE NOW, and this is a real change from the previous
// version, which uploaded nothing but a coarse band:
//
//   /api/auth/*    the username and the password, over HTTPS
//   /api/profile   the survey answers INCLUDING THE EXACT AVERAGE, the
//                  shortlist, the courses, the notes and the tags
//   /api/data      the same anonymous telemetry as before: field, province, a
//                  five-point average band, ambition, match count
//
// The exact average used to be the one number the site promised never to upload.
// A profile that follows you to another device is what an account is for, so it
// is uploaded now — but the promise it replaces was load-bearing, so:
//
//   - The UI says so. Any copy claiming "never uploaded" or "stays on your
//     device" had to change, and did (Survey, the dashboard rail, OverviewView,
//     CourseChecklist, the account pages).
//   - /api/data stays anonymous. It sends a band, not the average, and no
//     username and no token — so the telemetry rows cannot be joined to a
//     person even though the service now knows who some people are.
//   - Still no email, no real name, no age, no school. An account is a username
//     the student invented. That rule did not move.
//
// WHAT NEVER LEAVES: nothing else. There is no analytics, no third party, and no
// field on the wire that is not listed above.
//
// THE PASSWORD. It is sent, in the request body, over TLS, to /api/auth/signup
// and /api/auth/login, and the server hashes it on arrival with scrypt and stores
// only the hash (passwords.js in TheKeems/UniServer). It is never stored on the device, never
// put in a URL — a query string lands in server logs and browser history — never
// logged, and never retained in memory after the request that used it. The
// previous version hashed in the browser; that was the right call when there was
// nowhere to send it and is the wrong one now, because a server that accepts a
// client-computed digest has made the digest the password.

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'https://uniserver-632q.onrender.com')
  // A trailing slash would produce "//api/data", which Express treats as a
  // different route and 404s.
  .replace(/\/+$/, '')

// The free Render tier spins the service down when idle, and a cold start can
// take the better part of a minute.
const TIMEOUT_MS = 45_000

/* ------------------------------------------------------------------ types --- */

export type RemoteAccount = {
  id: string
  username: string
  createdAt: string
}

/** The profile as the server returns it — same shape the dashboard uses. */
export type RemoteProfile = {
  answers: {
    field: string
    province: string
    average: number | null
    ambition: string
  } | null
  shortlist: string[]
  courses: string[]
  notes: Record<string, string>
  tags: Record<string, string[]>
  savedAt: string | null
}

export type AuthResult = {
  token: string
  account: RemoteAccount
  profile: RemoteProfile | null
}

/**
 * A failed request, in the shape the forms need.
 *
 * `code` is the server's machine-readable reason, or one of two the client
 * invents when it never got an answer:
 *
 *   offline      the request did not arrive (no network, DNS, CORS)
 *   timeout      it arrived at nothing, or Render is still waking up
 *
 * Those two matter because they are the only failures where retrying the exact
 * same thing is the right move, and the only ones that are not the student's
 * fault.
 */
export class ApiError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }

  /** True when the request never got an answer, so retrying is worthwhile. */
  get isTransport(): boolean {
    return this.code === 'offline' || this.code === 'timeout' || this.status >= 500
  }
}

/* ------------------------------------------------------------- the request --- */

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  /** bearer token, for the routes that need one */
  token?: string
  /** shorter deadline for background work that must not wedge a queue */
  timeoutMs?: number
  signal?: AbortSignal
}

/**
 * One request. Resolves with the parsed body, or throws an ApiError.
 *
 * Every call in this file goes through here so that the timeout, the error
 * shaping and the "never log the body" rule are in one place rather than
 * repeated seven times with one copy subtly different.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = TIMEOUT_MS, signal } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  // Two ways to give up: the caller's signal (a component unmounting) and our
  // own deadline. `any` means whichever fires first wins, and neither has to
  // know about the other.
  const deadline = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combined,
      // No cookies, deliberately: the token travels in a header, so there is no
      // ambient credential to be sent along by a cross-site request.
      credentials: 'omit',
    })
  } catch (cause) {
    // fetch only rejects on network failure, abort, or CORS — never on a 4xx/5xx.
    // Nothing here logs `body`: it may hold a password.
    const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError'
    if (timedOut) {
      throw new ApiError("The server didn’t respond in time. It may be waking up.", 'timeout')
    }
    if (signal?.aborted) {
      throw new ApiError('Cancelled.', 'aborted')
    }
    throw new ApiError("Couldn’t reach the server. Check your connection.", 'offline')
  }

  if (response.status === 204) return undefined as T

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(
      error?.message ?? messageForStatus(response.status),
      error?.code ?? `http_${response.status}`,
      response.status,
    )
  }

  return payload as T
}

/** Fallback text for a server that failed without the usual error envelope. */
function messageForStatus(status: number): string {
  if (status === 401 || status === 403) return 'Please sign in again.'
  if (status === 404) return "That isn’t set up on the server yet."
  if (status === 429) return 'Too many tries. Wait a minute and try again.'
  if (status === 503) return 'The server is still waking up. Try again in a moment.'
  if (status >= 500) return 'Something went wrong on the server.'
  return `The server rejected the request (error ${status}).`
}

/* ------------------------------------------------------------------- auth --- */

export function createAccount(username: string, password: string): Promise<AuthResult> {
  return request<AuthResult>('/api/auth/signup', {
    method: 'POST',
    body: { username, password },
  })
}

export function authenticate(username: string, password: string): Promise<AuthResult> {
  return request<AuthResult>('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  })
}

/** Confirm a stored token is still good, and get the account it belongs to. */
export function fetchAccount(token: string): Promise<{ account: RemoteAccount }> {
  // Short deadline: this runs on page load behind a UI that has already rendered
  // from cache, so it must not hold anything up for 45 seconds.
  return request<{ account: RemoteAccount }>('/api/auth/me', { token, timeoutMs: 12_000 })
}

export async function changeRemotePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await request<void>('/api/auth/password', {
    method: 'POST',
    token,
    body: { currentPassword, newPassword },
  })
}

export async function deleteRemoteAccount(token: string): Promise<void> {
  await request<void>('/api/account', { method: 'DELETE', token })
}

/* ---------------------------------------------------------------- profile --- */

export async function fetchProfile(token: string): Promise<RemoteProfile | null> {
  const { profile } = await request<{ profile: RemoteProfile | null }>('/api/profile', {
    token,
    timeoutMs: 20_000,
  })
  return profile
}

/**
 * Replace the stored profile.
 *
 * PUT of the whole thing rather than a patch: the device holds the working copy
 * and this is its backup, so a merge on the server is a way to end up with a
 * shortlist that is neither copy. Last write wins, and `savedAt` carries the
 * client's clock so the server can record which write it was.
 */
export async function pushProfile(
  token: string,
  profile: {
    answers: unknown
    shortlist: string[]
    courses: string[]
    notes: Record<string, string>
    tags: Record<string, string[]>
    savedAt: string
  },
): Promise<RemoteProfile | null> {
  const { profile: saved } = await request<{ profile: RemoteProfile | null }>('/api/profile', {
    method: 'PUT',
    token,
    body: profile,
    // Shorter than the full cold-start allowance: this runs on a debounce in the
    // background, and a 45-second in-flight push would stack up behind itself.
    timeoutMs: 25_000,
  })
  return saved
}

/* ------------------------------------------------------------- telemetry --- */

export type SurveyTelemetry = {
  field: string
  province: string
  /** coarse band such as '85-89' — never the exact average */
  averageBand: string
  ambition: string
  /** how many programs the answers matched, to see whether the funnel works */
  matchCount: number
}

/**
 * Send anonymous survey answers.
 *
 * Deliberately takes no token and adds no username. This is the one endpoint
 * whose rows must stay unlinkable to an account: it is telemetry about whether
 * the funnel works, not a record of what a person answered. The profile routes
 * above are where a signed-in student's answers go.
 *
 * Callers should treat a rejection as non-fatal — the shortlist is already
 * computed and saved locally by the time this runs.
 */
export async function submitSurvey(answers: SurveyTelemetry): Promise<unknown> {
  const result = await request<unknown>('/api/data', {
    method: 'POST',
    body: { ...answers, submittedAt: new Date().toISOString() },
  })
  console.log('Sent data')
  return result
}

/** Whether the service is up, for the "server is asleep" states. */
export async function checkHealth(): Promise<boolean> {
  try {
    await request<unknown>('/api/health', { timeoutMs: 8_000 })
    return true
  } catch {
    return false
  }
}
