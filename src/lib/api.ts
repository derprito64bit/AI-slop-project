// Client for the Node/Express backend.
//
// Adapted from James Zeng's version on TheKeems/AI-slop-project-survey. His
// request handling is kept as-is — the base-URL override, the trailing-slash
// strip, the long timeout for Render's cold start, and the note about fetch not
// rejecting on 4xx/5xx were all right. What changed is the payload.
//
// WHAT IS SENT: field of study, province preference, a coarse average band and
// the ambition setting. Nothing else.
//
// WHAT IS NOT SENT, deliberately: name, age, school, or the exact average. The
// original survey posted a name and an age from what is mostly an audience of
// minors, which is the one thing this project's rules forbid outright. The
// exact average stays in localStorage on the student's own device; only the
// five-point band leaves it, so a submission cannot be tied back to a
// transcript.
//
// This endpoint is telemetry, not the product. Nothing on the site reads from
// it, and every user-facing feature works with the request failing — which
// matters, because the free Render tier sleeps.

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'https://uniserver-632q.onrender.com')
  // A trailing slash would produce "//api/data", which Express treats as a
  // different route and 404s.
  .replace(/\/+$/, '')

// The free Render tier spins the service down when idle, and a cold start can
// take the better part of a minute.
const TIMEOUT_MS = 45_000

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
 * Send anonymous survey answers. Resolves on success; throws with a
 * user-presentable message otherwise.
 *
 * Callers should treat a rejection as non-fatal — the shortlist is already
 * computed and saved locally by the time this runs.
 */
export async function submitSurvey(answers: SurveyTelemetry): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...answers, submittedAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (cause) {
    // fetch only rejects on network failure, abort, or CORS — never on a 4xx/5xx.
    const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError'
    throw new Error(
      timedOut
        ? "The server didn't respond in time. It may be waking up."
        : "Couldn't reach the server.",
      { cause },
    )
  }

  if (!response.ok) {
    throw new Error(`The server rejected the submission (error ${response.status}).`)
  }

  // The endpoint answers with JSON today, but don't fail a successful upload
  // just because the body wasn't parseable — the data is already stored.
  return response.json().catch(() => null)
}
