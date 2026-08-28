import { useOutletContext } from 'react-router-dom'
import type { ListNeeds } from '../../lib/courseNeeds'
import type { SavedProfile } from '../../lib/profile'
import type { Program, University } from '../../data/types'

// Shared state for the dashboard views.
//
// The shell owns it and passes it down through the router outlet, so each tool
// is a real route (its own URL, its own back-button entry) while still reading
// one copy of the profile and one copy of the catalogue. Fetching per view
// would mean four loads of a 950kB dataset.

export type DashboardContext = {
  profile: SavedProfile
  setProfile: (p: SavedProfile) => void
  /** null until the catalogue has loaded */
  data: { programs: Program[]; universities: University[] } | null
  /** program id -> program, for resolving the shortlist */
  byId: Map<string, Program>
  uniName: Map<string, string>
  /** programs the student kept, in the order they kept them */
  kept: Program[]
  /** the student's average, or null when the survey was skipped */
  average: number | null
  /** ids currently staged for side-by-side comparison */
  compare: string[]
  toggleCompare: (id: string) => void
  /**
   * What the whole list needs, rolled up once.
   *
   * This comment used to say `gapCount` was computed here so no view would walk
   * the shortlist through `gapFor` twice. That was the intent and it was not
   * what happened: the walk also ran in OverviewView twice over (once
   * unmemoised), in CourseChecklist, and in CompareTable — five times per
   * render, re-parsing the same requirement strings each time.
   *
   * Now it genuinely is once. Views read the rollup instead of re-deriving it,
   * which also means they cannot quietly disagree about what "blocked" means.
   */
  needs: ListNeeds
  /** Kept programs with an unmet prerequisite — `needs.blocked`, for the badge. */
  gapCount: number
}

export function useDashboard(): DashboardContext {
  return useOutletContext<DashboardContext>()
}
