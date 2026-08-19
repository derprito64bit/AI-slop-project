import { useState } from 'react'
import type { ReactNode } from 'react'
import Eyebrow from './ui/Eyebrow'
import Button from './ui/Button'
import { useAuth } from '../lib/authContext'

// The card the sign-in and sign-up pages live in.
//
// Same proportions as the survey card, because they are the same kind of moment:
// one short thing to do, centred, with nothing else on screen competing for the
// decision. Sharing the chrome also means the two pages cannot drift apart.

export default function AuthShell({
  eyebrow,
  title,
  blurb,
  children,
  footer,
}: {
  eyebrow: string
  title: string
  blurb?: string
  children: ReactNode
  /** the "or do the other thing" line under the card */
  footer?: ReactNode
}) {
  return (
    <section className="container-page flex min-h-[70vh] flex-col justify-center py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-2 font-display text-display-3 font-600 text-ink">{title}</h1>
          {blurb && <p className="mt-3 text-sm leading-relaxed text-slate">{blurb}</p>}
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-paper p-6 shadow-[0_10px_40px_rgba(20,24,31,0.06)] sm:p-8">
          {children}
        </div>

        {footer && <div className="mt-5 text-center text-sm text-slate">{footer}</div>}
      </div>
    </section>
  )
}

/**
 * What /signin and /signup show to someone who is already signed in.
 *
 * Not a redirect to the dashboard. Reaching sign-up while signed in is usually
 * deliberate — a sibling wants their own account on the family laptop — and
 * bouncing them to a dashboard full of someone else's programs explains nothing.
 * Both ways out are here instead.
 */
export function AlreadySignedIn({ username }: { username: string }) {
  const { signOut } = useAuth()
  const [leaving, setLeaving] = useState(false)

  return (
    <AuthShell
      eyebrow="Your account"
      title={`You’re signed in as ${username}.`}
      blurb="Everything you keep is saved to your account, so it’s there on any device you sign in on."
    >
      <div className="flex flex-col gap-3">
        <Button to="/profile">Go to my dashboard</Button>
        <button
          type="button"
          disabled={leaving}
          onClick={() => {
            // Signing out pushes anything unsynced first, so it is not instant
            // and the button has to say so.
            setLeaving(true)
            void signOut().finally(() => setLeaving(false))
          }}
          className="rounded-full border border-line px-6 py-3 text-sm font-600 text-ink transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-60"
        >
          {leaving ? 'Signing out…' : 'Sign out and use a different account'}
        </button>
      </div>
    </AuthShell>
  )
}
