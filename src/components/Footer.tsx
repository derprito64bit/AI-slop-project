import { Link } from 'react-router-dom'
import { NAV_LINKS, BRAND } from '../nav'

// Shared footer, used on every page via the Layout.
export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-cloud">
      {/* Three columns, not four — the dead "Get updates" one was removed. */}
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="font-display text-lg font-600 text-ink">
            {BRAND}<span className="text-brand-500">.</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-slate">
            Real university admission requirements, personalized to your profile.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-600 uppercase tracking-wider text-slate">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm">
            {NAV_LINKS.filter((l) => !l.cta).map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-ink/80 transition-colors hover:text-brand-600">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-600 uppercase tracking-wider text-slate">Sources</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink/80">
            {/* Two sources, not three. "Public admission datasets" was listed
                here and nothing public feeds src/data/generated — the pipeline
                is the community spreadsheets plus university pages read by
                hand. */}
            <li>Official institution postings</li>
            <li>Community application data</li>
          </ul>
        </div>

        {/* A "Get updates — occasional notes as we add schools & data" column
            used to sit here, with no form, no input and no link under it. There
            was never anything to sign up to, and the only mechanism for it would
            be email, which this project does not collect from anyone. */}
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-slate sm:flex-row">
          <span>© {BRAND} — student project, in development.</span>
          <span>Made for students, by students.</span>
        </div>
      </div>
    </footer>
  )
}
