import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Eyebrow from '../components/ui/Eyebrow'
import Button from '../components/ui/Button'
import Combobox, { type Option } from '../components/ui/Combobox'
import { DURATION, STEP_VARIANTS } from '../lib/motion'
import { loadCatalogue } from '../lib/dataSource'
import { submitSurvey } from '../lib/api'
import { useAuth } from '../lib/authContext'
import { COURSES } from '../lib/courses'
import { STEPS, stepIndexFromParam, type StepId } from '../lib/surveySteps'
import { CITY_POINTS } from '../data/campus-locations'
import {
  AMBITION_LABELS,
  FIELD_LABELS,
  PROVINCE_LABELS,
  averageBand,
  loadProfile,
  matchPrograms,
  updateProfile,
  type Ambition,
  type SurveyAnswers,
} from '../lib/profile'
import type { Program, University } from '../data/types'

// The narrowing survey: the questions that cut 2,436 programs down to a
// shortlist the student can actually read.
//
// ONE QUESTION AT A TIME. All of them at once, full-page width, was the version
// that felt like a form to fill in rather than a conversation — you saw the
// whole obligation before you had answered any of it. Each question gets its
// own card, its own step, and its own way out.
//
// THE PICKERS ARE TYPEAHEADS, NOT CHIP GRIDS. Field and province used to be
// thirteen and seven chips, which meant the first thing the survey asked you to
// do was read twenty labels and then decide. A box you type into asks for one
// thing, and every question carries an EXAMPLE of a real answer rather than a
// restatement of its own label. See components/ui/Combobox.tsx.
//
// SKIPPING IS A FIRST-CLASS ANSWER, not an escape hatch. Every question can be
// skipped and the whole survey can be abandoned at any point, because a
// half-answered profile is genuinely useful here: each dashboard tool asks for
// the one input it needs. `SurveyAnswers` carries '' and null for exactly this,
// and `toFilters` widens rather than empties when something is missing.
//
// ADDING A QUESTION IS A FOUR-PLACE CHANGE, and missing one of them loses the
// answer silently:
//   1. `SurveyAnswers` in lib/profile.ts
//   2. `applyRemoteProfile` in lib/sync.ts — it REBUILDS the local record from
//      its own whitelist on every pull, so an unlisted field is erased on the
//      next sign-in somewhere else
//   3. `RemoteProfile` in lib/api.ts
//   4. the profile model in TheKeems/UniServer
// The one exception is `courses`, which is not a survey answer at all: it lives
// on `SavedProfile` because the Courses tool owns it, and the survey merely
// offers the fastest way to fill it in the first time.
//
// Structure, validation and the Field/inputClass helpers come from James
// Zeng's original survey; the questions are different because they map onto
// filters that already exist and are tested in search.ts, so there is no second
// matching implementation to keep in step.
//
// It narrows WHAT TO LOOK AT, never what you will get into. Results are framed
// as "programs where admitted students reported averages near yours" — the same
// rule search.ts states for difficulty bands.

const EMPTY: SurveyAnswers = {
  field: '',
  province: 'ON',
  average: null,
  ambition: 'balanced',
  homeCity: '',
  coop: '',
  gradYear: null,
}

// Wide enough to catch typos, not a real eligibility check.
const MIN_AVERAGE = 40
const MAX_AVERAGE = 100

// The question order lives in lib/surveySteps.ts, so that the dashboard's deep
// links into the survey — and their test — do not have to import this page.
// Re-exported because this is still where a reader looks for it.
export { STEPS }
export type { StepId }

/**
 * Clear one answer, because the student skipped that question.
 *
 * Skipping is not a separate state to track — it is "leave it at no preference
 * and move on", which is why these are the same values an untouched form
 * carries. Three of them matter downstream: `province: ''` means anywhere
 * rather than Ontario, `average: null` means do not filter by average at all
 * (`toFilters` drops the ceiling instead of asking for medians under 3%), and
 * `coop: ''` means show both rather than neither.
 *
 * Ambition has no empty value because it is a view setting rather than a fact
 * about the student; balanced is what you get by not expressing one. `courses`
 * is not here at all — it is not a survey answer, it lives on the profile, and
 * the caller clears its own state for that step.
 */
