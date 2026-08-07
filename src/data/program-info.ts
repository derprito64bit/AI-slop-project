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
  /** courses the page recommends but does not require */
  recommendedCourses?: string[]
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

  // Waterloo's CS page covers the program with and without co-op, so the same
  // requirements apply to both dataset entries.
  'waterloo::computer-science': {
    programId: 'waterloo::computer-science',
    requiredCourses: [
      'Advanced Functions',
      'Calculus and Vectors',
      'Any Grade 12 U English',
      'One other 4U course',
    ],
    statedAverage: 'Admission average in the low to mid-90s, through individual selection',
    coop: 'Available as a co-op program',
    supplementary: 'Admission Information Form (AIF) required',
    sources: [
      {
        label: 'Computer Science — University of Waterloo',
        url: 'https://uwaterloo.ca/future-students/programs/computer-science',
      },
    ],
    verified: '2026-08-07',
  },

  'waterloo::computer-science-co-op': {
    programId: 'waterloo::computer-science-co-op',
    requiredCourses: [
      'Advanced Functions',
      'Calculus and Vectors',
      'Any Grade 12 U English',
      'One other 4U course',
    ],
    statedAverage: 'Admission average in the low to mid-90s, through individual selection',
    coop: 'Available as a co-op program',
    supplementary: 'Admission Information Form (AIF) required',
    sources: [
      {
        label: 'Computer Science — University of Waterloo',
        url: 'https://uwaterloo.ca/future-students/programs/computer-science',
      },
    ],
    verified: '2026-08-07',
  },

  // --- Queen's. All three below come from one Ontario requirements page. ---

  'queens::health-science': {
    programId: 'queens::health-science',
    requiredCourses: [
      'English 4U (minimum 80%)',
      'Biology 4U',
      'Chemistry 4U',
      'Advanced Functions 4U or Calculus and Vectors 4U',
    ],
    minCourseGrade: 'Minimum 80% in English 4U',
    supplementary: 'Supplementary application mandatory',
    notes: ['Two additional courses may be 4U or 4M.'],
    sources: [
      {
        label: "Ontario admission requirements — Queen's University",
        url: 'https://www.queensu.ca/admission/applying/admission-requirements/ontario',
      },
    ],
    verified: '2026-08-07',
  },

  'queens::smith-engineering-common-first-year': {
    programId: 'queens::smith-engineering-common-first-year',
    requiredCourses: [
      'English 4U',
      'Calculus and Vectors 4U',
      'Chemistry 4U',
      'Physics 4U',
      'Advanced Functions 4U',
    ],
    notes: [
      'These requirements apply to all Smith Engineering programs listed, including Chemical, Civil, Computer, Mining, and Mechatronics and Robotics.',
    ],
    sources: [
      {
        label: "Ontario admission requirements — Queen's University",
        url: 'https://www.queensu.ca/admission/applying/admission-requirements/ontario',
      },
    ],
    verified: '2026-08-07',
  },

  'queens::smith-commerce': {
    programId: 'queens::smith-commerce',
    requiredCourses: [
      'English 4U',
      'Calculus and Vectors 4U',
      'One additional 4U Mathematics course',
    ],
    minCourseGrade: 'Minimum 80% in all three prerequisite courses',
    supplementary: 'Supplementary application mandatory',
    notes: [
      'Three additional courses may be 4U or 4M, with no more than two 4M courses from the same discipline.',
    ],
    sources: [
      {
        label: "Ontario admission requirements — Queen's University",
        url: 'https://www.queensu.ca/admission/applying/admission-requirements/ontario',
      },
    ],
    verified: '2026-08-07',
  },

  // --- Western ---

  'western::medical-science': {
    programId: 'western::medical-science',
    requiredCourses: [
      'English (ENG4U)',
      'Biology (SBI4U)',
      'Calculus and Vectors (MCV4U)',
      'Chemistry (SCH4U)',
    ],
    recommendedCourses: ['Physics (SPH4U)'],
    notes: [
      'Applicants who do not enter the Medical Sciences program in Year One can still apply to the BMSc through other pathways.',
    ],
    sources: [
      {
        label: 'Applying from Ontario high schools — BMSc, Western University',
        url: 'https://www.schulich.uwo.ca/bmsc/future-students/applying/from-ontario-high-schools.html',
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
export const UNIVERSITY_INFO: Record<string, UniversityInfo> = {
  queens: {
    id: 'queens',
    admissionsUrl: 'https://www.queensu.ca/admission/',
    admissionsEmail: 'admission@queensu.ca',
    admissionsPhone: '+1 613-533-6100',
    campuses: ['Kingston (Gordon Hall, 74 Union Street)'],
    sources: [
      { label: "Undergraduate Admission — Queen's University", url: 'https://www.queensu.ca/admission/' },
      { label: "Contact Queen's University", url: 'https://www.queensu.ca/contacts' },
    ],
    verified: '2026-08-07',
  },

  toronto: {
    id: 'toronto',
    campuses: ['St. George', 'Mississauga', 'Scarborough'],
    admissionsUrl: 'https://future.utoronto.ca/',
    sources: [
      { label: 'Fees — University of Toronto Future Students', url: 'https://future.utoronto.ca/finances/fees/' },
    ],
    verified: '2026-08-07',
  },

  mcmaster: {
    id: 'mcmaster',
    admissionsUrl: 'https://future.mcmaster.ca/',
    campuses: ['Hamilton (Student Services, Gilmour Hall 108)'],
    sources: [
      { label: 'Tuition & fees — McMaster Office of the Registrar', url: 'https://registrar.mcmaster.ca/tuition-fees/' },
    ],
    verified: '2026-08-07',
  },
}

export const getProgramInfo = (id: string): ProgramInfo | null => PROGRAM_INFO[id] ?? null
export const getUniversityInfo = (id: string): UniversityInfo | null => UNIVERSITY_INFO[id] ?? null
