import { Link } from 'react-router-dom'
import Eyebrow from '../components/ui/Eyebrow'
import Reveal from '../components/Reveal'
import { PROGRAM_INFO } from '../data/program-info'
import SUMMARY from '../data/generated/summary.json'

// Where the numbers come from, and what they cannot tell you.
//
// This was a placeholder for months, which was the weakest link in the whole
// product: the site's argument is "our numbers are real and here is where they
// came from", and the page that would say so said nothing.
//
// Every figure here is read from the dataset at render time. None is typed by
// hand — typing them is exactly how the home page once claimed "120+ programs"
// against a real 2,436, and a methodology page that misstates its own coverage
// would undo the thing it exists to establish.

/** Programs with hand-researched, cited requirements — counted, not asserted. */
const VERIFIED_PROGRAMS = Object.keys(PROGRAM_INFO).length

export default function About() {
  return (
    <div className="relative">
      <div className="bg-grid pattern-fade pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <section className="container-page max-w-3xl py-20">
        <Eyebrow>About &amp; methodology</Eyebrow>
        <h1 className="mt-2 font-display text-display-1 font-600 text-ink">
          Where these numbers come from.
        </h1>
        <p className="mt-4 text-lead text-slate">
          Official university pages publish cutoffs — the minimum they will consider. They do not
          publish what admitted students actually had. This site collects what students reported
          after the fact, and is careful about the difference.
        </p>

        <Reveal>
          <h2 className="mt-14 font-display text-display-3 font-600 text-ink">What the data is</h2>
          <p className="mt-3 leading-relaxed text-slate">
            {SUMMARY.reports.toLocaleString()} anonymous reports from students across four
            application cycles, covering {SUMMARY.programs.toLocaleString()} programs at{' '}
            {SUMMARY.universities} universities. Each record is one student saying what they applied
            to, what they heard back, and — usually — the average they applied with.
          </p>
          <p className="mt-3 leading-relaxed text-slate">
            The reports are collected and moderated by the team, cleaned by a build script, and
            published as static files. Nothing on this site is generated, estimated or inferred: if
            a number is on screen, some student wrote it down.
          </p>
        </Reveal>

        <Reveal>
          <h2 className="mt-14 font-display text-display-3 font-600 text-ink">
            Two rules we do not bend
          </h2>

          <div className="mt-5 rounded-xl border border-line bg-paper p-6">
            <h3 className="font-600 text-ink">1. We never tell you your chances.</h3>
            <p className="mt-2 leading-relaxed text-slate">
              Around 93% of the reports we hold are offers. That is not because almost everyone
              gets in — it is because students who get in are far more likely to come back and say
              so. Any &ldquo;acceptance rate&rdquo; calculated from this data would be measuring
              who answers a survey, and dressing it up as a probability.
            </p>
            <p className="mt-3 leading-relaxed text-slate">
              What the data does support is the distribution of averages admitted students
              reported: a median, a spread, and how many people it came from.{' '}
              <Link to="/community" className="text-brand-600 hover:text-brand-700">
                The community page shows that bias directly
              </Link>
              .
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-line bg-paper p-6">
            <h3 className="font-600 text-ink">2. We never publish personal data.</h3>
            <p className="mt-2 leading-relaxed text-slate">
              The audience here is mostly under 18. One of the source spreadsheets contains a
              username column; the build script has never read it, and the published records carry
              outcome fields only — no names, no schools, no ages.
            </p>
            <p className="mt-3 leading-relaxed text-slate">
              The same applies to you. Your answers, your list and your notes live in your browser.
              An account stores them so they follow you to another device; it asks for a username
              and a password and nothing else.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <h2 className="mt-14 font-display text-display-3 font-600 text-ink">
            How requirements get researched
          </h2>
          <p className="mt-3 leading-relaxed text-slate">
            Course requirements are read off the university&rsquo;s own admissions pages, one
            program at a time, and recorded with a link and the date they were checked. You can see
            both on any program page that has them.
          </p>
          <p className="mt-3 leading-relaxed text-slate">
            <strong className="font-600 text-ink">Never from a search result.</strong> Two summaries
            were caught contradicting the official page outright — one claimed McMaster Engineering
            wanted Calculus &amp; Vectors plus two sciences at 90%, where the page says English,
            Calculus &amp; Vectors, Chemistry and Physics at 87%+; another claimed York Engineering
            accepted Chemistry <em>or</em> Physics, where Lassonde asks for both. Both
            discrepancies are recorded in the source so nobody &ldquo;corrects&rdquo; them back.
          </p>
        </Reveal>

        <Reveal>
          <h2 className="mt-14 font-display text-display-3 font-600 text-ink">
            What this site cannot tell you
          </h2>
          <ul className="mt-4 space-y-3">
            <Limit
              stat={`${SUMMARY.programsWithCharts} of ${SUMMARY.programs.toLocaleString()}`}
              label="programs have enough reports to chart"
              detail="The rest are real programs that nobody has reported on yet. They say so rather than showing an average built from three people."
            />
            <Limit
              stat={`${VERIFIED_PROGRAMS} programs`}
              label="have verified course requirements"
              detail="Concentrated in the most-reported programs, which is what a shortlist tends to surface. Everywhere else the requirements tab is honest about being empty."
            />
            <Limit
              stat="No deadlines"
              label="are published here"
              detail="They change between cycles and a wrong one could cost you a year. The dashboard lets you record the dates you find, with a link back to the page you read them on."
            />
          </ul>
        </Reveal>

        <Reveal>
          <p className="mt-14 rounded-lg border border-line bg-surface p-5 leading-relaxed text-slate">
            Found something wrong? That is worth more to us than anything else — a number that
            contradicts an official page is a bug, and it gets fixed with a citation.
          </p>
        </Reveal>
      </section>
    </div>
  )
}

function Limit({ stat, label, detail }: { stat: string; label: string; detail: string }) {
  return (
    <li className="rounded-xl border border-line bg-paper p-5">
      <p className="font-600 text-ink">
        <span className="font-display text-xl [font-variant-numeric:tabular-nums]">{stat}</span>{' '}
        <span className="font-400 text-slate">{label}</span>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate">{detail}</p>
    </li>
  )
}
