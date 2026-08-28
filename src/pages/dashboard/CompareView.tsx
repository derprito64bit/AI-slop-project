import CompareTable from '../../components/CompareTable'
import { useDashboard } from './context'
import type { Program } from '../../data/types'

// Side by side. Chosen from the list rather than here, so the picking happens
// where the programs already are.
export default function CompareView() {
  const { compare, byId, uniName, toggleCompare, profile } = useDashboard()
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

      <CompareTable
        programs={programs}
        taking={profile.courses}
        uniName={uniName}
        onRemove={toggleCompare}
      />
    </>
  )
}
