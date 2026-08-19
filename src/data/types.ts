// Canonical data shapes. These mirror what scripts/build-data.mjs emits into
// src/data/generated/ — if you change one, change the other.

export type Decision = 'offer' | 'rejected' | 'waitlisted' | 'deferred'

export type University = {
  id: string
  name: string
  city: string
  province: string
  programCount: number
  reportCount: number
}

/** Distribution of averages among students who received an offer. */
export type AcceptedAverages = {
  min: number
  p25: number
  median: number
  p75: number
  max: number
}

export type Program = {
  /** `${universityId}::${slug}` */
  id: string
  universityId: string
  name: string
  slug: string
  field: string
  /** every report, regardless of decision or whether an average was given */
  totalReports: number
  counts: Record<Decision, number>
  /** offers that came with a usable average — the basis for `accepted` */
  sampleSize: number
  /**
   * True when sampleSize is below the reporting threshold. The UI must say
   * "not enough data yet" rather than present `accepted` as meaningful.
   */
  insufficientData: boolean
  cycles: string[]
  accepted: AcceptedAverages | null
}

/** One anonymous community-reported outcome. Never contains identifying data. */
export type CommunityStat = {
  /** program id */
  p: string
  /** university id */
  u: string
  d: Decision
  /** average, or null if not reported */
  a: number | null
  /** application cycle, e.g. "2025-2026" */
  c: string
}

/** Saved locally in the browser; no account required. */
export type UserProfile = {
  grades: { course: string; mark: number }[]
  interests: string[]
  tuitionMax?: number
  shortlist: string[]
}
