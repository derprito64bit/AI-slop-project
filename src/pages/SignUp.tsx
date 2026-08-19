import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AuthShell, { AlreadySignedIn } from '../components/AuthShell'
import Button from '../components/ui/Button'
import TextField from '../components/ui/TextField'
import { useAuth } from '../lib/authContext'
import {
  AuthError,
  PASSWORD_MIN,
  USERNAME_MAX,
  confirmError,
  passwordError,
  usernameError,
} from '../lib/auth'
import { loadProfile } from '../lib/profile'

// Create an account: a username, a password, and whatever survey work is already
// on the device moves in with you.
//
// WHY THE FORM ASKS FOR SO LITTLE. No email, no name, no age, no school. The
// audience is mostly minors, and this project's rule is that it collects nothing
// that identifies one — see the header of `api.ts` for the version of this
// argument that killed the original survey's name and age fields. A username the
// student invents is a label for their own data, and the hint under the box says
// so in as many words.
//
// No email also means no password reset, which is a real cost and is stated on
// the page rather than discovered later.
//
// THE DISCLOSURE AT THE BOTTOM IS PART OF THE FEATURE. This page used to say
// "nothing is uploaded", which was true when accounts were local. It now uploads
// the survey answers, and the exact average is in them. Whether or not anyone
// reads it, the copy has to say what actually happens — the version of this page
// that keeps the old reassuring sentence would be lying to a fifteen-year-old
// about where their transcript average went.

export default function SignUp() {
  const { user, signUp } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ username?: string; password?: string; confirm?: string }>({})
  const [failure, setFailure] = useState<string>()
  const [busy, setBusy] = useState(false)
  // Set once the account exists, so the page can report what happened to the
  // student's existing answers instead of dumping them on the dashboard and
  // hoping they notice their shortlist survived.
  const [done, setDone] = useState<{ adopted: boolean } | null>(null)

  if (user && !done) return <AlreadySignedIn username={user.username} />

  if (done && user) return <Created username={user.username} adopted={done.adopted} />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return

    // Check everything at once. Validating one field at a time means three
    // round trips through the button to find out the password is also too short.
    const found = {
      username: usernameError(username),
      password: passwordError(password, username),
      confirm: confirmError(password, confirm),
    }
    setErrors(found)
    setFailure(undefined)
    if (found.username || found.password || found.confirm) return

    setBusy(true)
    try {
      const { adopted } = await signUp(username, password)
      setDone({ adopted })
    } catch (cause) {
      // AuthError knows which input it belongs under; anything else — a sleeping
      // server, no connection — belongs in the banner, because no one field
      // caused it and the fix is to press the button again.
      if (cause instanceof AuthError && cause.field) {
        setErrors({ [cause.field]: cause.message })
      } else {
        setFailure(cause instanceof Error ? cause.message : 'Something went wrong.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Create an account"
      title="Keep your list in one place."
      blurb="Your answers, shortlist, courses and notes are saved to your account instead of to whoever happens to be using this browser."
      footer={
        <>
          Already have one?{' '}
          <Link to="/signin" className="font-600 text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <TextField
          label="Username"
          value={username}
          onChange={(v) => {
            setUsername(v)
            setErrors((p) => ({ ...p, username: undefined }))
          }}
          hint="Make something up — please don’t use your real name. Letters, numbers, hyphens and underscores."
          error={errors.username}
          autoComplete="username"
          autoFocus
          maxLength={USERNAME_MAX}
          placeholder="e.g. northstar_7"
        />

        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(v) => {
            setPassword(v)
            setErrors((p) => ({ ...p, password: undefined }))
          }}
          hint={`At least ${PASSWORD_MIN} characters. Don’t reuse a password from school or email.`}
          error={errors.password}
          autoComplete="new-password"
        />

        <TextField
          label="Password again"
          type="password"
          value={confirm}
          onChange={(v) => {
            setConfirm(v)
            setErrors((p) => ({ ...p, confirm: undefined }))
          }}
          error={errors.confirm}
          autoComplete="new-password"
        />

        {failure && (
          <p className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm text-accent" role="alert">
            {failure}
          </p>
        )}

        <Button type="submit" disabled={busy} className={busy ? 'opacity-60' : ''}>
          {/* The server sleeps when idle and can take most of a minute to wake, so
              the button says what it is doing rather than appearing to have
              ignored the tap. */}
          {busy ? 'Creating your account…' : 'Create my account'}
        </Button>
        {busy && (
          <p className="text-center text-xs text-slate" aria-live="polite">
            Our server sleeps when nobody’s using it — the first go can take up to a minute.
          </p>
        )}
      </form>

      <div className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-slate">
        <p>
          <strong className="font-600 text-ink">What gets uploaded.</strong> Your username, your
          password and your answers go to our server, so your list is there when you sign in on
          another device. That includes the average you typed into the survey — it used to stay on
          your device, and with an account it doesn’t. Your password is scrambled the moment it
          arrives and stored that way; nobody can read it back, including us.
        </p>
        <p className="mt-2">
          <strong className="font-600 text-ink">What we never ask for.</strong> No email, no real
          name, no age, no school. One consequence: there’s no password reset. If you forget it,
          you’d have to start a new account.
        </p>
        <p className="mt-2">
          Prefer to keep everything on this device?{' '}
          <Link to="/survey" className="font-600 text-brand-600 hover:text-brand-700">
            Skip the account
          </Link>{' '}
          — the whole site works without one, and nothing is uploaded when you’re signed out.
        </p>
      </div>
    </AuthShell>
  )
}

/**
 * The confirmation step, and the reason this page does not just navigate away.
 *
 * A student who answered four questions as a guest and then signed up needs to
 * be told their answers came with them; a student who signed up first needs to
 * be pointed at the survey. Same screen, two different next steps.
 */
function Created({ username, adopted }: { username: string; adopted: boolean }) {
  const hasAnswers = Boolean(loadProfile()?.answers)

  return (
    <AuthShell
      eyebrow="You’re in"
      title={`Welcome, ${username}.`}
      blurb={
        adopted
          ? 'Everything you’d already saved on this device — your answers, your shortlist, your courses — moved into your account and is backed up.'
          : 'Your account is ready. Anything you keep from here on is saved to it.'
      }
    >
      <div className="flex flex-col gap-3">
        {hasAnswers ? (
          <>
            <Button to="/profile">Go to my dashboard</Button>
            <Button to="/survey" variant="secondary">
              Change my four answers
            </Button>
          </>
        ) : (
          <>
            <Button to="/survey">Answer the four questions</Button>
            <Button to="/explore" variant="secondary">
              Just let me browse
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  )
}
