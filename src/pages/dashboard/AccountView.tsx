import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import TextField from '../../components/ui/TextField'
import { useAuth } from '../../lib/authContext'
import { AuthError, PASSWORD_MIN } from '../../lib/auth'
import type { SyncStatus } from '../../lib/sync'
import { useDashboard } from './context'

// The account itself: who you are signed in as, whether your list has made it to
// the server, and the two destructive things you are allowed to do to it.
//
// It lives inside the dashboard rather than on its own page because everything it
// talks about — the shortlist, the courses, the notes — is what the dashboard
// shows. Signed-out students get the same information framed as what an account
// would do for them.

const CONFIRM_WORD = 'DELETE'

export default function AccountView() {
  const { user } = useAuth()
  const { profile } = useDashboard()

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-display-2 font-600 text-ink">Account</h1>
        <p className="mt-2 max-w-2xl text-slate">
          {user
            ? 'Your username, your password, and what happens to your data.'
            : 'You’re using this site without an account. That works fine — an account backs your list up and lets you open it on another device.'}
        </p>
      </header>

      {user ? (
        <div className="flex max-w-2xl flex-col gap-6">
          <Identity
            username={user.username}
            createdAt={user.createdAt}
            kept={profile.shortlist.length}
          />
          <Backup />
          <ChangePassword />
          <SessionActions />
          <DangerZone />
        </div>
      ) : (
        <GuestPanel kept={profile.shortlist.length} hasAnswers={Boolean(profile.answers)} />
      )}
    </>
  )
}

/* ------------------------------------------------------------ signed in --- */

function Panel({
  title,
  children,
  tone = 'default',
}: {
  title: string
  children: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <section
      className={`rounded-xl border p-5 ${
        tone === 'danger' ? 'border-accent/40 bg-accent/[0.03]' : 'border-line bg-paper'
      }`}
    >
      <h2 className={`font-600 ${tone === 'danger' ? 'text-accent' : 'text-ink'}`}>{title}</h2>
      {children}
    </section>
  )
}

function Identity({
  username,
  createdAt,
  kept,
}: {
  username: string
  createdAt: string
  kept: number
}) {
  // toLocaleDateString rather than the raw ISO string: "18 August 2026" is the
  // only part of a timestamp anyone wants here.
  const made = new Date(createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Panel title="Signed in">
      <dl className="mt-3 space-y-2 text-sm">
        <Row label="Username" value={username} />
        <Row label="Account made" value={made} />
        <Row label="Programs kept" value={String(kept)} />
      </dl>
      {/* The honest version of "your data is safe with us", repeated where someone
          might be about to trust the account with something. */}
      <p className="mt-4 text-xs leading-relaxed text-slate">
        <strong className="font-600 text-ink">What’s on our server.</strong> Your username, your
        survey answers — including the average you typed — your shortlist, your courses, your notes
        and your tags. Not your password: that was scrambled when you set it and can’t be read back.
        No email, no real name, no school, because we never asked.
      </p>
    </Panel>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate">{label}</dt>
      <dd className="text-right font-500 text-ink">{value}</dd>
    </div>
  )
}

const SYNC_COPY: Record<SyncStatus, { label: string; detail: string; tone: string }> = {
  idle: {
    label: 'Backed up',
    detail: 'Everything on your list has reached the server.',
    tone: 'text-brand-600',
  },
  pending: {
    label: 'Saving…',
    detail: 'A change you just made is on its way up.',
    tone: 'text-slate',
  },
  pushing: {
    label: 'Saving…',
    detail: 'Sending your latest changes to the server.',
    tone: 'text-slate',
  },
  error: {
    label: 'Not backed up yet',
    detail:
      'We couldn’t reach the server, so your latest changes are only on this device. Nothing is lost — we’ll keep trying, and you can carry on using your list.',
    tone: 'text-accent',
  },
  'signed-out': {
    label: 'On this device',
    detail: 'Sign in to back this up.',
    tone: 'text-slate',
  },
}

