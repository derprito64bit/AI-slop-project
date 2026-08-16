import NotLiveYet, { MockLabel } from '../../components/NotLiveYet'

// Deadlines — the layout, not the dates.
//
// This one is a placeholder for a reason worth stating plainly: a wrong
// deadline is the worst failure this site could ship. Every other number here
// can be argued with — a median is a median, a sample is a sample — but a
// student who misses an application date because of a page like this loses a
// year. That is not a bug to fix later.
//
// So the dates below are visibly fake, and the real ones will only arrive the
// way `program-info.ts` requires: read off the official page, cited with a URL,
// stamped with the date they were checked, and re-checked every cycle. Never
// from a search summary — two of those were caught contradicting the official
// page outright (see HANDOFF rule 3).

const MOCK = [
  { when: 'Example — early autumn', label: 'Applications open', detail: 'Centralised application portal begins accepting submissions' },
  { when: 'Example — midwinter', label: 'Equal-consideration date', detail: 'Applications in by this point are considered together' },
  { when: 'Example — late winter', label: 'Supplementary materials', detail: 'Program-specific forms, portfolios, video responses' },
  { when: 'Example — spring', label: 'Offers released', detail: 'Rolling for some programs, one round for others' },
]

export default function DeadlinesView() {
  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-display-2 font-600 text-ink">Deadlines</h1>
        <p className="mt-2 max-w-2xl text-slate">
          The dates that actually matter for the programs on your list, in one timeline.
        </p>
      </header>

      <NotLiveYet
        what="This will show real, per-program dates for everything you've kept."
        blocker="It stays empty until every date has been read off the official page, cited and dated — a wrong deadline here could cost someone a year, so nothing goes in on a best guess."
      />

      <div className="mb-3">
        <MockLabel>Example timeline — these are not real dates</MockLabel>
      </div>

      <ol className="relative border-l border-line pl-6 opacity-80">
        {MOCK.map((item) => (
          <li key={item.label} className="relative pb-8 last:pb-0">
            <span
              aria-hidden="true"
              className="absolute -left-[1.9rem] top-1 h-3 w-3 rounded-full border-2 border-line bg-paper"
            />
            <p className="text-xs font-600 uppercase tracking-wider text-slate">{item.when}</p>
            <p className="mt-1 font-600 text-ink">{item.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate">{item.detail}</p>
          </li>
        ))}
      </ol>

      <p className="mt-8 rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-slate">
        <strong className="font-600 text-ink">Until this is live, check the official page.</strong>{' '}
        Every university publishes its own dates, and they change between cycles. Nothing on this
        screen should be used to plan anything.
      </p>
    </>
  )
}
