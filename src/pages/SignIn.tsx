import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell, { AlreadySignedIn } from '../components/AuthShell'
import Button from '../components/ui/Button'
import TextField from '../components/ui/TextField'
import { useAuth } from '../lib/authContext'
import { AuthError, USERNAME_MAX } from '../lib/auth'
import { localAccountsWereMoved } from '../lib/session'

// Sign in.
//
// The form does not pre-validate the username against `usernameError`. Rules can
// tighten between one release and the next, and telling someone their existing
// username is "invalid" instead of just checking it is the kind of thing that
// locks a real person out of real data. Only sign-up enforces the shape.
//
// Credentials are checked by the server, so this is the one screen that genuinely
// cannot work offline. The failure states that matter are therefore not just
// "wrong password" but "the server is asleep" and "you have no connection", and
// they read differently on purpose: one of them is worth pressing the button
// again for.

export default function SignIn() {
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const [failure, setFailure] = useState<string>()
  const [busy, setBusy] = useState(false)
  // Read once per mount: the notice explains why an account made in the local-only
  // build is no longer there, and it should not vanish mid-read.
  const [moved] = useState(() => localAccountsWereMoved())

  if (user) return <AlreadySignedIn username={user.username} />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setErrors({})
    setFailure(undefined)
    setBusy(true)
    try {
      await signIn(username, password)
      // replace: true — Back should go wherever they were before signing in, not
      // to a form they have already used.
      navigate('/profile', { replace: true })
    } catch (cause) {
      // A wrong password belongs under the password box. A sleeping server or a
      // dead connection belongs in a banner: it is not a field that is wrong, and
      // putting "couldn't reach the server" under the password box reads as though
      // the password were the problem.
      if (cause instanceof AuthError && cause.field && !cause.retryable) {
        setErrors({ [cause.field]: cause.message })
      } else {
        setFailure(cause instanceof Error ? cause.message : 'Couldn’t sign you in.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Welcome back."
      blurb="Pick up the list you were building."
      footer={
        <>
          No account yet?{' '}
          <Link to="/signup" className="font-600 text-brand-600 hover:text-brand-700">
            Create one
          </Link>
        </>
      }
    >
      {/* One-time explanation for the handful of people who made an account in the
          build where accounts were local. Their list was not lost — it is back
          where a signed-out visitor's data lives, and signing up adopts it. */}
      {moved && (
        <div className="mb-6 rounded-lg border border-brand-300 bg-brand-50 p-3 text-xs leading-relaxed text-ink">
          <strong className="font-600">Accounts moved to our server.</strong> Accounts made in an
          earlier version only existed in this browser, so they can’t be signed into. Your saved
          answers and shortlist are still here —{' '}
          <Link to="/signup" className="font-600 text-brand-600 hover:text-brand-700">
            create an account
          </Link>{' '}
          and they’ll move into it.
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <TextField
          label="Username"
          value={username}
          onChange={(v) => {
            setUsername(v)
            setErrors({})
          }}
          error={errors.username}
          autoComplete="username"
          autoFocus
          maxLength={USERNAME_MAX}
        />

        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(v) => {
            setPassword(v)
            setErrors({})
          }}
          error={errors.password}
          autoComplete="current-password"
        />

        {failure && (
          <p
            className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm text-accent"
            role="alert"
          >
            {failure}
          </p>
        )}

        <Button type="submit" disabled={busy}>
          {busy ? 'Signing you in…' : 'Sign in'}
        </Button>
        {busy && (
          <p className="text-center text-xs text-slate" aria-live="polite">
            Our server sleeps when nobody’s using it. The first go can take up to a minute.
          </p>
        )}
      </form>

      <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-slate">
        You don’t need an account to use the site. You can{' '}
        <Link to="/survey" className="font-600 text-brand-600 hover:text-brand-700">
          answer the questions
        </Link>{' '}
        or{' '}
        <Link to="/explore" className="font-600 text-brand-600 hover:text-brand-700">
          browse programs
        </Link>{' '}
        without one, and make an account later.
      </p>
    </AuthShell>
  )
}