/**
 * Whether the list has actually made it to the server.
 *
 * Worth a panel of its own. The whole promise of an account is that the work is
 * somewhere other than one laptop, and a student on a school network where the
 * request is blocked deserves to know it has not happened rather than to find out
 * when they sign in at home to an older list.
 */
function Backup() {
  const { sync, refresh } = useAuth()
  const [pulling, setPulling] = useState(false)
  const [pulled, setPulled] = useState<string>()
  const state = SYNC_COPY[sync]

  return (
    <Panel title="Backup">
      <p className={`mt-2 text-sm font-600 ${state.tone}`} aria-live="polite">
        {state.label}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate">{state.detail}</p>

      <button
        type="button"
        disabled={pulling}
        onClick={() => {
          setPulling(true)
          setPulled(undefined)
          refresh()
            .then(() => setPulled('Loaded the version from the server.'))
            .catch(() => setPulled('Couldn’t reach the server just now.'))
            .finally(() => setPulling(false))
        }}
        className="mt-3 text-sm font-600 text-brand-600 hover:text-brand-700 disabled:opacity-60"
      >
        {pulling ? 'Fetching…' : 'Reload my list from the server'}
      </button>
      {pulled && (
        <p className="mt-2 text-xs text-slate" aria-live="polite">
          {pulled}
        </p>
      )}
      {/* The conflict rule, in one sentence, where the button that can trigger it
          is. Whichever device saved last is the one that wins, and someone about
          to press this should know it replaces what is on screen. */}
      <p className="mt-3 text-xs leading-relaxed text-slate">
        If you’ve used two devices, the one that saved most recently is the copy we keep. Reloading
        replaces what’s on this device with the server’s version.
      </p>
    </Panel>
  )
}

function ChangePassword() {
  const { changePassword } = useAuth()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const reset = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setErrors({})
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (next !== confirm) {
      setErrors({ confirm: 'Those two don’t match.' })
      return
    }
    setErrors({})
    setBusy(true)
    try {
      await changePassword(current, next)
      reset()
      setOpen(false)
      setSaved(true)
    } catch (cause) {
      const field = cause instanceof AuthError ? cause.field ?? 'password' : 'password'
      setErrors({ [field]: cause instanceof Error ? cause.message : 'Couldn’t change it.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Password">
      {!open ? (
        <>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            {saved
              ? 'Changed. You’re still signed in.'
              : 'There’s no email on file, so there’s no password reset — change it while you know it.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSaved(false)
              setOpen(true)
            }}
            className="mt-3 text-sm font-600 text-brand-600 hover:text-brand-700"
          >
            Change my password
          </button>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
          <TextField
            label="Current password"
            type="password"
            value={current}
            onChange={setCurrent}
            error={errors.password}
            autoComplete="current-password"
            autoFocus
          />
          <TextField
            label="New password"
            type="password"
            value={next}
            onChange={setNext}
            hint={`At least ${PASSWORD_MIN} characters.`}
            autoComplete="new-password"
          />
          <TextField
            label="New password again"
            type="password"
            value={confirm}
            onChange={setConfirm}
            error={errors.confirm}
            autoComplete="new-password"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={busy} className={busy ? 'opacity-60' : ''}>
              {busy ? 'Saving…' : 'Save new password'}
            </Button>
            <button
              type="button"
              onClick={() => {
                reset()
                setOpen(false)
              }}
              className="text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
            >
              Cancel
            </button>
          </div>
          {/* Sessions here are stateless tokens, so this cannot log out a phone
              that is already signed in. Saying so beats implying a security
              guarantee the service does not make. */}
          <p className="text-xs leading-relaxed text-slate">
            Changing your password doesn’t sign out devices that are already signed in.
          </p>
        </form>
      )}
    </Panel>
  )
}

function SessionActions() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  return (
    <Panel title="Sign out">
      <p className="mt-2 text-sm leading-relaxed text-slate">
        Your list is on the server and on this device, and it’s waiting when you sign back in.
        Signing out is not deleting.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          // Pushes anything unsynced before ending the session, so this is not
          // instant — the label has to move.
          setBusy(true)
          signOut()
            .then(() => navigate('/'))
            .finally(() => setBusy(false))
        }}
        className="mt-3 rounded-full border border-line px-5 py-2 text-sm font-600 text-ink transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-60"
      >
        {busy ? 'Saving and signing out…' : 'Sign out'}
      </button>
    </Panel>
  )
}

