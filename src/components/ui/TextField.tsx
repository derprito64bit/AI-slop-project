import { useId, useState } from 'react'

// A labelled text input with a hint and an error slot.
//
// The label/hint/error markup is the survey's `Field`, lifted out so the account
// forms do not reinvent it — same classes, same aria wiring, so a validation
// message reads identically wherever it appears. The survey keeps its local copy
// because its fields wrap chips and radio groups rather than one input.
//
// Password fields get a reveal toggle. Typing a password you cannot see, twice,
// on a phone keyboard, is the single most common reason people give up on a
// sign-up form.

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
  type?: 'text' | 'password'
  autoComplete?: string
  autoFocus?: boolean
  maxLength?: number
  placeholder?: string
  /** shown after the input, e.g. a live availability note */
  children?: React.ReactNode
}

export default function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  type = 'text',
  autoComplete,
  autoFocus,
  maxLength,
  placeholder,
  children,
}: Props) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-600 text-ink">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs leading-relaxed text-slate">
          {hint}
        </p>
      )}
      <div className="relative mt-2">
        <input
          id={id}
          // A password input whose type flips to "text" keeps working with
          // password managers; swapping the element would not.
          type={isPassword && revealed ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          className={`w-full rounded-xl border bg-paper py-3 pl-4 text-sm text-ink outline-none placeholder:text-slate ${
            isPassword ? 'pr-16' : 'pr-4'
          } ${error ? 'border-accent' : 'border-line focus:border-brand-300'}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            // Not aria-hidden and not icon-only: "Show password" is a control a
            // screen-reader user wants as much as anyone.
            className="absolute inset-y-0 right-0 px-4 text-xs font-600 text-slate transition-colors hover:text-ink"
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm text-accent" role="alert">
          {error}
        </p>
      )}
      {children}
    </div>
  )
}
