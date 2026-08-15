import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Eyebrow from '../../components/ui/Eyebrow'
import { loadCatalogue } from '../../lib/dataSource'
import { gapFor } from '../../lib/courses'
import { getProgramInfo } from '../../data/program-info'
import {
  AMBITION_LABELS,
  FIELD_LABELS,
  PROVINCE_LABELS,
  clearProfile,
  loadProfile,
  type SavedProfile,
} from '../../lib/profile'
import type { DashboardContext } from './context'
import type { Program, University } from '../../data/types'

// The dashboard shell: a persistent sidebar, the active tool, and a context rail.
//
// This replaced a tab strip. Tabs kept every tool on one URL, so you could not
// link to your course gaps, and the back button jumped out of the dashboard
// entirely instead of to the previous tool. Each tool is now its own route.
//
// The sidebar is grouped rather than flat because the tool list is expected to
// grow; a flat list of ten items is where navigation stops being navigable.

const COLLAPSE_KEY = 'acceptiversity.dash.collapsed'

type NavItem = { to: string; label: string; icon: string; badge?: string | number }

export default function DashboardShell() {
  const [profile, setProfile] = useState<SavedProfile | null>(null)
  const [data, setData] = useState<{ programs: Program[]; universities: University[] } | null>(null)
  const [compare, setCompare] = useState<string[]>([])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setProfile(loadProfile())
    loadCatalogue().then(setData).catch(() => {})
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
    } catch {
      /* storage unavailable — start expanded */
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        /* not worth failing over */
      }
      return !c
    })
  }

  const byId = useMemo(() => new Map((data?.programs ?? []).map((p) => [p.id, p])), [data])
  const uniName = useMemo(
    () => new Map((data?.universities ?? []).map((u) => [u.id, u.name])),
    [data],
  )
  const kept = useMemo(
    () => (profile?.shortlist ?? []).map((id) => byId.get(id)).filter((p): p is Program => !!p),
    [profile, byId],
  )

  const toggleCompare = useCallback((id: string) => {
    setCompare((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  /** Programs on the list with an unmet prerequisite — the badge worth showing. */
  const gapCount = useMemo(() => {
    if (!profile) return 0
    return kept.filter((p) => {
      const gap = gapFor(getProgramInfo(p.id)?.requiredCourses, profile.courses)
      return gap && !gap.satisfied
    }).length
  }, [kept, profile])

  // Nothing stored at all — offer both doors rather than an empty chrome.
  if (!profile) return <FirstRun />

  const average = profile.answers?.average ?? null

  const context: DashboardContext = {
    profile, setProfile, data, byId, uniName, kept, average, compare, toggleCompare,
  }

  const groups: Array<{ label: string; items: NavItem[] }> = [
    {
      label: 'My planning',
      items: [
        { to: 'list', label: 'My list', icon: '◫', badge: kept.length || undefined },
        { to: 'balance', label: 'Balance', icon: '◑' },
        { to: 'courses', label: 'Courses', icon: '✓', badge: gapCount || undefined },
        { to: 'compare', label: 'Compare', icon: '⇔', badge: compare.length || undefined },
      ],
    },
    {
      label: 'Find more',
      items: [
        { to: '/explore', label: 'Explore programs', icon: '⌕' },
        { to: '/survey', label: profile.answers ? 'Change answers' : 'Answer 4 questions', icon: '✎' },
      ],
    },
  ]

  return (
    <div className="container-page py-8">
      <div className="flex gap-8">
        {/* ---------------------------------------------------- sidebar --- */}
        <aside
          className={`sticky top-24 hidden h-fit shrink-0 md:block ${collapsed ? 'w-14' : 'w-56'}`}
        >
          <nav aria-label="Dashboard">
            {groups.map((group) => (
              <div key={group.label} className="mb-6">
                {!collapsed && (
                  <p className="mb-2 px-3 text-[11px] font-600 uppercase tracking-wider text-slate">
                    {group.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={!item.to.startsWith('/')}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                            isActive && !item.to.startsWith('/')
                              ? 'bg-brand-50 font-600 text-brand-600'
                              : 'text-slate hover:bg-surface hover:text-ink'
                          }`
                        }
                      >
                        <span aria-hidden="true" className="w-4 shrink-0 text-center">
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.badge !== undefined && (
                              <span className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[11px] font-600 text-slate [font-variant-numeric:tabular-nums]">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate transition-colors hover:bg-surface hover:text-ink"
          >
            <span aria-hidden="true" className="w-4 shrink-0 text-center">
              {collapsed ? '→' : '←'}
            </span>
            {!collapsed && <span>Collapse</span>}
          </button>
        </aside>

        {/* ------------------------------------------------------- main --- */}
        <main className="min-w-0 flex-1">
          {/* Mobile: the sidebar becomes a scrolling row of the tools. */}
          <nav aria-label="Dashboard" className="-mx-6 mb-6 overflow-x-auto px-6 md:hidden">
            <ul className="flex gap-1.5">
              {groups[0].items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm transition-colors ${
                        isActive
                          ? 'border-brand-500 bg-brand-50 font-600 text-brand-600'
                          : 'border-line text-slate'
                      }`
                    }
                  >
                    {item.label}
                    {item.badge !== undefined && (
                      <span className="text-xs text-slate">{item.badge}</span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <Outlet context={context} />
        </main>

        {/* -------------------------------------------------------- rail --- */}
        {/* Context, not navigation: what we know about you and how to change
            it. Hidden below xl, where its content would just push the tool
            off-screen — everything here is reachable elsewhere. */}
        <aside className="sticky top-24 hidden h-fit w-64 shrink-0 xl:block">
          <div className="rounded-xl border border-line bg-paper p-4">
            <Eyebrow>Your answers</Eyebrow>
            {profile.answers ? (
              <>
                <dl className="mt-3 space-y-2 text-sm">
                  <Row label="Studying" value={FIELD_LABELS[profile.answers.field] ?? profile.answers.field} />
                  <Row
                    label="Region"
                    value={profile.answers.province ? PROVINCE_LABELS[profile.answers.province] : 'Anywhere'}
                  />
                  <Row label="Average" value={`${profile.answers.average}%`} />
                  <Row label="Net" value={AMBITION_LABELS[profile.answers.ambition].label} />
                </dl>
                <Link
                  to="/survey"
                  className="mt-4 inline-block text-sm font-600 text-brand-600 hover:text-brand-700"
                >
                  Change answers
                </Link>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm leading-relaxed text-slate">
                  You haven&rsquo;t answered the four questions. Balance and matching need an
                  average to compare against.
                </p>
                <Button to="/survey" className="mt-4">
                  Answer them
                </Button>
              </>
            )}
          </div>

          <div className="mt-4 rounded-xl border border-line bg-surface p-4">
            <p className="text-sm leading-relaxed text-slate">
              Everything here is stored on this device only — no account, nothing uploaded.
            </p>
            <button
              type="button"
              onClick={() => {
                clearProfile()
                setProfile(null)
              }}
              className="mt-3 text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
            >
              Delete my data
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate">{label}</dt>
      <dd className="text-right font-500 text-ink">{value}</dd>
    </div>
  )
}

function FirstRun() {
  return (
    <section className="container-page max-w-2xl py-24">
      <Eyebrow>My profile</Eyebrow>
      <h1 className="mt-2 font-display text-display-1 font-600 text-ink">
        Somewhere to think it through.
      </h1>
      <p className="mt-3 text-lead text-slate">
        Keep programs as you browse, tick off the courses you&rsquo;re taking, and see how your list
        actually stacks up. Everything stays on this device.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button to="/survey">Answer four questions</Button>
        <Button to="/explore" variant="secondary">
          Just let me browse
        </Button>
      </div>
    </section>
  )
}