function DangerZone() {
  const { deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const [arming, setArming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string>()

  return (
    <Panel title="Delete my account" tone="danger">
      <p className="mt-2 text-sm leading-relaxed text-slate">
        Removes your account and everything saved under it — your answers, your shortlist, your
        courses and your notes — from our server and from this device. This can’t be undone and there
        is no backup to restore from.
      </p>

      {!arming ? (
        <button
          type="button"
          onClick={() => setArming(true)}
          className="mt-3 text-sm font-600 text-accent underline-offset-2 hover:underline"
        >
          I want to delete my account
        </button>
      ) : (
        <div className="mt-4">
          {/* Typing the word rather than re-entering the password. The password is
              checked by the server on sign-in, and this student is already signed
              in — asking again would be a lock on a door that is already open. */}
          <TextField
            label={`Type ${CONFIRM_WORD} to confirm`}
            value={typed}
            onChange={setTyped}
            autoFocus
          />
          {failure && (
            <p className="mt-3 text-sm text-accent" role="alert">
              {failure}
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={typed !== CONFIRM_WORD || busy}
              onClick={() => {
                setBusy(true)
                setFailure(undefined)
                deleteAccount()
                  .then(() => navigate('/'))
                  .catch((cause: unknown) => {
                    // Deliberately does not wipe locally on failure: if the server
                    // still has the account, a local wipe would mean signing in
                    // again restores everything they asked to be rid of.
                    setFailure(
                      cause instanceof Error
                        ? `${cause.message} Nothing was deleted — try again.`
                        : 'Couldn’t reach the server. Nothing was deleted — try again.',
                    )
                  })
                  .finally(() => setBusy(false))
              }}
              className="rounded-full bg-accent px-5 py-2 text-sm font-600 text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Deleting…' : 'Delete everything'}
            </button>
            <button
              type="button"
              onClick={() => {
                setArming(false)
                setTyped('')
                setFailure(undefined)
              }}
              className="text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
            >
              Keep my account
            </button>
          </div>
        </div>
      )}
    </Panel>
  )
}

/* ----------------------------------------------------------------- guest --- */

/**
 * What a signed-out student sees.
 *
 * Framed as what an account buys them, with the cost attached in the same
 * breath — an account uploads the average that otherwise never leaves the device,
 * and that is a trade they are entitled to decline. It is not a wall: everything
 * on the dashboard works without one.
 */
function GuestPanel({ kept, hasAnswers }: { kept: number; hasAnswers: boolean }) {
  const carries = [
    hasAnswers && 'your four answers',
    kept > 0 && `${kept} kept program${kept === 1 ? '' : 's'}`,
  ].filter(Boolean) as string[]

  return (
    <div className="max-w-2xl">
      <Panel title="No account">
        <p className="mt-2 text-sm leading-relaxed text-slate">
          Right now your work is saved against this browser and nothing is uploaded. That also means
          anyone using this computer shares it, clearing your browser data clears it, and it won’t be
          on your phone.
        </p>
        {carries.length > 0 && (
          <p className="mt-3 text-sm leading-relaxed text-slate">
            If you make an account now, {carries.join(' and ')} come with you — nothing is lost.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button to="/signup">Create an account</Button>
          <Button to="/signin" variant="secondary">
            I already have one
          </Button>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-slate">
          An account asks for a username you invent and a password — no email, no real name, no
          school. In exchange, your answers are stored on our server, and that includes the average
          you type into the survey.
        </p>
      </Panel>
    </div>
  )
}
