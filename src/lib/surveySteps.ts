// The survey's question order, and the one way a URL is allowed to point at a
// question inside it.
//
// This is here rather than in pages/Survey.tsx because the dashboard sends
// students *into* the survey at a specific question — BalanceView asks for the
// average and links straight to it — and the resolution of that link has to be
// testable. The repo's Vitest runs in node with no DOM, so a test cannot import
// a page that pulls in motion/react on the way. Survey.tsx re-exports STEPS, so
// every existing importer is unchanged.

export const STEPS = [
  'field',
  'coop',
  'province',
  'homeCity',
  'average',
  'courses',
  'gradYear',
  'ambition',
] as const
export type StepId = (typeof STEPS)[number]

/**
 * Resolve a `?step=` value to an index into STEPS.
 *
 * The param is an ID, never an index. `?step=4` has to miss: an index in a URL
 * points at a different question the moment one is added or reordered, and a
 * link a student bookmarked or a dashboard card hard-codes would then ask for
 * the wrong thing without anything looking broken.
 *
 * Everything unrecognised — an unknown id, a number, an empty value, no param
 * at all — falls back to the first question, which is what the survey did
 * before deep links existed. Out-of-range indices are the reason this cannot
 * just be `Number(raw)`: `STEPS[99]` is undefined, every `current === '…'` test
 * in Survey.tsx then fails, and the student gets a card with a progress bar, a
 * Next button and no question in it.
 */
export function stepIndexFromParam(raw: string | null | undefined): number {
  if (!raw) return 0
  // Widened to string[] rather than asserting `raw as StepId`: the whole point
  // of this call is that we do not yet know it is one.
  const i = (STEPS as readonly string[]).indexOf(raw)
  return i === -1 ? 0 : i
}
