import { Link } from 'react-router-dom'
import Eyebrow from '../../components/ui/Eyebrow'
import Button from '../../components/ui/Button'
import Placeholder from '../Placeholder'
import { useAuth } from '../../lib/authContext'
import UniversitiesEditor from './UniversitiesEditor'

// The admin panel: editing the copy the site publishes.
//
// NOT IN THE NAVBAR, and not linked from anywhere a student would look. A page
// that announces itself is an invitation, and there is nothing here for the
// 99.9% of visitors who cannot use it.
//
// WHAT THE GATE BELOW IS AND IS NOT. It reads `isAdmin` off the cached account,
// which came out of localStorage — a value the person holding the browser can
// edit. So it is a rendering decision, not a permission. The real gate is
// `requireAdmin` in TheKeems/UniServer, which re-reads the database on every
// write; somebody who flips the flag locally gets this screen and a refusal on
// every save. That is the correct division: the client decides what to draw,
// the server decides what may happen.
//
// A non-admin gets the 404 page rather than "forbidden", for the same reason the
// server answers 404 rather than 403 — a refusal confirms the thing exists.
//
// WHAT IS EDITABLE HERE IS PROSE, NEVER A NUMBER. Every figure on this site
// comes from the spreadsheet -> `npm run data:build` -> static JSON pipeline,
// where the moderation and the provenance rules live. If a description here
// could contradict a median, the whole argument of the site would rest on
// whoever last typed in this form. It cannot, because there is no number in it.

export default function AdminShell() {
  const { user, verified } = useAuth()

  // Signed out, or signed in without the flag: this route does not exist as far
  // as they are concerned. `verified` is not waited on — `user` is populated
  // synchronously from the session cache, so an admin sees their panel on the
  // first frame rather than after a round trip.
  if (!user?.isAdmin) {
    return (
      <Placeholder
        title="Page not found"
        blurb="That page doesn’t exist yet. Head back home to keep exploring."
      />
    )
  }

  return (
    <section className="container-page max-w-4xl py-16">
      <Eyebrow>Admin</Eyebrow>
      <h1 className="mt-2 font-display text-display-2 font-600 text-ink">Site content</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-slate">
        Descriptions and links for each university. This is the only editable copy on the site —
        every number a student sees comes from the moderated spreadsheets and cannot be changed
        here.
      </p>

      {!verified && (
        <p className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm text-slate">
          Still confirming your account with the server. Saving works either way — the server
          checks for itself.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link to="/profile" className="text-brand-600 hover:text-brand-700">
          ← Back to the dashboard
        </Link>
      </div>

      <div className="mt-10">
        <UniversitiesEditor />
      </div>

      <div className="mt-16 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-600 text-ink">What you cannot change from here</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate">
          <li>
            Any reported average, median or count. Those are rebuilt from the source spreadsheets by{' '}
            <code>npm run data:build</code>, which is where a human reviews them.
          </li>
          <li>
            Course requirements. They live in <code>src/data/program-info.ts</code> with a source
            URL and the date the page was read, and they change through a reviewed commit — that
            citation trail is the reason anybody should believe them.
          </li>
          <li>Anybody&rsquo;s account, profile or shortlist. This service cannot read them.</li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-slate">
          Admin is granted by hand in the database and there is no route that sets it. See the
          README in <code>TheKeems/UniServer</code>.
        </p>
      </div>

      <div className="mt-8">
        <Button to="/profile" variant="secondary">
          Done
        </Button>
      </div>
    </section>
  )
}
