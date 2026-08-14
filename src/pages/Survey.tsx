import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Eyebrow from '../components/ui/Eyebrow'
import Button from '../components/ui/Button'
import { loadCatalogue } from '../lib/dataSource'
import { submitSurvey } from '../lib/api'
import {
  AMBITION_LABELS,
  FIELD_LABELS,
  PROVINCE_LABELS,
  averageBand,
  matchPrograms,
  saveProfile,
  type Ambition,
  type SurveyAnswers,
} from '../lib/profile'
import type { Program, University } from '../data/types'

// The narrowing survey: four questions that cut 2,436 programs down to a
// shortlist the student can actually read.
//
// Structure, validation and the Field/inputClass helpers come from James
// Zeng's original survey; the questions are different because these four map
// one-to-one onto filters that already exist and are tested in search.ts, so
// there is no second matching implementation to keep in step.
//
// It narrows WHAT TO LOOK AT, never what you will get into. Results are framed
// as "programs where admitted students reported averages near yours" — the same
// rule search.ts states for difficulty bands.

type Errors = Partial<Record<keyof SurveyAnswers, string>>

const EMPTY: SurveyAnswers = { field: '', province: 'ON', average: 0, ambition: 'balanced' }

// Wide enough to catch typos, not a real eligibility check.
const MIN_AVERAGE = 40
const MAX_AVERAGE = 100

function validate(a: SurveyAnswers, rawAverage: string): Errors {
  const errors: Errors = {}
  if (!a.field) errors.field = 'Pick a subject area to narrow things down.'
  if (!rawAverage.trim()) {
    errors.average = 'Enter your current overall average.'
  } else if (
    Number.isNaN(a.average) ||
    a.average < MIN_AVERAGE ||
    a.average > MAX_AVERAGE
  ) {
    errors.average = `Enter a number between ${MIN_AVERAGE} and ${MAX_AVERAGE}.`
  }
  return errors
}

export default function Survey() {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<SurveyAnswers>(EMPTY)
  const [rawAverage, setRawAverage] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [data, setData] = useState<{ programs: Program[]; universities: University[] } | null>(null)
  const [sending, setSending] = useState(false)

  // Warm the catalogue while the student is answering, so the shortlist is
  // instant on submit rather than showing another spinner.
  useEffect(() => {
    loadCatalogue().then(setData).catch(() => {})
  }, [])

  const set = <K extends keyof SurveyAnswers>(field: K, value: SurveyAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (sending) return

    const found = validate(answers, rawAverage)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSending(true)

    // Save and route first. The shortlist is computed locally, so the student
    // never waits on a sleeping server to see their results — the telemetry
    // POST is fired afterwards and its failure is deliberately ignored.
    const matches = data ? matchPrograms(answers, data.programs, data.universities) : []
    saveProfile(answers)
    navigate('/profile')

    submitSurvey({
      field: answers.field,
      province: answers.province,
      averageBand: averageBand(answers.average),
      ambition: answers.ambition,
      matchCount: matches.length,
    }).catch(() => {
      /* telemetry only — never block or alarm the student */
    })
  }

  return (
    <section className="container-page max-w-2xl py-24">
      <Eyebrow>Find your fit</Eyebrow>
      <h1 className="mt-2 font-display text-display-1 font-600 text-ink">
        Four questions. A shortlist you can actually read.
      </h1>
      <p className="mt-3 text-lead text-slate">
        There are 2,436 programs on this site. Tell us roughly what you&rsquo;re after and
        we&rsquo;ll narrow it to the ones worth your time.
      </p>

      <form className="mt-12 flex flex-col gap-10" onSubmit={onSubmit} noValidate>
        <Field
          id="survey-field"
          label="What do you want to study?"
          hint="A broad area is fine — you can change this later."
          error={errors.field}
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

        <Field
          id="survey-province"
          label="Where are you open to going?"
          hint="Most of our data is Ontario, so that's the default."
        >
          <div className="flex flex-wrap gap-2" role="radiogroup">
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

        <Field
          id="survey-average"
          label="What's your current overall average?"
          hint="Stays on your device — it's never uploaded."
          error={errors.average}
        >
          <div className="flex items-center gap-3">
            <input
              id="survey-average"
              name="average"
              type="number"
              inputMode="numeric"
              min={MIN_AVERAGE}
              max={MAX_AVERAGE}
              value={rawAverage}
              onChange={(e) => {
                setRawAverage(e.target.value)
                set('average', Number(e.target.value))
              }}
              placeholder="88"
              className={`w-28 rounded-xl border bg-paper px-4 py-3 text-sm text-ink outline-none placeholder:text-slate ${
                errors.average ? 'border-accent' : 'border-line focus:border-brand-300'
              }`}
              aria-invalid={Boolean(errors.average)}
              aria-describedby={
                errors.average ? 'survey-average-error survey-average-hint' : 'survey-average-hint'
              }
            />
            <span className="text-slate">%</span>
          </div>
        </Field>

        <Field
          id="survey-ambition"
          label="How wide should we cast the net?"
          hint="This only changes how far above your average we keep showing programs."
        >
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
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

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={sending} className={sending ? 'opacity-60' : ''}>
            {sending ? 'Building your list…' : 'Show my matches'}
          </Button>
          <span className="text-sm text-slate" aria-live="polite">
            {!data ? 'Loading programs…' : ''}
          </span>
        </div>

        <p className="rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-slate">
          <strong className="font-600 text-ink">This narrows what to look at, not your odds.</strong>{' '}
          Matches are programs where admitted students reported averages near yours. Because people
          who get in are likelier to report, none of this is an admission chance.
        </p>
      </form>
    </section>
  )
}

/* ------------------------------------------------------------- helpers --- */
// Field and the input styling are James Zeng's, unchanged.

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
