import CompareTable, { CompareEmpty } from '../../components/CompareTable'
import { useDashboard } from './context'
import type { Program } from '../../data/types'

// Side by side.
//
// Staging normally happens on My list, where the programs already are, and this
// page was only ever the output. That made it the one tool that showed a new
// student nothing at all: a sentence telling them to go to another page and
// come back, with no way to find out what would be waiting when they did. So
// the zero state stages from here too — see CompareEmpty.
//
// The branch is here rather than inside the table because the empty state needs
// the shortlist and `toggleCompare`, and CompareTable receives neither. It
// keeps its own guard for anything under two programs regardless.
export default function CompareView() {
  const { compare, byId, uniName, toggleCompare, profile, kept, data } = useDashboard()
  const programs = compare.map((id) => byId.get(id)).filter((p): p is Program => !!p)

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-display-2 font-600 text-ink">Compare</h1>
        <p className="mt-2 max-w-2xl text-slate">
          Everything the universities state, next to everything students reported — and what
          you&rsquo;re still short of for each one.
        </p>
      </header>

      {programs.length === 0 ? (
        <CompareEmpty
          kept={kept}
          hasList={profile.shortlist.length > 0}
          loaded={data !== null}
          uniName={uniName}
          onStage={toggleCompare}
        />
      ) : (
        <CompareTable
          programs={programs}
          taking={profile.courses}
          uniName={uniName}
          onRemove={toggleCompare}
        />
      )}
    </>
  )
}
