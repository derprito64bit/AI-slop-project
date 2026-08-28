import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import BalanceCheck from '../../components/BalanceCheck'
import { STEPS } from '../Survey'
import { useDashboard } from './context'

// "Is my list realistic?" — needs an average, so it asks for one rather than
// rendering an empty chart.
export default function BalanceView() {
  const { average, kept, profile } = useDashboard()

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-display-2 font-600 text-ink">Balance</h1>
        <p className="mt-2 max-w-2xl text-slate">
          How your list sits against your own average — so an all-reach list is visible before
          January, not after.
        </p>
      </header>

      {average === null ? (
        <div className="rounded-xl border border-line bg-surface p-6">
          <p className="font-600 text-ink">This one needs your average.</p>
          {/* Two different students land here and they were being told the same
              thing. `average` is null both when the questions were never
              answered AND when they were answered and the average was
              deliberately skipped — a skip stores null, on purpose. The second
              student had done everything asked of them and was told they had
              answered nothing, then sent back to question one. */}
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate">
            {profile.answers === null
              ? `There is nothing to compare your list against yet. ${STEPS.length} quick questions, every one skippable.`
              : 'You skipped the average, which is a fine answer — it is just the one this tool needs. Adding it changes nothing else.'}
          </p>
          <Button to="/survey" className="mt-5">
            {profile.answers === null ? 'Answer the questions' : 'Add my average'}
          </Button>
        </div>
      ) : kept.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-6">
          <p className="text-ink">Nothing to balance yet.</p>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            Keep a few programs from{' '}
            <Link to="/explore" className="text-brand-600 hover:text-brand-700">
              Explore
            </Link>{' '}
            and this will show the shape of your list.
          </p>
        </div>
      ) : (
        <BalanceCheck average={average} programs={kept} />
      )}
    </>
  )
}
