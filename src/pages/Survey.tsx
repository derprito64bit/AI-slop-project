import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Eyebrow from '../components/ui/Eyebrow'
import Button from '../components/ui/Button'
import { DURATION, STEP_VARIANTS } from '../lib/motion'
import { loadCatalogue } from '../lib/dataSource'
import { submitSurvey } from '../lib/api'
import { useAuth } from '../lib/authContext'
import {
  AMBITION_LABELS,
  FIELD_LABELS,
  PROVINCE_LABELS,
  averageBand,
  matchPrograms,
  updateProfile,
  type Ambition,
  type SurveyAnswers,
} from '../lib/profile'
import type { Program, University } from '../data/types'

// The narrowing survey: four questions that cut 2,436 programs down to a
// shortlist the student can actually read.
//
// ONE QUESTION AT A TIME. All four at once, full-page width, was the version
// that felt like a form to fill in rather than a conversation — you saw the
// whole obligation before you had answered any of it. Each question now gets
// its own card, its own step, and its own way out.
//
// SKIPPING IS A FIRST-CLASS ANSWER, not an escape hatch. Every question can be
// skipped and the whole survey can be abandoned at any point, because a
// half-answered profile is genuinely useful here: each dashboard tool asks for
// the one input it needs. `SurveyAnswers` carries '' and null for exactly this,
// and `toFilters` widens rather than empties when something is missing.
//
// Structure, validation and the Field/inputClass helpers come from James
// Zeng's original survey; the questions are different because these four map
// one-to-one onto filters that already exist and are tested in search.ts, so
// there is no second matching implementation to keep in step.
//
// It narrows WHAT TO LOOK AT, never what you will get into. Results are framed
// as "programs where admitted students reported averages near yours" — the same
// rule search.ts states for difficulty bands.

const EMPTY: SurveyAnswers = { field: '', province: 'ON', average: null, ambition: 'balanced' }

// Wide enough to catch typos, not a real eligibility check.
const MIN_AVERAGE = 40
const MAX_AVERAGE = 100

export const STEPS = ['field', 'province', 'average', 'ambition'] as const
export type StepId = (typeof STEPS)[number]

/**
 * Clear one answer, because the student skipped that question.
 *
 * Skipping is not a separate state to track — it is "leave it at no preference
 * and move on", which is why these are the same values an untouched form
 * carries. Two of them matter downstream: `province: ''` means anywhere rather
 * than Ontario, and `average: null` means do not filter by average at all
 * (`toFilters` drops the ceiling instead of asking for medians under 3%).
 *
 * Ambition has no empty value because it is a view setting rather than a fact
 * about the student; balanced is what you get by not expressing one.
 */