export function withSkipped(a: SurveyAnswers, id: StepId): SurveyAnswers {
  switch (id) {
    case 'field':
      return { ...a, field: '' }
    case 'coop':
      return { ...a, coop: '' }
    case 'province':
      return { ...a, province: '' }
    case 'homeCity':
      return { ...a, homeCity: '' }
    case 'average':
      return { ...a, average: null }
    case 'gradYear':
      return { ...a, gradYear: null }
    case 'courses':
      // Handled outside `answers`; nothing here to clear.
      return a
    case 'ambition':
      return { ...a, ambition: 'balanced' }
  }
}

/**
 * The only question that can be wrong rather than absent.
 *
 * Empty is fine — that is a skip. A typo is not: "8" or "880" would quietly
 * produce a nonsense shortlist, so it is caught here and the student is told.
 */
export function averageError(raw: string): string | undefined {
  if (!raw.trim()) return undefined
  const n = Number(raw)
  if (Number.isNaN(n) || n < MIN_AVERAGE || n > MAX_AVERAGE) {
    return `Enter a number between ${MIN_AVERAGE} and ${MAX_AVERAGE}, or skip this one.`
  }
  return undefined
}

/** The graduating years worth offering: this one and the next four. */
export function gradYearOptions(now = new Date().getFullYear()): Option[] {
  return Array.from({ length: 5 }, (_, i) => ({
    value: String(now + i),
    label: String(now + i),
  }))
}

