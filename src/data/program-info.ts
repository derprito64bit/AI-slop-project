// Hand-researched program and university facts, sourced from official
// university websites.
//
// RULES FOR THIS FILE — the whole site's credibility rests on them:
//  1. Every field must come from an official university page. Never from
//     memory, never from a search snippet, never inferred from a similar
//     program. Search summaries have already been caught contradicting the
//     official page (see the McMaster note below).
//  2. Every entry carries `sources` (the exact pages used) and `verified`
//     (the date those pages were read). The UI shows both.
//  3. Missing is better than wrong. If a page doesn't state something, leave
//     the field out — the UI renders an explicit "not verified yet" state
//     rather than a guess.
//  4. This data goes stale. Requirements and fees change yearly; re-check
//     anything whose `verified` date is more than a year old.

export type Source = { label: string; url: string }

export type ProgramInfo = {
  /** matches Program.id — `${universityId}::${slug}` */
  programId: string
  /** Ontario 4U/4M courses the official page lists as required */
  requiredCourses?: string[]
  /** minimum grade per required course, as stated */
  minCourseGrade?: string
  /** admission average as the university states it — never our own estimate */
  statedAverage?: string
  lengthYears?: string
  coop?: string
  supplementary?: string
  notes?: string[]
  sources: Source[]
  /** ISO date the sources were read */
  verified: string
}

export type UniversityInfo = {
  id: string
  campuses?: string[]
  admissionsUrl?: string
  admissionsEmail?: string
  admissionsPhone?: string
  tuition?: { summary: string; year: string }
  sources: Source[]
  verified: string
}

// ---------------------------------------------------------------- programs

export const PROGRAM_INFO: Record<string, ProgramInfo> = {
  'waterloo::engineering': {
    programId: 'waterloo::engineering',
    requiredCourses: ['English', 'Physics', 'Chemistry', 'Advanced Functions', 'Calculus & Vectors'],
    minCourseGrade: '70% per course, unless otherwise stated',
    supplementary: 'Admission Information Form (AIF) required; online interview submissions also considered',
    notes: [
      'The Engineering Admissions Committee considers grades alongside the AIF and interview submissions.',
    ],
    sources: [
      {
        label: 'Admission requirements — Engineering, University of Waterloo',
        url: 'https://uwaterloo.ca/engineering/future-students/applying/admission-requirements',
      },
    ],
    verified: '2026-08-07',
  },

  'mcmaster::engineering-i-co-op': {
    programId: 'mcmaster::engineering-i-co-op',
    // NOTE: a search snippet claimed "MCV4U plus two of SBI4U/SCH4U/SPH4U" at a
    // 90% minimum. The official Faculty of Engineering page states the four
    // courses below at +87%. The official page wins.
    requiredCourses: ['English', 'Calculus & Vectors', 'Chemistry', 'Physics'],
    statedAverage: 'Anticipated admission range +87%',
    supplementary: 'Supplementary application required',
    lengthYears: '4 years; 5 years for Engineering & Management and Engineering & Society',
    coop: 'Co-op available, starting as early as the summer after first year',
    sources: [
      {
        label: 'How to apply — McMaster Faculty of Engineering',
        url: 'https://www.eng.mcmaster.ca/future-students/future-undergraduate-students/how-to-apply/',
      },
      {
        label: 'Engineering — McMaster Future Students',
        url: 'https://future.mcmaster.ca/programs/engineering/',
      },
    ],
    verified: '2026-08-07',
  },
}

// ------------------------------------------------------------ universities

/**
 * University-level facts. City/province already come from the dataset; this
 * adds campuses, contact routes and fees, which need their own sourcing.
 * Deliberately sparse — entries are added as each is verified.
 */
export const UNIVERSITY_INFO: Record<string, UniversityInfo> = {}

export const getProgramInfo = (id: string): ProgramInfo | null => PROGRAM_INFO[id] ?? null
export const getUniversityInfo = (id: string): UniversityInfo | null => UNIVERSITY_INFO[id] ?? null
