import { FIELD_LABELS } from './profile'
import type { Program } from '../data/types'

// Field-level rollups of the catalogue.
//
// This lived inside FieldsView until the Overview needed the same sentence for
// the one field a student said they were interested in. It is here rather than
// copied because two versions of "how competitive is Engineering, really" that
// disagree is worse than either answer on its own.
//
// Pure and dependency-free on purpose: the repo's Vitest runs in node with no
// DOM, so anything that needs a test has to be reachable without rendering.

export type FieldSummary = {
  key: string
  label: string
  programs: number
  reports: number
  withData: number
  /** median of the per-program medians — the middle of the field */
  midMedian: number | null
  lowMedian: number | null
  highMedian: number | null
  /** schools with at least one chartable program here, most-reported first */
  schools: Array<{ id: string; name: string; reports: number }>
}

export function summarise(programs: Program[], uniName: Map<string, string>): FieldSummary[] {
  const byField = new Map<string, Program[]>()
  for (const p of programs) {
    const list = byField.get(p.field)
    if (list) list.push(p)
    else byField.set(p.field, [p])
  }

  return Object.keys(FIELD_LABELS)
    .map((key) => {
      const list = byField.get(key) ?? []
      // Only programs with a usable median can describe a range. A field's
      // spread built from programs below the reporting threshold would be a
      // number with nothing behind it.
      const chartable = list.filter(
        (p) => !p.insufficientData && typeof p.accepted?.median === 'number',
      )
      const medians = chartable.map((p) => p.accepted!.median).sort((a, b) => a - b)

      // Schools are drawn from the CHARTABLE programs only. A mark here is a
      // claim that we have something to show you at that school in this field;
      // sourcing it from every program would put a logo against a school whose
      // only entry says "not enough data yet".
      const schoolReports = new Map<string, number>()
      for (const p of chartable) {
        schoolReports.set(p.universityId, (schoolReports.get(p.universityId) ?? 0) + p.totalReports)
      }

      return {
        key,
        label: FIELD_LABELS[key],
        programs: list.length,
        reports: list.reduce((n, p) => n + p.totalReports, 0),
        withData: medians.length,
        midMedian: medians.length ? medians[Math.floor(medians.length / 2)] : null,
        lowMedian: medians.length ? medians[0] : null,
        highMedian: medians.length ? medians[medians.length - 1] : null,
        schools: [...schoolReports.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id, reports]) => ({ id, name: uniName.get(id) ?? id, reports })),
      }
    })
    .filter((f) => f.programs > 0)
    .sort((a, b) => b.reports - a.reports)
}

/**
 * The summary for one field, or null.
 *
 * `''` is a real answer — it is what a skipped question stores — so it has to
 * miss rather than throw or match the first field alphabetically.
 */
export function fieldSummaryFor(fields: FieldSummary[], key: string): FieldSummary | null {
  if (!key) return null
  return fields.find((f) => f.key === key) ?? null
}
