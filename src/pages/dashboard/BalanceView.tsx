import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import BalanceCheck from '../../components/BalanceCheck'
import { fieldSummaryFor, summarise } from '../../lib/fields'
import { catalogueTotals } from '../../lib/overview'
import { STEPS } from '../../lib/surveySteps'
import { useDashboard } from './context'

// "Is my list realistic?" — needs an average, so it asks for one rather than
// rendering an empty chart.
export default function BalanceView() {
  const { average, kept, profile, data, uniName } = useDashboard()

  const listEmpty = kept.length === 0
  const totals = catalogueTotals()

  // Only walked for a student who has an average and nothing to spend it on —
  // it is a pass over all 2,436 programs, and every other state on this page
  // has something better to show. Same rollup the Fields page and the Overview
  // empty state read, so the three cannot print different answers to "how
  // competitive is this field, really".
  const myField = useMemo(() => {
    if (!listEmpty || average === null || !data) return null
    return fieldSummaryFor(summarise(data.programs, uniName), profile.answers?.field ?? '')
  }, [listEmpty, average, data, uniName, profile.answers?.field])

  // Whether BalanceCheck would render nothing. It counts only programs with a
  // numeric median, so `kept.length > 0` is not enough to know the chart has
  // anything in it. Same `accepted` test `balanceOf` applies.
  const nothingToPlace = !listEmpty && kept.every((p) => p.accepted === null)

  // Distinguishes "no field to describe" from "the catalogue is still loading",
  // so the dataset-wide sentence does not flash and then get replaced by the
  // field one a beat later.
  const fieldPending = listEmpty && !data && Boolean(profile.answers?.field)

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
          {/* The second student is sent to the average itself. Only that one:
              a student who has never answered anything has no reason to start
              at question five, and the survey prefills from what is stored, so
              the deep link is an edit rather than a restart. */}
          <Button
            to={profile.answers === null ? '/survey' : '/survey?step=average'}
            className="mt-5"
          >
            {profile.answers === null ? 'Answer the questions' : 'Add my average'}
          </Button>
        </div>
      ) : listEmpty ? (
        <div className="rounded-xl border border-line bg-surface p-6">
          <p className="font-600 text-ink">Nothing to balance yet.</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate">
            Keep a few programs from{' '}
            <Link to="/explore" className="text-brand-600 hover:text-brand-700">
              Explore
            </Link>{' '}
            and each one gets placed against your {average}% — above it, close to it, or below —
            using the median average admitted students reported for that program.
          </p>

          {/* What that comparison has to work with, so the number they gave us
              is answered with something rather than held until they keep a
              program.

              It describes the SPREAD OF REPORTED MEDIANS and stops there. It
              deliberately does not count how many of them sit at or below the
              student's average: only 369 programs have enough reports to be
              charted at all, and they are the most-reported ones, which are the
              most competitive ones — so that count reads 0 for any average
              below 85.2 and lands as "nothing here is for you", which is a
              statement about odds and is not even what the data says. The 1,935
              programs whose medians are too thin to show are not missing
              because they are easy. */}
          {fieldPending ? null : (
            <div className="mt-5 border-t border-line pt-5">
              {myField !== null && myField.midMedian !== null ? (
                <p className="text-sm leading-relaxed text-slate">
                  In {myField.label}, {myField.withData} of{' '}
                  {myField.programs.toLocaleString()} programs have enough reports to show that
                  median. Those medians run{' '}
                  <span className="font-600 text-ink [font-variant-numeric:tabular-nums]">
                    {myField.lowMedian === myField.highMedian
                      ? `${myField.midMedian}%`
                      : `${myField.lowMedian}–${myField.highMedian}%`}
                  </span>
                  .
                </p>
              ) : myField !== null ? (
                // A field where NOT ONE program clears the reporting threshold.
                // Agriculture is the live case: 8 programs, none chartable. It
                // used to fall through to the dataset-wide sentence below,
                // which is true and reads as though some of those 369 were
                // theirs. Same sentence OverviewView gives this state, because
                // the two pages must not answer it differently.
                <p className="text-sm leading-relaxed text-slate">
                  {myField.label} has {myField.programs.toLocaleString()} program
                  {myField.programs === 1 ? '' : 's'} here, and no single one has enough reports
                  yet to describe a range. That is a fact about who filled in a survey, not about
                  the programs.
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-slate">
                  <span className="font-600 text-ink [font-variant-numeric:tabular-nums]">
                    {totals.programsWithCharts}
                  </span>{' '}
                  of the {totals.programs.toLocaleString()} programs here have enough reports to
                  show that median. The rest say &ldquo;not enough data yet&rdquo;, which is a
                  fact about who filled in a survey rather than about the program.
                </p>
              )}
              <p className="mt-3 text-xs leading-relaxed text-slate">
                Every median here is what students who received offers reported. Because people
                who get in are likelier to report, they describe who answered — never your
                chances.
              </p>
            </div>
          )}
        </div>
      ) : nothingToPlace ? (
        // THE THIRD EMPTY STATE, and the one that used to be a blank page.
        // `BalanceCheck` returns null when no kept program has a median
        // (BalanceCheck.tsx:34, via `balanceOf`), and 132 programs in the
        // catalogue have none — so a student who kept only those got the
        // header and then nothing, with no way to tell the tool apart from a
        // broken one. Reachable on purpose from Explore, since those programs
        // are listed like any other.
        <div className="rounded-xl border border-line bg-surface p-6">
          <p className="font-600 text-ink">Nothing on your list to place yet.</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate">
            All {kept.length} of your kept program{kept.length === 1 ? '' : 's'} say &ldquo;not
            enough data yet&rdquo; — not enough students have reported an average for them, so
            there is no median to set your {average}% against. Keep one that has a median and it
            appears here.
          </p>
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-slate">
            Thin reporting is not a sign a program is easy or unpopular. It means few people who
            applied came back to say what happened.
          </p>
        </div>
      ) : (
        <BalanceCheck average={average} programs={kept} />
      )}
    </>
  )
}
