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

/**
 * U of T Engineering publishes one prerequisite set for every stream and sorts
 * the streams into two competitive ranges. Rather than copy that block a dozen
 * times, this builds it — the source and wording stay identical across streams,
 * which is exactly what the page states.
 */
function UofTEng(programId: string, band: 'low' | 'high'): ProgramInfo {
  return {
    programId,
    requiredCourses: [
      'English (ENG4U)',
      'Advanced Functions (MHF4U)',
      'Calculus and Vectors (MCV4U)',
      'Chemistry (SCH4U)',
      'Physics (SPH4U)',
    ],
    statedAverage:
      band === 'low'
        ? 'Low to mid 90s — the range U of T states for Computer, Electrical, Engineering Science, TrackOne and Undeclared Engineering'
        : 'High 80s to low 90s — the range U of T states for Chemical, Civil, Industrial, Materials, Mechanical and Mineral Engineering',
    supplementary: 'Online Student Profile required, including short written responses and video submissions',
    notes: [
      'U of T states that meeting the minimum averages does not guarantee admission.',
      'Prerequisite courses must be completed within five years of the intended start date.',
    ],
    sources: [
      { label: 'FAQs — Future Engineering Undergraduates, University of Toronto', url: 'https://discover.engineering.utoronto.ca/faqs/' },
      { label: 'Academic Requirements — U of T Engineering', url: 'https://discover.engineering.utoronto.ca/admission-requirements/' },
    ],
    verified: '2026-08-07',
  }
}

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

  // Waterloo's engineering streams share the same five prerequisites at 70%,
  // but each program page states its own admission range and co-op status, so
  // each is recorded from its own page rather than inherited from the faculty.
  'waterloo::mechanical-engineering': {
    programId: 'waterloo::mechanical-engineering',
    requiredCourses: [
      'Advanced Functions',
      'Calculus and Vectors',
      'Chemistry',
      'Physics',
      'English (ENG4U)',
    ],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the high 80s to low 90s',
    coop: 'Co-op only — a regular study option is not available',
    supplementary: 'Admission Information Form (AIF) required',
    sources: [
      {
        label: 'Mechanical Engineering — University of Waterloo',
        url: 'https://uwaterloo.ca/future-students/programs/mechanical-engineering',
      },
    ],
    verified: '2026-08-07',
  },

  'waterloo::computer-engineering': {
    programId: 'waterloo::computer-engineering',
    requiredCourses: [
      'Advanced Functions',
      'Calculus and Vectors',
      'Chemistry',
      'Physics',
      'English (ENG4U)',
    ],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the high 80s to low 90s',
    coop: 'Co-op only — not available as a regular program',
    supplementary: 'Admission Information Form (AIF) required',
    sources: [
      {
        label: 'Computer Engineering — University of Waterloo',
        url: 'https://uwaterloo.ca/future-students/programs/computer-engineering',
      },
    ],
    verified: '2026-08-07',
  },

  'waterloo::electrical-engineering': {
    programId: 'waterloo::electrical-engineering',
    requiredCourses: [
      'Advanced Functions',
      'Calculus and Vectors',
      'Physics',
      'Chemistry',
      'English (ENG4U)',
    ],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the high 80s to low 90s',
    coop: 'Co-op only — not available as a regular program',
    sources: [
      {
        label: 'Electrical Engineering — University of Waterloo',
        url: 'https://uwaterloo.ca/future-students/programs/electrical-engineering',
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

  // --- U of T Engineering. One FAQ page states the prerequisites plus two
  // distinct competitive ranges depending on the stream. ---

  'toronto::engineering-science': {
    programId: 'toronto::engineering-science',
    requiredCourses: [
      'English (ENG4U)',
      'Advanced Functions (MHF4U)',
      'Calculus and Vectors (MCV4U)',
      'Chemistry (SCH4U)',
      'Physics (SPH4U)',
    ],
    statedAverage: 'Low to mid 90s — the range stated for Engineering Science, Computer, Electrical, TrackOne and Undeclared Engineering',
    supplementary: 'Online Student Profile required, including short written responses and video submissions',
    notes: [
      'U of T states that meeting the minimum averages does not guarantee admission.',
      'Prerequisite courses must be completed within five years of the intended start date.',
    ],
    sources: [
      { label: 'FAQs — Future Engineering Undergraduates, University of Toronto', url: 'https://discover.engineering.utoronto.ca/faqs/' },
      { label: 'Academic Requirements — U of T Engineering', url: 'https://discover.engineering.utoronto.ca/admission-requirements/' },
    ],
    verified: '2026-08-07',
  },

  'toronto::computer-engineering': {
    programId: 'toronto::computer-engineering',
    requiredCourses: [
      'English (ENG4U)',
      'Advanced Functions (MHF4U)',
      'Calculus and Vectors (MCV4U)',
      'Chemistry (SCH4U)',
      'Physics (SPH4U)',
    ],
    statedAverage: 'Low to mid 90s — the range stated for Computer, Electrical, Engineering Science, TrackOne and Undeclared Engineering',
    supplementary: 'Online Student Profile required, including short written responses and video submissions',
    notes: [
      'U of T states that meeting the minimum averages does not guarantee admission.',
      'Prerequisite courses must be completed within five years of the intended start date.',
    ],
    sources: [
      { label: 'FAQs — Future Engineering Undergraduates, University of Toronto', url: 'https://discover.engineering.utoronto.ca/faqs/' },
    ],
    verified: '2026-08-07',
  },

  // The U of T Engineering FAQ names each stream against one of two competitive
  // ranges, so the streams below come from that single page. The PEY co-op
  // variants are the same programs with the co-op option, not separate
  // admissions.
  'toronto::electrical-engineering': UofTEng('toronto::electrical-engineering', 'low'),
  'toronto::trackone-undeclared-engineering': UofTEng('toronto::trackone-undeclared-engineering', 'low'),
  'toronto::engineering-science-including-pey-co-op-option': UofTEng('toronto::engineering-science-including-pey-co-op-option', 'low'),
  'toronto::computer-engineering-including-pey-co-op-option': UofTEng('toronto::computer-engineering-including-pey-co-op-option', 'low'),
  'toronto::mechanical-engineering': UofTEng('toronto::mechanical-engineering', 'high'),
  'toronto::chemical-engineering': UofTEng('toronto::chemical-engineering', 'high'),
  'toronto::civil-engineering': UofTEng('toronto::civil-engineering', 'high'),
  'toronto::industrial-engineering': UofTEng('toronto::industrial-engineering', 'high'),

  'toronto::rotman-commerce': {
    programId: 'toronto::rotman-commerce',
    requiredCourses: [
      'English 4U (ENG4U)',
      'Calculus & Vectors 4U (MCV4U)',
      'Six Grade 12 U/M subjects in total',
    ],
    statedAverage:
      'An overall average of all Grade 11 and 12 courses in the mid-high 80s or above is recommended',
    supplementary: 'Rotman Commerce Supplemental Application required',
    sources: [
      {
        label: 'Ontario High School Applicants — Rotman Commerce',
        url: 'https://rotmancommerce.utoronto.ca/future-students/ontario-applicants/',
      },
    ],
    verified: '2026-08-07',
  },

  // Laurier publishes a consistent per-program page with explicit minimums.
  'laurier::business-administration-bba': {
    programId: 'laurier::business-administration-bba',
    requiredCourses: [
      'Advanced Functions at 70%',
      'English at 70%',
      'One of Calculus and Vectors or Data Management at 60%',
    ],
    statedAverage: 'Admission average: high 80s',
    lengthYears: '4 years',
    coop: 'Co-op available — apply in first year; three four-month work terms (12 months total) between second and fourth year',
    sources: [
      {
        label: 'Business Administration (BBA) — Wilfrid Laurier University',
        url: 'https://www.wlu.ca/programs/business-and-economics/undergraduate/business-administration-bba/index.html',
      },
    ],
    verified: '2026-08-07',
  },

  'laurier::health-science': {
    programId: 'laurier::health-science',
    requiredCourses: [
      'English at 60%',
      'Advanced Functions at 60%',
      'Biology at 60%',
      'Chemistry at 60%',
    ],
    statedAverage: 'Average admission range: low 80s',
    lengthYears: '4 years',
    sources: [
      {
        label: 'Health Sciences (BSc) — Wilfrid Laurier University',
        url: 'https://www.wlu.ca/programs/science/undergraduate/health-sciences-bsc/index.html',
      },
    ],
    verified: '2026-08-07',
  },

  // NOTE: a search summary gave "SCH4U or SPH4U", a 75% math average and a 78%
  // offer-maintenance average. The Lassonde page states Chemistry AND Physics
  // at 70% each and a low-80s admission average. The official page wins.
  'york::engineering': {
    programId: 'york::engineering',
    requiredCourses: [
      'English (ENG4U)',
      'Chemistry (SCH4U)',
      'Physics (SPH4U)',
      'Advanced Functions (MHF4U)',
      'Calculus & Vectors (MCV4U)',
      'One additional 4U/M course',
    ],
    minCourseGrade: 'Minimum 70% in each prerequisite',
    statedAverage: 'Low 80s',
    sources: [
      { label: 'Admission Requirements — Lassonde School of Engineering, York University', url: 'https://lassonde.yorku.ca/discover/program-requirements' },
    ],
    verified: '2026-08-07',
  },

  'york::nursing-direct-entry': {
    programId: 'york::nursing-direct-entry',
    requiredCourses: [
      'ENG4U',
      '4U Math',
      'SBI4U',
      'SCH4U or SPH4U',
      'Two additional 4U/4M courses',
    ],
    minCourseGrade: 'At least 70% in each prerequisite',
    statedAverage: 'Overall average in at least the high 80s',
    notes: [
      'York states that meeting the minimum admission requirements does not guarantee admission, and that competitive applicants typically present grades in the high 80s or above in prerequisite courses.',
    ],
    sources: [
      { label: 'Direct Entry Nursing Program — Faculty of Health, York University', url: 'https://www.yorku.ca/health/direct-entry-nursing/' },
    ],
    verified: '2026-08-07',
  },

  'york::schulich-bba': {
    programId: 'york::schulich-bba',
    requiredCourses: ['ENG4U', 'MHF4U', 'MCV4U or MDM4U'],
    minCourseGrade: 'Minimum 70% in ENG4U and MHF4U',
    statedAverage:
      'Aim for a Grade 12 GPA in the high 80s to low 90s; the minimum cutoff in past years has ranged between 91% and 92%',
    supplementary: 'Schulich Supplementary Application required, alongside the OUAC application',
    notes: ['Required courses must form part of the applicant’s top six Grade 12 courses.'],
    sources: [
      {
        label: 'BBA Admission Requirements — Schulich School of Business',
        url: 'https://schulich.yorku.ca/admissions/admissions-requirements/bba/',
      },
    ],
    verified: '2026-08-07',
  },

  'queens::life-science-and-biochemistry': {
    programId: 'queens::life-science-and-biochemistry',
    requiredCourses: ['English 4U', 'Calculus and Vectors 4U', 'Biology 4U', 'Chemistry 4U'],
    notes: ['Two additional courses may be 4U or 4M.'],
    sources: [
      {
        label: "Ontario admission requirements — Queen's University",
        url: 'https://www.queensu.ca/admission/applying/admission-requirements/ontario',
      },
    ],
    verified: '2026-08-07',
  },

  'queens::computing': {
    programId: 'queens::computing',
    requiredCourses: ['English 4U', 'Advanced Functions 4U', 'Calculus and Vectors 4U'],
    notes: ['Three additional courses may be 4U or 4M.'],
    sources: [
      {
        label: "Ontario admission requirements — Queen's University",
        url: 'https://www.queensu.ca/admission/applying/admission-requirements/ontario',
      },
    ],
    verified: '2026-08-07',
  },

  'queens::nursing': {
    programId: 'queens::nursing',
    requiredCourses: [
      'English 4U (minimum 75%)',
      'Biology 4U',
      'Chemistry 4U',
      'Any 4U Mathematics course',
    ],
    minCourseGrade: 'Minimum 75% in English 4U',
    supplementary: 'Mandatory supplementary application',
    notes: ['Two additional courses may be 4U or 4M.'],
    sources: [
      {
        label: "Ontario admission requirements — Queen's University",
        url: 'https://www.queensu.ca/admission/applying/admission-requirements/ontario',
      },
    ],
    verified: '2026-08-07',
  },

  'queens::science': {
    programId: 'queens::science',
    requiredCourses: [
      'English 4U',
      'Calculus and Vectors 4U',
      'Two of: Biology 4U, Chemistry 4U, or Physics 4U',
    ],
    notes: ['Two additional courses may be 4U or 4M.'],
    sources: [
      {
        label: "Ontario admission requirements — Queen's University",
        url: 'https://www.queensu.ca/admission/applying/admission-requirements/ontario',
      },
    ],
    verified: '2026-08-07',
  },

  'queens::art': {
    programId: 'queens::art',
    requiredCourses: ['English 4U'],
    notes: ['Five additional courses may be either 4U or 4M.'],
    sources: [
      {
        label: "Ontario admission requirements — Queen's University",
        url: 'https://www.queensu.ca/admission/applying/admission-requirements/ontario',
      },
    ],
    verified: '2026-08-07',
  },

  // --- Western ---

  'waterloo::software-engineering': {
    programId: 'waterloo::software-engineering',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Chemistry', 'Physics', 'English (ENG4U)'],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the low to mid-90s',
    coop: 'Co-op only — not available as a regular program',
    supplementary: 'Admission Information Form (AIF) required',
    sources: [{ label: 'Software Engineering — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/software-engineering' }],
    verified: '2026-08-07',
  },

  'waterloo::mechatronic-engineering': {
    programId: 'waterloo::mechatronic-engineering',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Chemistry', 'English (ENG4U)', 'Physics'],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the high 80s to low 90s',
    coop: 'Co-op only — not available as a regular program',
    sources: [{ label: 'Mechatronics Engineering — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/mechatronics-engineering' }],
    verified: '2026-08-07',
  },

  'waterloo::biomedical-engineering': {
    programId: 'waterloo::biomedical-engineering',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Chemistry', 'Physics', 'English (ENG4U)'],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the high 80s to low 90s',
    coop: 'Co-op only — not available as a regular program',
    sources: [{ label: 'Biomedical Engineering — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/biomedical-engineering' }],
    verified: '2026-08-07',
  },

  'waterloo::civil-engineering': {
    programId: 'waterloo::civil-engineering',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Chemistry', 'Physics', 'English (ENG4U)'],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the mid-to-high 80s',
    coop: 'Co-op only',
    sources: [{ label: 'Civil Engineering — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/civil-engineering' }],
    verified: '2026-08-07',
  },

  'waterloo::electrical-engineering-co-op-only': {
    programId: 'waterloo::electrical-engineering-co-op-only',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Physics', 'Chemistry', 'English (ENG4U)'],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the high 80s to low 90s',
    coop: 'Co-op only — not available as a regular program',
    sources: [{ label: 'Electrical Engineering — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/electrical-engineering' }],
    verified: '2026-08-07',
  },

  'waterloo::computing-and-financial-management': {
    programId: 'waterloo::computing-and-financial-management',
    requiredCourses: [
      'Any Grade 12 U English',
      'Advanced Functions',
      'Calculus and Vectors',
      'One other Grade 12 U course',
    ],
    minCourseGrade: 'Minimum final grade of 75% in English',
    statedAverage: 'Individual selection from the low to mid-90s',
    coop: 'Co-op only — not available as a regular program',
    sources: [{ label: 'Computing and Financial Management — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/computing-and-financial-management' }],
    verified: '2026-08-07',
  },

  // One Waterloo page covers Physical Sciences in both study systems.
  'waterloo::physical-science': {
    programId: 'waterloo::physical-science',
    requiredCourses: [
      'English (ENG4U)',
      'Advanced Functions',
      'Calculus and Vectors',
      'Two of: Biology, Chemistry, Earth and Space Science, Mathematics of Data Management, Physics',
    ],
    minCourseGrade: 'Minimum final grade of 70% in English, Advanced Functions and Calculus and Vectors',
    statedAverage: 'Low 80s',
    coop: 'Each major is available through both co-op and regular study, except Medicinal Chemistry which is co-op only',
    sources: [{ label: 'Physical Sciences — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/physical-sciences' }],
    verified: '2026-08-07',
  },

  'waterloo::physical-science-co-op': {
    programId: 'waterloo::physical-science-co-op',
    requiredCourses: [
      'English (ENG4U)',
      'Advanced Functions',
      'Calculus and Vectors',
      'Two of: Biology, Chemistry, Earth and Space Science, Mathematics of Data Management, Physics',
    ],
    minCourseGrade: 'Minimum final grade of 70% in English, Advanced Functions and Calculus and Vectors',
    statedAverage: 'Low 80s',
    coop: 'Each major is available through both co-op and regular study, except Medicinal Chemistry which is co-op only',
    sources: [{ label: 'Physical Sciences — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/physical-sciences' }],
    verified: '2026-08-07',
  },

  'waterloo::mathematic-co-op-and-regular': {
    programId: 'waterloo::mathematic-co-op-and-regular',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Any 4U English', 'One other 4U course'],
    statedAverage: 'Individual selection from the mid-80s',
    coop: 'Available as both a co-op and a regular program',
    supplementary: 'Admission Information Form (AIF) required',
    sources: [{ label: 'Mathematics — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/mathematics' }],
    verified: '2026-08-07',
  },

  'waterloo::life-science-co-op': {
    programId: 'waterloo::life-science-co-op',
    requiredCourses: [
      'English (ENG4U)',
      'Advanced Functions',
      'Calculus and Vectors',
      'Two of: Biology, Chemistry, Earth and Space Science, Mathematics of Data Management, Physics',
    ],
    minCourseGrade: 'Minimum final grade of 70% in English, Advanced Functions and Calculus and Vectors',
    statedAverage: 'Low 80s',
    coop: 'Applicants choose between the co-op program and the regular system of study',
    sources: [{ label: 'Life Sciences — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/life-sciences' }],
    verified: '2026-08-07',
  },

  'waterloo::life-science': {
    programId: 'waterloo::life-science',
    requiredCourses: [
      'English (ENG4U)',
      'Advanced Functions',
      'Calculus and Vectors',
      'Two of: Biology, Chemistry, Earth and Space Science, Mathematics of Data Management, Physics',
    ],
    minCourseGrade: 'Minimum final grade of 70% in English, Advanced Functions and Calculus and Vectors',
    statedAverage: 'Low 80s',
    coop: 'Applicants choose between the co-op program and the regular system of study',
    sources: [{ label: 'Life Sciences — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/life-sciences' }],
    verified: '2026-08-07',
  },

  // The dataset separates the co-op-only spellings of these programs; Waterloo
  // publishes one page per program covering both, so the same source applies.
  'waterloo::computer-engineering-co-op-only': {
    programId: 'waterloo::computer-engineering-co-op-only',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Chemistry', 'Physics', 'English (ENG4U)'],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the high 80s to low 90s',
    coop: 'Co-op only — not available as a regular program',
    sources: [{ label: 'Computer Engineering — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/computer-engineering' }],
    verified: '2026-08-07',
  },

  'waterloo::mechatronic-engineering-co-op-only': {
    programId: 'waterloo::mechatronic-engineering-co-op-only',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Chemistry', 'English (ENG4U)', 'Physics'],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the high 80s to low 90s',
    coop: 'Co-op only — not available as a regular program',
    sources: [{ label: 'Mechatronics Engineering — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/mechatronics-engineering' }],
    verified: '2026-08-07',
  },

  'waterloo::software-engineering-co-op-only': {
    programId: 'waterloo::software-engineering-co-op-only',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Chemistry', 'Physics', 'English (ENG4U)'],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the low to mid-90s',
    coop: 'Co-op only — not available as a regular program',
    supplementary: 'Admission Information Form (AIF) required',
    sources: [{ label: 'Software Engineering — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/software-engineering' }],
    verified: '2026-08-07',
  },

  'waterloo::computer-science-co-op-and-regular': {
    programId: 'waterloo::computer-science-co-op-and-regular',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Any Grade 12 U English', 'One other 4U course'],
    statedAverage: 'Admission average in the low to mid-90s, through individual selection',
    coop: 'Available as a co-op program',
    supplementary: 'Admission Information Form (AIF) required',
    sources: [{ label: 'Computer Science — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/computer-science' }],
    verified: '2026-08-07',
  },

  'waterloo::management-engineering': {
    programId: 'waterloo::management-engineering',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Chemistry', 'Physics', 'English (ENG4U)'],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the mid-to-high 80s',
    coop: 'Co-op only — not available as a regular program',
    notes: ['Six Grade 12 U and/or M courses required in total.'],
    sources: [{ label: 'Management Engineering — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/management-engineering' }],
    verified: '2026-08-07',
  },

  'waterloo::system-design-engineering': {
    programId: 'waterloo::system-design-engineering',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Chemistry', 'Physics', 'English (ENG4U)'],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the high 80s to low 90s',
    coop: 'Co-op only — not available as a regular program',
    notes: ['Six Grade 12 U and/or M courses required in total.'],
    sources: [{ label: 'Systems Design Engineering — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/systems-design-engineering' }],
    verified: '2026-08-07',
  },

  'waterloo::chemical-engineering': {
    programId: 'waterloo::chemical-engineering',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Chemistry', 'Physics', 'English (ENG4U)'],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Individual selection from the mid-to-high 80s',
    coop: 'Co-op only — no regular option',
    notes: ['Six Grade 12 U and/or M courses required in total.'],
    sources: [{ label: 'Chemical Engineering — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/chemical-engineering' }],
    verified: '2026-08-07',
  },

  'waterloo::planning': {
    programId: 'waterloo::planning',
    requiredCourses: ['Any Grade 12 U English'],
    minCourseGrade: 'Minimum final grade of 75% in English',
    statedAverage: 'Low 80s',
    coop: 'Co-op only — not available as a regular program',
    notes: ['Six Grade 12 U and/or M courses required in total.'],
    sources: [{ label: 'Planning — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/planning' }],
    verified: '2026-08-07',
  },

  'waterloo::accounting-and-financial-management': {
    programId: 'waterloo::accounting-and-financial-management',
    requiredCourses: [
      'Any Grade 12 U English',
      'Advanced Functions',
      'Calculus and Vectors',
    ],
    minCourseGrade: 'Minimum final grade of 75% in each required course',
    statedAverage: 'Mid-80s',
    coop: 'Co-op only — not available in a regular format',
    sources: [{ label: 'Accounting and Financial Management — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/accounting-and-financial-management' }],
    verified: '2026-08-07',
  },

  'waterloo::mathematic-co-op': {
    programId: 'waterloo::mathematic-co-op',
    requiredCourses: ['Advanced Functions', 'Calculus and Vectors', 'Any 4U English', 'One other 4U course'],
    statedAverage: 'Individual selection from the mid-80s',
    coop: 'Available as both a co-op and a regular program',
    supplementary: 'Admission Information Form (AIF) required',
    sources: [{ label: 'Mathematics — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/mathematics' }],
    verified: '2026-08-07',
  },

  // One Waterloo page covers Health Sciences in both study systems, so it
  // applies to the co-op and regular dataset entries alike.
  'waterloo::health-science': {
    programId: 'waterloo::health-science',
    requiredCourses: [
      'Any Grade 12 U English',
      'Any Grade 12 U Mathematics',
      'Biology',
      'Chemistry',
    ],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Mid 80s (regular) and high 80s (co-op)',
    lengthYears: '4 years regular; 5 years co-op',
    coop: 'Available in both systems; co-op takes five years and includes 20 months of paid work experience',
    sources: [{ label: 'Health Sciences — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/health-sciences' }],
    verified: '2026-08-07',
  },

  'waterloo::health-science-co-op': {
    programId: 'waterloo::health-science-co-op',
    requiredCourses: [
      'Any Grade 12 U English',
      'Any Grade 12 U Mathematics',
      'Biology',
      'Chemistry',
    ],
    minCourseGrade: 'Minimum final grade of 70% in each required course',
    statedAverage: 'Mid 80s (regular) and high 80s (co-op)',
    lengthYears: '5 years for co-op',
    coop: 'Co-op takes five years and includes 20 months of paid work experience',
    sources: [{ label: 'Health Sciences — University of Waterloo', url: 'https://uwaterloo.ca/future-students/programs/health-sciences' }],
    verified: '2026-08-07',
  },

  // TMU publishes a consistent per-program page: prerequisites with per-course
  // minimums, an overall average floor, and the previous year's range — which
  // it explicitly notes can fluctuate year to year.
  'tmu::biomedical-science': {
    programId: 'tmu::biomedical-science',
    requiredCourses: [
      'English/anglais (ENG4U/EAE4U preferred)',
      'Advanced Functions (MHF4U)',
      'Two of: Physics (SPH4U), Chemistry (SCH4U) or Biology (SBI4U)',
    ],
    minCourseGrade: 'Minimum 70% in each required course',
    statedAverage: 'Overall average of 70% required for consideration; previous year’s range mid 80s',
    notes: [
      'A "Grades-Only" program — admission decisions are based on academic performance.',
      'TMU notes the average needed for admission can fluctuate each year.',
    ],
    sources: [{ label: 'Biomedical Sciences — Toronto Metropolitan University', url: 'https://www.torontomu.ca/programs/undergraduate/biomedical-sciences/' }],
    verified: '2026-08-07',
  },

  'tmu::computer-science': {
    programId: 'tmu::computer-science',
    requiredCourses: [
      'English/anglais (ENG4U/EAE4U preferred)',
      'Advanced Functions (MHF4U)',
      'One of: Calculus and Vectors (MCV4U, preferred) or Mathematics of Data Management (MDM4U)',
      'One of: Physics (SPH4U), Chemistry (SCH4U) or Biology (SBI4U)',
    ],
    minCourseGrade: 'Minimum 70% in each required course',
    statedAverage: 'Overall average of 70% across six Grade 12 U/M courses; previous year’s range low 80s',
    notes: ['TMU notes the average needed for admission can fluctuate each year.'],
    sources: [{ label: 'Computer Science — Toronto Metropolitan University', url: 'https://www.torontomu.ca/programs/undergraduate/computer-science/' }],
    verified: '2026-08-07',
  },

  'tmu::accounting-and-finance': {
    programId: 'tmu::accounting-and-finance',
    requiredCourses: [
      'English/anglais (ENG4U/EAE4U preferred)',
      'Advanced Functions (MHF4U)',
      'Calculus and Vectors (MCV4U)',
    ],
    minCourseGrade: 'Minimum 75% in each required course',
    statedAverage: 'Overall average of 70% required for consideration; previous year’s range mid 80s',
    sources: [{ label: 'Accounting & Finance — Toronto Metropolitan University', url: 'https://www.torontomu.ca/programs/undergraduate/accounting-finance/' }],
    verified: '2026-08-07',
  },

  'tmu::undeclared-engineering': {
    programId: 'tmu::undeclared-engineering',
    requiredCourses: [
      'English/anglais (ENG4U/EAE4U preferred)',
      'Advanced Functions (MHF4U)',
      'Calculus and Vectors (MCV4U)',
      'Physics (SPH4U)',
      'Chemistry (SCH4U)',
    ],
    minCourseGrade: 'Minimum 70% in each required course',
    statedAverage: 'Overall average of 70% required for consideration; previous year’s range high 80s',
    notes: ['TMU notes the average needed for admission can fluctuate each year.'],
    sources: [{ label: 'Undeclared Engineering — Toronto Metropolitan University', url: 'https://www.torontomu.ca/programs/undergraduate/undeclared-engineering/' }],
    verified: '2026-08-07',
  },

  'tmu::mechanical-engineering': {
    programId: 'tmu::mechanical-engineering',
    requiredCourses: [
      'English/anglais (ENG4U/EAE4U preferred)',
      'Advanced Functions (MHF4U)',
      'Calculus and Vectors (MCV4U)',
      'Physics (SPH4U)',
      'Chemistry (SCH4U)',
    ],
    minCourseGrade: 'Minimum 70% in each required course',
    statedAverage: 'Overall average of 70% required for consideration; previous year’s range high 80s',
    notes: ['TMU notes the average needed for admission can fluctuate each year.'],
    sources: [{ label: 'Mechanical Engineering — Toronto Metropolitan University', url: 'https://www.torontomu.ca/programs/undergraduate/mechanical-engineering/' }],
    verified: '2026-08-07',
  },

  'tmu::mechatronic-engineering': {
    programId: 'tmu::mechatronic-engineering',
    requiredCourses: [
      'English/anglais (ENG4U/EAE4U preferred)',
      'Advanced Functions (MHF4U)',
      'Calculus and Vectors (MCV4U)',
      'Physics (SPH4U)',
      'Chemistry (SCH4U)',
    ],
    minCourseGrade: 'Minimum 70% in each required course',
    statedAverage: 'Overall average of 70% required for consideration; previous year’s range high 80s',
    notes: ['TMU notes the average needed for admission can fluctuate each year.'],
    sources: [{ label: 'Mechatronics Engineering — Toronto Metropolitan University', url: 'https://www.torontomu.ca/programs/undergraduate/mechatronics-engineering/' }],
    verified: '2026-08-07',
  },

  'tmu::urban-and-regional-planning': {
    programId: 'tmu::urban-and-regional-planning',
    requiredCourses: ['English/anglais (ENG4U/EAE4U preferred)'],
    recommendedCourses: [
      'Grade 12 U/M courses in social sciences and humanities, economics, Canadian and world studies, science or mathematics',
    ],
    minCourseGrade: 'Minimum 70% in English',
    statedAverage: 'Six Grade 12 U/M courses with a minimum overall average of 70%; previous year’s range low 80s',
    notes: ['TMU notes the average needed for admission can fluctuate each year.'],
    sources: [{ label: 'Urban and Regional Planning — Toronto Metropolitan University', url: 'https://www.torontomu.ca/programs/undergraduate/urban-regional-planning/' }],
    verified: '2026-08-07',
  },

  'tmu::computer-engineering': {
    programId: 'tmu::computer-engineering',
    requiredCourses: [
      'English/anglais (ENG4U/EAE4U preferred)',
      'Advanced Functions (MHF4U)',
      'Calculus and Vectors (MCV4U)',
      'Physics (SPH4U)',
      'Chemistry (SCH4U)',
    ],
    minCourseGrade: 'Minimum 70% in each required course',
    statedAverage: 'Overall average of 70% required for consideration; previous year’s range high 80s',
    notes: ['TMU notes the average needed for admission can fluctuate each year.'],
    sources: [{ label: 'Computer Engineering — Toronto Metropolitan University', url: 'https://www.torontomu.ca/programs/undergraduate/computer-engineering/' }],
    verified: '2026-08-07',
  },

  'tmu::electrical-engineering': {
    programId: 'tmu::electrical-engineering',
    requiredCourses: [
      'English/anglais (ENG4U/EAE4U preferred)',
      'Advanced Functions (MHF4U)',
      'Calculus and Vectors (MCV4U)',
      'Physics (SPH4U)',
      'Chemistry (SCH4U)',
    ],
    minCourseGrade: 'Minimum 70% in each required course',
    statedAverage: 'Overall average of 70% required for consideration; previous year’s range high 80s',
    notes: ['TMU notes the average needed for admission can fluctuate each year.'],
    sources: [{ label: 'Electrical Engineering — Toronto Metropolitan University', url: 'https://www.torontomu.ca/programs/undergraduate/electrical-engineering/' }],
    verified: '2026-08-07',
  },

  'tmu::business-management': {
    programId: 'tmu::business-management',
    requiredCourses: [
      'English/anglais (ENG4U/EAE4U preferred)',
      'One of: Calculus and Vectors (MCV4U), Advanced Functions (MHF4U) or Mathematics of Data Management (MDM4U)',
    ],
    minCourseGrade: 'Minimum 70% in each required course',
    statedAverage: 'Overall average of 70% required for consideration; previous year’s range high 70s',
    notes: ['TMU notes the average needed for admission can fluctuate each year.'],
    sources: [{ label: 'Business Management — Toronto Metropolitan University', url: 'https://www.torontomu.ca/programs/undergraduate/business-management/' }],
    verified: '2026-08-07',
  },

  'tmu::nursing-at-tmu': {
    programId: 'tmu::nursing-at-tmu',
    requiredCourses: [
      'Grade 12 U English/anglais (ENG4U/EAE4U preferred)',
      'Grade 12 U Chemistry (SCH4U)',
      'Grade 12 U Biology (SBI4U)',
      'Grade 11 U/M or Grade 12 U Mathematics (one of MCF3M, MCR3U, MCV4U, MDM4U, MHF4U)',
    ],
    minCourseGrade: 'Minimum 70% in each required course',
    statedAverage: 'An overall average of 70% is required for consideration',
    supplementary: 'CASPER is explicitly not required for this program',
    sources: [
      {
        label: 'Nursing — Collaborative Program (BScN), Toronto Metropolitan University',
        url: 'https://www.torontomu.ca/programs/undergraduate/nursing-collaborative/',
      },
    ],
    verified: '2026-08-07',
  },

  // --- Guelph. All four come from one Ontario requirements page, which also
  // states estimated admission ranges. The page is explicit that exact
  // cut-offs depend on applications received and space available. ---

  'guelph::bio-medical-science': {
    programId: 'guelph::bio-medical-science',
    requiredCourses: [
      'English (ENG4U)',
      'Advanced Functions (MHF4U)',
      'Two of: Biology (SBI4U), Chemistry (SCH4U), Physics (SPH4U)',
      'Two additional 4U or 4M courses',
    ],
    statedAverage: 'Estimated admission range 85–91%',
    notes: [
      'Guelph states exact cut-offs are determined by the quantity and quality of applications received and the space available.',
    ],
    sources: [
      {
        label: 'Ontario admission requirements — University of Guelph',
        url: 'https://www.uoguelph.ca/admission/undergraduate/requirements/ontario',
      },
    ],
    verified: '2026-08-07',
  },

  'guelph::animal-biology': {
    programId: 'guelph::animal-biology',
    requiredCourses: [
      'English (ENG4U)',
      'Advanced Functions (MHF4U)',
      'Two of: Biology (SBI4U), Chemistry (SCH4U), Physics (SPH4U)',
      'Two additional 4U or 4M courses',
    ],
    statedAverage: 'Estimated admission range 85–91%',
    sources: [
      {
        label: 'Ontario admission requirements — University of Guelph',
        url: 'https://www.uoguelph.ca/admission/undergraduate/requirements/ontario',
      },
    ],
    verified: '2026-08-07',
  },

  'guelph::science-biological-science': {
    programId: 'guelph::science-biological-science',
    requiredCourses: [
      'English (ENG4U)',
      'Advanced Functions (MHF4U)',
      'Two of: Biology (SBI4U), Chemistry (SCH4U), Physics (SPH4U)',
      'Two additional 4U or 4M courses',
    ],
    statedAverage: 'Estimated admission range 80–85%',
    sources: [
      {
        label: 'Ontario admission requirements — University of Guelph',
        url: 'https://www.uoguelph.ca/admission/undergraduate/requirements/ontario',
      },
    ],
    verified: '2026-08-07',
  },

  // Guelph publishes one Bachelor of Engineering requirement set covering its
  // engineering streams, including this co-op entry.
  'guelph::mechanical-engineering-co-op': {
    programId: 'guelph::mechanical-engineering-co-op',
    requiredCourses: [
      'English (ENG4U)',
      'Advanced Functions (MHF4U)',
      'Calculus and Vectors (MCV4U)',
      'Chemistry (SCH4U)',
      'Physics (SPH4U)',
      'One additional 4U or 4M course',
    ],
    statedAverage: 'Estimated admission range 84–89%',
    coop: 'Students are admitted directly to the co-op program',
    sources: [
      {
        label: 'Ontario admission requirements — University of Guelph',
        url: 'https://www.uoguelph.ca/admission/undergraduate/requirements/ontario',
      },
    ],
    verified: '2026-08-07',
  },

  'western::ivey-aeo': {
    programId: 'western::ivey-aeo',
    requiredCourses: [
      'English (Grade 12)',
      'A mathematics course for university-bound students',
    ],
    statedAverage: 'A low 90% average in your best Grade 12 courses, including English',
    notes: [
      'AEO is conditional, pre-admission status to the HBA Program — students complete two years at Western (or Huron/King’s) first.',
      'Ivey states a holistic 50/50 balance between academic performance and demonstrated leadership.',
    ],
    sources: [
      {
        label: 'Ivey AEO — Apply From High School, Ivey HBA',
        url: 'https://www.ivey.uwo.ca/hba/admissions/secondary-school-students/',
      },
    ],
    verified: '2026-08-07',
  },

  // Partial on purpose: McMaster's Business page states length and the
  // internship stream but not prerequisites or an admission range, and the
  // requirements link goes to an interactive tool with no static content.
  'mcmaster::business-i': {
    programId: 'mcmaster::business-i',
    lengthYears: '4 years; 5 years for the BCom with Internship stream',
    coop: 'BCom with Internship — a 5-year degree with a mandatory internship',
    sources: [
      {
        label: 'Business — McMaster Future Students',
        url: 'https://future.mcmaster.ca/programs/business/',
      },
    ],
    verified: '2026-08-07',
  },

  // Western's Faculty of Science page states one requirement set explicitly
  // covering Science, Computer Science and Integrated Science.
  'western::science': {
    programId: 'western::science',
    requiredCourses: [
      'English (ENG4U)',
      'Two of: Advanced Functions (MHF4U), Calculus and Vectors (MCV4U), Biology (SBI4U), Chemistry (SCH4U), Computer and Information Science (ICS4U), Earth and Space Sciences (SES4U), Math and Data Management (MDM4U), Physics (SPH4U)',
      'Two additional Grade 12 U/M courses',
    ],
    notes: ['The page does not state a minimum grade or admission average for these programs.'],
    sources: [
      { label: 'Admission Requirements — Faculty of Science, Western University', url: 'https://www.uwo.ca/sci/undergraduate/future_students/admission/index.html' },
    ],
    verified: '2026-08-07',
  },

  'western::computer-science': {
    programId: 'western::computer-science',
    requiredCourses: [
      'English (ENG4U)',
      'Two of: Advanced Functions (MHF4U), Calculus and Vectors (MCV4U), Biology (SBI4U), Chemistry (SCH4U), Computer and Information Science (ICS4U), Earth and Space Sciences (SES4U), Math and Data Management (MDM4U), Physics (SPH4U)',
      'Two additional Grade 12 U/M courses',
    ],
    notes: [
      'Western states this requirement set covers Science, Computer Science and Integrated Science.',
      'The page does not state a minimum grade or admission average for these programs.',
    ],
    sources: [
      { label: 'Admission Requirements — Faculty of Science, Western University', url: 'https://www.uwo.ca/sci/undergraduate/future_students/admission/index.html' },
    ],
    verified: '2026-08-07',
  },

  'western::health-science': {
    programId: 'western::health-science',
    requiredCourses: [
      'Grade 12U English (ENG4U)',
      'Grade 12U Biology (SBI4U)',
      'One of: Advanced Functions, Calculus and Vectors, or Math of Data Management',
    ],
    minCourseGrade: 'Minimum 80% average across six Grade 12 U/M courses',
    notes: [
      'Six Grade 12 U or M-level credits required in total.',
      'Admission is competitive; the page states that achieving the minimum average does not guarantee admission.',
    ],
    sources: [
      {
        label: 'Admissions — School of Health Studies, Western University',
        url: 'https://www.uwo.ca/fhs/shs/undergraduate/admissions.html',
      },
    ],
    verified: '2026-08-07',
  },

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