const FIELD_OPTIONS: Option[] = Object.entries(FIELD_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const PROVINCE_OPTIONS: Option[] = Object.entries(PROVINCE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

// Only the cities the map can actually place. Offering one it cannot would
// store an answer that silently does nothing.
const CITY_OPTIONS: Option[] = Object.keys(CITY_POINTS)
  .sort()
  .map((city) => ({ value: city, label: city }))

/** Where the home city used to live, before it became a survey answer. */
const LEGACY_HOME_KEY = 'acceptiversity.map.home'

export default function Survey() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Only used to tell the truth about where the average goes — the survey
  // itself behaves identically signed in or out.
  const { user } = useAuth()
  const signedIn = Boolean(user)

  // Prefilled from whatever is already stored, so "Change answers" is an edit
  // rather than a re-interrogation. A student who has answered six of eight
  // questions should not have to retype the six to change the seventh.
  const [answers, setAnswers] = useState<SurveyAnswers>(() => {
    const saved = loadProfile()
    let legacyHome = ''
    try {
      legacyHome = localStorage.getItem(LEGACY_HOME_KEY) ?? ''
    } catch {
      /* storage unavailable — no city to recover */
    }
    return { ...EMPTY, homeCity: legacyHome, ...(saved?.answers ?? {}) }
  })
  const [courses, setCourses] = useState<string[]>(() => loadProfile()?.courses ?? [])
  const [rawAverage, setRawAverage] = useState(() => {
    const a = loadProfile()?.answers?.average
    return typeof a === 'number' ? String(a) : ''
  })
  const [error, setError] = useState<string>()
  // `?step=average` opens on that question instead of question one, because a
  // dashboard tool that needs one answer should ask for that answer. The
  // student who had already been through the survey and skipped only the
  // average was being sent back to the start and made to pass four questions
  // they had answered to reach the one they were asked for.
  //
  // A LAZY INITIALISER, deliberately: this seeds where the survey opens and
  // then has no further say. Reading the param on every render would drag the
  // student back to `average` the moment they pressed Next, and keeping the URL
  // in step with their position would put an entry in history per question, so
  // Back would walk the survey backwards instead of leaving it.
  const [step, setStep] = useState(() => stepIndexFromParam(searchParams.get('step')))
  // 1 = moving forward, -1 = going back. Drives which way the cards slide, so
  // Back visibly reverses instead of replaying the same entrance.
  const [dir, setDir] = useState(1)
  const [data, setData] = useState<{ programs: Program[]; universities: University[] } | null>(null)
  const [sending, setSending] = useState(false)

  // Warm the catalogue while the student is answering, so the shortlist is
  // instant on submit rather than showing another spinner.
  useEffect(() => {
    loadCatalogue().then(setData).catch(() => {})
  }, [])

  const set = <K extends keyof SurveyAnswers>(field: K, value: SurveyAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [field]: value }))
    setError(undefined)
  }

  const current: StepId = STEPS[step]
  const isLast = step === STEPS.length - 1

  const go = (delta: number) => {
    setDir(delta)
    setError(undefined)
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)))
  }

  /** Save what we have and go to the dashboard. `null` = abandoned entirely. */
  const finish = (final: SurveyAnswers | null, finalCourses: string[]) => {
    if (sending) return
    setSending(true)

    // Save and route first. The shortlist is computed locally, so the student
    // never waits on a sleeping server to see their results — the telemetry
    // POST is fired afterwards and its failure is deliberately ignored.
    const matches = final && data ? matchPrograms(final, data.programs, data.universities) : []
    updateProfile({ answers: final, courses: finalCourses })
    navigate('/profile')

    if (!final) return
    submitSurvey({
      field: final.field,
      province: final.province,
      // The exact average never leaves the device — only the coarse band, and
      // 'not-given' when the question was skipped.
      averageBand: averageBand(final.average),
      ambition: final.ambition,
      matchCount: matches.length,
      // Deliberately NOT sent: homeCity, gradYear, courses. This endpoint's
      // rows have to stay unlinkable to a person, and those three are facts
      // about the student rather than about whether the funnel works.
    }).catch(() => {
      /* telemetry only — never block or alarm the student */
    })
  }

  const onNext = (e?: FormEvent) => {
    e?.preventDefault()

    if (current === 'average') {
      const problem = averageError(rawAverage)
      if (problem) {
        setError(problem)
        return
      }
    }

    // Commit the typed average here rather than on every keystroke, so a
    // half-typed "8" on the way to "88" is never briefly treated as an answer.
    // An empty box is a skip, which is null — never 0, and never NaN.
    const committed: SurveyAnswers =
      current === 'average'
        ? { ...answers, average: rawAverage.trim() ? Number(rawAverage) : null }
        : answers

    if (isLast) {
      // finish() reads these values, not state: setAnswers would not have
      // flushed by the time the shortlist is computed on the same tick.
      finish(committed, courses)
    } else {
      setAnswers(committed)
      go(1)
    }
  }

  /** Skip this question: reset it to its no-preference value and move on. */
  const onSkip = () => {
    if (current === 'average') setRawAverage('')
    const cleared = withSkipped(answers, current)
    const clearedCourses = current === 'courses' ? [] : courses
    if (current === 'courses') setCourses([])
    if (isLast) {
      finish(cleared, clearedCourses)
    } else {
      setAnswers(cleared)
      go(1)
    }
  }

  const toggleCourse = (code: string) =>
    setCourses((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))

  return (
    // The inner max-width is its own element rather than a utility on
    // .container-page: that class sets max-width itself (72rem, wider still on
    // big monitors) and wins, which left the "compact card" spanning 1,100px.
    <section className="container-page flex min-h-[70vh] flex-col justify-center py-16">
      <div className="mx-auto w-full max-w-xl">
        <div className="text-center">
          <Eyebrow>Find your fit</Eyebrow>
          <h1 className="mt-2 font-display text-display-3 font-600 text-ink">
            A few questions. A shortlist you can actually read.
          </h1>
        </div>

        {/* --------------------------------------------------- the card --- */}
        <div className="mt-8 rounded-2xl border border-line bg-paper p-6 shadow sm:p-8">
          <Progress step={step} total={STEPS.length} />

          <form onSubmit={onNext} noValidate>
            {/* Fixed minimum height: without it the card resizes between a
                one-box question and a nine-chip one, and the buttons underneath
                jump out from under the cursor mid-answer. Sized to the tallest
                question (the course grid) so nothing ever shrinks. */}
            <div className="relative mt-6 min-h-[15rem]">
              <AnimatePresence mode="wait" custom={dir} initial={false}>
                <motion.div
                  key={current}
                  custom={dir}
                  variants={STEP_VARIANTS}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {current === 'field' && (
                    <Field
                      id="survey-field"
                      label="What do you want to study?"
                      hint="A broad area is fine — you can change this later."
                    >
                      <Combobox
                        id="survey-field"
                        value={answers.field}
                        onChange={(v) => set('field', v)}
                        options={FIELD_OPTIONS}
                        anyLabel="Anything — don’t narrow it"
                        placeholder="try “computer science”"
                      />
                    </Field>
                  )}

                  {current === 'coop' && (
                    <Field
                      id="survey-coop"
                      label="Do you want co-op?"
                      hint="Co-op and non-co-op are separate programs with separate competition, so this genuinely changes the list."
                    >
                      <Cards
                        name="survey-coop"
                        value={answers.coop}
                        onChange={(v) => set('coop', v as SurveyAnswers['coop'])}
                        options={[
                          { value: '', label: 'Either', hint: 'Show me both.' },
                          {
                            value: 'yes',
                            label: 'Co-op only',
                            hint: 'Paid work terms built into the degree.',
                          },
                          {
                            value: 'no',
                            label: 'No co-op',
                            hint: 'Straight through, usually a year shorter.',
                          },
                        ]}
                      />
                    </Field>
                  )}

                  {current === 'province' && (
                    <Field
                      id="survey-province"
                      label="Where are you open to going?"
                      hint="Most of our data is Ontario, so that's the default."
                    >
                      <Combobox
                        id="survey-province"
                        value={answers.province}
                        onChange={(v) => set('province', v)}
                        options={PROVINCE_OPTIONS}
                        anyLabel="Anywhere"
                        placeholder="try “Ontario”"
                      />
                    </Field>
                  )}

                  {current === 'homeCity' && (
                    <Field
                      id="survey-home"
                      label="Where are you coming from?"
                      hint="Used to work out how far each campus is. A city, never an address — and only cities that already appear in the data."
                    >
                      <Combobox
                        id="survey-home"
                        value={answers.homeCity}
                        onChange={(v) => set('homeCity', v)}
                        options={CITY_OPTIONS}
                        anyLabel="Rather not say"
                        placeholder="try “Mississauga”"
                      />
                    </Field>
                  )}

                  {current === 'average' && (
                    <Field
                      id="survey-average"
                      label="What's your current overall average?"
                      // This said "it's never uploaded" until profiles started
                      // syncing, and then it was a false promise about the most
                      // sensitive number on the site. Which sentence is true now
                      // depends on whether they are signed in, so it is asked.
                      hint={
                        signedIn
                          ? 'Saved to your account so your list works on any device. Skip it if you’d rather not say.'
                          : 'Stays on this device — nothing is uploaded while you’re signed out. Skip it if you’d rather not say.'
                      }
                      error={error}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          id="survey-average"
                          name="average"
                          type="number"
                          inputMode="numeric"
                          autoFocus
                          min={MIN_AVERAGE}
                          max={MAX_AVERAGE}
                          value={rawAverage}
                          onChange={(e) => {
                            setRawAverage(e.target.value)
                            setError(undefined)
                          }}
                          placeholder="88"
                          className={`w-28 rounded-xl border bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-slate ${
                            error ? 'border-accent' : 'border-line focus:border-brand-300'
                          }`}
                          aria-invalid={Boolean(error)}
                          aria-describedby={
                            error
                              ? 'survey-average-error survey-average-hint'
                              : 'survey-average-hint'
                          }
                        />
                        <span className="text-slate">%</span>
                      </div>
                    </Field>
                  )}

                  {current === 'courses' && (
                    <Field
                      id="survey-courses"
                      label="Which Grade 12 U courses are you taking?"
                      hint="Tick all that apply. A missing prerequisite is the one thing that closes a door outright, so this is the answer that does the most work."
                    >
                      <div className="flex flex-wrap gap-2">
                        {COURSES.map((c) => {
                          const on = courses.includes(c.code)
                          return (
                            <button
                              key={c.code}
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              onClick={() => toggleCourse(c.code)}
                              className={`rounded-full border px-3.5 py-2 text-sm transition-[scale,transform,background-color,border-color,color] active:scale-[0.97] ${
                                on
                                  ? 'border-brand-500 bg-brand-500 text-white'
                                  : 'border-line bg-paper text-ink hover:border-brand-300'
                              }`}
                            >
                              {on ? '✓ ' : ''}
                              {c.name}
                              <span
                                className={`ml-1.5 text-xs ${on ? 'text-white/70' : 'text-slate'}`}
                              >
                                {c.code}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </Field>
                  )}

                  {current === 'gradYear' && (
                    <Field
                      id="survey-year"
                      label="When do you finish high school?"
                      hint="So we can say which application cycle's reports describe you. Nothing about this is sent anywhere anonymous."
                    >
                      <Combobox
                        id="survey-year"
                        value={answers.gradYear === null ? '' : String(answers.gradYear)}
                        onChange={(v) => set('gradYear', v ? Number(v) : null)}
                        options={gradYearOptions()}
                        anyLabel="Rather not say"
                        placeholder="try “2027”"
                      />
                    </Field>
                  )}

                  {current === 'ambition' && (
                    <Field
                      id="survey-ambition"
                      label="How wide should we cast the net?"
                      hint="This only changes how far above your average we keep showing programs."
                    >
                      <Cards
                        name="survey-ambition"
                        value={answers.ambition}
                        onChange={(v) => set('ambition', v as Ambition)}
                        options={(Object.keys(AMBITION_LABELS) as Ambition[]).map((key) => ({
                          value: key,
                          label: AMBITION_LABELS[key].label,
                          hint: AMBITION_LABELS[key].hint,
                        }))}
                      />
                    </Field>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ------------------------------------------------ controls --- */}
            <div className="mt-8 flex items-center gap-3 border-t border-line pt-5">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="rounded-full px-3 py-2 text-sm text-slate transition-colors hover:text-ink"
                >
                  ← Back
                </button>
              )}

              <div className="ml-auto flex items-center gap-3">
                {/* Skip sits beside Next, not hidden in a corner: a student who
                    does not know their average should not have to hunt for the
                    way past the question. */}
                <button
                  type="button"
                  onClick={onSkip}
                  className="rounded-full px-3 py-2 text-sm text-slate underline-offset-2 transition-colors hover:text-ink hover:underline"
                >
                  Skip
                </button>
                <Button type="submit" disabled={sending}>
                  {isLast ? (sending ? 'Building your list…' : 'Show my matches') : 'Next'}
                </Button>
              </div>
            </div>
          </form>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => finish(null, courses)}
            className="text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
          >
            Skip all — just let me browse
          </button>
          <span className="text-sm text-slate" aria-live="polite">
            {!data ? 'Loading programs…' : ''}
          </span>
        </div>

        <p className="mt-6 rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-slate">
          <strong className="font-600 text-ink">This narrows what to look at, not your odds.</strong>{' '}
          Matches are programs where admitted students reported averages near yours. Because people
          who get in are likelier to report, none of this is an admission chance.
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- helpers --- */
// Field and the input styling are James Zeng's, unchanged.

/** Where you are, and how much is left. Both matter when deciding to bail. */
function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-600 uppercase tracking-wider text-slate">
          Question {step + 1} of {total}
        </span>
        <span className="text-slate">Every question is optional</span>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <motion.span
            key={i}
            className="h-1 flex-1 rounded-full bg-surface"
            animate={{ backgroundColor: i <= step ? 'var(--color-brand-500)' : 'var(--color-line)' }}
            transition={{ duration: DURATION.base }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * A short set of choices where the difference between them needs explaining.
 *
 * Kept for co-op and ambition rather than moving them into a Combobox: three
 * options, each of which needs a sentence, is exactly the case a typeahead
 * handles badly — you would have to open the list to find out what the options
 * mean.
 */
function Cards({
  name,
  value,
  onChange,
  options,
}: {
  name: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string; hint: string }>
}) {
  return (
    <div className="grid gap-2" role="radiogroup" aria-labelledby={`${name}-label`}>
      {options.map((o) => {
        const selected = value === o.value
        return (
          <button
            key={o.value || '__any'}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`rounded-xl border p-4 text-left transition-[scale,transform,background-color,border-color,color] active:scale-[0.99] ${
              selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-paper hover:border-brand-300'
            }`}
          >
            <span className="block text-sm font-600 text-ink">{o.label}</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate">{o.hint}</span>
          </button>
        )
      })}
    </div>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label id={`${id}-label`} htmlFor={id} className="block font-600 text-ink">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-slate">
          {hint}
        </p>
      )}
      <div className="mt-3">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
