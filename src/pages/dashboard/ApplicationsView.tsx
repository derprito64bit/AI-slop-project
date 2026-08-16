import { Link } from 'react-router-dom'
import NotLiveYet, { MockLabel } from '../../components/NotLiveYet'
import { useDashboard } from './context'

// Applications tracker — the layout, not the tracker.
//
// The idea: one row per program, moving through researching → applying →
// applied → heard back, so the thing you actually have to *do* between
// September and May has a home. It would be pure localStorage like the rest of
// the profile, and it deliberately mirrors the `decision` field the dataset
// already uses, so a finished application could later become an anonymous
// community report without asking the student to type anything twice.
//
// It is a placeholder because a tracker that forgets is worse than no tracker,
// and that needs decisions this session has not made: what happens across
// devices, and what happens when a program is removed from the list.

const STAGES = ['Researching', 'Applying', 'Applied', 'Heard back'] as const

/** Obviously illustrative — never a real program, never a real date. */
const MOCK = [
  { program: 'Example Engineering', school: 'Example University', stage: 1, note: 'Supplementary due first week of February' },
  { program: 'Example Life Sciences', school: 'Another University', stage: 2, note: 'Submitted through OUAC' },
  { program: 'Example Commerce', school: 'A Third University', stage: 0, note: 'Still deciding whether to apply' },
]

export default function ApplicationsView() {
  const { kept } = useDashboard()

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-display-2 font-600 text-ink">Applications</h1>
        <p className="mt-2 max-w-2xl text-slate">
          Where each application actually is, from thinking about it to hearing back.
        </p>
      </header>

      <NotLiveYet
        what="This will track each program on your list through the stages below, stored on this device like everything else."
        blocker="It is not switched on yet: a tracker that quietly loses your progress would be worse than none, and how it should behave across devices is still undecided."
      >
        {kept.length > 0 && (
          <p className="mt-2 text-sm text-slate">
            When it lands, your {kept.length} kept program{kept.length === 1 ? '' : 's'} will be the
            rows.
          </p>
        )}
      </NotLiveYet>

      <div className="mb-3 flex items-center gap-2">
        <MockLabel>Example rows</MockLabel>
      </div>

      <ul className="grid gap-3">
        {MOCK.map((row) => (
          <li key={row.program} className="rounded-xl border border-line bg-paper p-4 opacity-80">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-600 text-ink">{row.program}</p>
                <p className="text-sm text-slate">{row.school}</p>
              </div>
              <span className="text-xs text-slate">{row.note}</span>
            </div>

            {/* The stage rail: what the working version would look like. */}
            <ol className="mt-4 flex items-center gap-1" aria-label="Application stage">
              {STAGES.map((stage, i) => (
                <li key={stage} className="flex flex-1 items-center gap-1">
                  <span
                    className={`h-1.5 flex-1 rounded-full ${
                      i <= row.stage ? 'bg-brand-500' : 'bg-surface'
                    }`}
                  />
                  <span
                    className={`whitespace-nowrap text-[11px] ${
                      i === row.stage ? 'font-600 text-brand-600' : 'text-slate'
                    }`}
                  >
                    {stage}
                  </span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm leading-relaxed text-slate">
        In the meantime,{' '}
        <Link to="/profile/list" className="text-brand-600 hover:text-brand-700">
          notes on My list
        </Link>{' '}
        are the place to keep track — they are saved the same way this would be.
      </p>
    </>
  )
}