export function withSkipped(a: SurveyAnswers, id: StepId): SurveyAnswers {
  switch (id) {
    case 'field':
      return { ...a, field: '' }
    case 'province':
      return { ...a, province: '' }
    case 'average':
      return { ...a, average: null }
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

export default function Survey() {
  const navigate = useNavigate()
  // Only used to tell the truth about where the average goes — the survey itself
  // behaves identically signed in or out.
  const { user } = useAuth()
  const signedIn = Boolean(user)
  const [answers, setAnswers] = useState<SurveyAnswers>(EMPTY)
  const [rawAverage, setRawAverage] = useState('')
  const [error, setError] = useState<string>()
  const [step, setStep] = useState(0)
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
  const finish = (final: SurveyAnswers | null) => {
    if (sending) return
    setSending(true)

    // Save and route first. The shortlist is computed locally, so the student
    // never waits on a sleeping server to see their results — the telemetry
    // POST is fired afterwards and its failure is deliberately ignored.
    const matches = final && data ? matchPrograms(final, data.programs, data.universities) : []
    updateProfile({ answers: final })
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
      // finish() reads this object, not state: setAnswers would not have
      // flushed by the time the shortlist is computed on the same tick.
      finish(committed)
    } else {
      setAnswers(committed)
      go(1)
    }
  }

  /** Skip this question: reset it to its no-preference value and move on. */
  const onSkip = () => {
    if (current === 'average') setRawAverage('')
    const cleared = withSkipped(answers, current)
    if (isLast) {
      finish(cleared)
    } else {
      setAnswers(cleared)
      go(1)
    }
  }

  return (
    // The inner max-width is its own element rather than a utility on
    // .container-page: that class sets max-width itself (72rem, wider still on
    // big monitors) and wins, which left the "compact card" spanning 1,100px.
    <section className="container-page flex min-h-[70vh] flex-col justify-center py-16">
      <div className="mx-auto w-full max-w-xl">
      <div className="text-center">
        <Eyebrow>Find your fit</Eyebrow>
        <h1 className="mt-2 font-display text-display-3 font-600 text-ink">
          Four questions. A shortlist you can actually read.
        </h1>
      </div>

      {/* --------------------------------------------------- the card --- */}
      <div className="mt-8 rounded-2xl border border-line bg-paper p-6 shadow-[0_10px_40px_rgba(20,24,31,0.06)] sm:p-8">
        <Progress step={step} total={STEPS.length} />

        <form onSubmit={onNext} noValidate>
          {/* Fixed minimum height: without it the card resizes between a
              13-chip question and a 3-card one, and the buttons underneath
              jump out from under the cursor mid-answer. Sized to the tallest
              question (the three ambition cards) so nothing ever shrinks. */}
          <div className="relative mt-6 min-h-[13.5rem]">
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
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="survey-field-label">
                      {Object.entries(FIELD_LABELS).map(([value, label]) => (
                        <Chip
                          key={value}
                          selected={answers.field === value}
                          onClick={() => set('field', value)}
                        >
                          {label}
                        </Chip>
                      ))}
                    </div>
                  </Field>
                )}

                {current === 'province' && (
                  <Field
                    id="survey-province"
                    label="Where are you open to going?"
                    hint="Most of our data is Ontario, so that's the default."
                  >
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="survey-province-label">
                      <Chip selected={answers.province === ''} onClick={() => set('province', '')}>
                        Anywhere
                      </Chip>
                      {Object.entries(PROVINCE_LABELS).map(([code, label]) => (
                        <Chip
                          key={code}
                          selected={answers.province === code}
                          onClick={() => set('province', code)}
                        >
                          {label}
                        </Chip>
                      ))}
                    </div>
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
                          error ? 'survey-average-error survey-average-hint' : 'survey-average-hint'
                        }
                      />
                      <span className="text-slate">%</span>
                    </div>
                  </Field>
                )}

                {current === 'ambition' && (
                  <Field
                    id="survey-ambition"
                    label="How wide should we cast the net?"
                    hint="This only changes how far above your average we keep showing programs."
                  >
                    <div className="grid gap-2" role="radiogroup" aria-labelledby="survey-ambition-label">
                      {(Object.keys(AMBITION_LABELS) as Ambition[]).map((key) => {
                        const { label, hint } = AMBITION_LABELS[key]
                        const selected = answers.ambition === key
                        return (
                          <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => set('ambition', key)}
                            className={`rounded-xl border p-4 text-left transition-colors ${
                              selected
                                ? 'border-brand-500 bg-brand-50'
                                : 'border-line bg-paper hover:border-brand-300'
                            }`}
                          >
                            <span className="block text-sm font-600 text-ink">{label}</span>
                            <span className="mt-1 block text-xs leading-relaxed text-slate">{hint}</span>
                          </button>
                        )
                      })}
                    </div>
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
              <Button type="submit" disabled={sending} className={sending ? 'opacity-60' : ''}>
                {isLast ? (sending ? 'Building your list…' : 'Show my matches') : 'Next'}
              </Button>
            </div>
          </div>
        </form>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => finish(null)}
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

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
        selected
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-line bg-paper text-ink hover:border-brand-300'
      }`}
    >
      {children}
    </button>
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
