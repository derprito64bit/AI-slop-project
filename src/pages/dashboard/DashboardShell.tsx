import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import Button from '../../components/ui/Button'
import Eyebrow from '../../components/ui/Eyebrow'
import { VIEW_ENTER } from '../../lib/motion'
import { loadCatalogue } from '../../lib/dataSource'
import { gapFor } from '../../lib/courses'
import { getProgramInfo } from '../../data/program-info'
import {
  AMBITION_LABELS,
  EMPTY_PROFILE,
  FIELD_LABELS,
  PROVINCE_LABELS,
  clearProfile,
  loadProfile,
  type SavedProfile,
} from '../../lib/profile'
import { useAuth } from '../../lib/authContext'
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
// The groups are the shape of a school year rather than a feature list:
//
//   Overview   where am I
//   Plan       the list I am building          (built)
//   Discover   how I find more to put on it    (built)
//   Track      what I have to actually do      (not live yet)
//   Community  what everyone else found        (not live yet)
//
// The last two are placeholders on purpose — real layout, mock content, and a
// banner saying so — so the shape of the finished product is visible and
// judgeable before the parts that need a backend or a research pass exist.

const COLLAPSE_KEY = 'acceptiversity.dash.collapsed'

type NavItem = {
  to: string
  label: string
  icon: string
  badge?: string | number
  /** shows a dot instead of a badge: visible in the nav, not yet usable */
  soon?: boolean
}

export default function DashboardShell() {
  const { pathname } = useLocation()
  const { user, sync } = useAuth()
  const [profile, setProfile] = useState<SavedProfile | null>(null)
  const [data, setData] = useState<{ programs: Program[]; universities: University[] } | null>(null)
  const [compare, setCompare] = useState<string[]>([])
  const [collapsed, setCollapsed] = useState(false)

  // Keyed on the account id, not just mount. `loadProfile()` reads whichever
  // record the session points at, so signing in or out while the dashboard is
  // open has to re-read — otherwise the previous account's shortlist stays on
  // screen and the next edit writes it into the new account's record.
  useEffect(() => {
    setProfile(loadProfile())
    setCompare([])
  }, [user?.id])

  useEffect(() => {
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
  //
  // Account is the one exception. Somebody who has just created an account and
  // kept nothing yet still needs a page to change their password or sign out on,
  // and bouncing them to "answer four questions" instead is a dead end.
  const isAccountRoute = pathname.endsWith('/account')
  if (!profile && !isAccountRoute) return <FirstRun signedIn={Boolean(user)} />

  // Empty rather than null for the account route, so every view can still assume
  // the full shape. Nothing is written until the student changes something.
  const shown: SavedProfile = profile ?? { ...EMPTY_PROFILE, savedAt: new Date().toISOString() }
  const average = shown.answers?.average ?? null

  const context: DashboardContext = {
    profile: shown, setProfile, data, byId, uniName, kept, average, compare, toggleCompare, gapCount,
  }

  const groups: Array<{ label: string; items: NavItem[] }> = [
    {
      label: 'Overview',
      items: [
        { to: '.', label: 'Dashboard', icon: '⌂' },
        // Sits in the nav signed out too, where it explains what an account
        // would do. Hiding it until you have one is how a feature stays unfound.
        { to: 'account', label: user ? 'Account' : 'Sign in', icon: '◉' },
      ],
    },
    {
      label: 'Plan',
      items: [
        { to: 'list', label: 'My list', icon: '◫', badge: kept.length || undefined },
        { to: 'balance', label: 'Balance', icon: '◑' },
        { to: 'courses', label: 'Courses', icon: '✓', badge: gapCount || undefined },
        { to: 'compare', label: 'Compare', icon: '⇔', badge: compare.length || undefined },
      ],
    },
    {
      label: 'Discover',
      items: [
        { to: 'programs', label: 'Programs', icon: '⌕' },
        { to: 'fields', label: 'Fields', icon: '◈' },
        { to: 'map', label: 'Map', icon: '◎' },
        { to: '/survey', label: shown.answers ? 'Change answers' : 'Answer 4 questions', icon: '✎' },
      ],
    },
    {
      label: 'Track',
      items: [
        { to: 'applications', label: 'Applications', icon: '↗', soon: true },
        { to: 'deadlines', label: 'Deadlines', icon: '◷', soon: true },
      ],
    },
    {
      label: 'Community',
      items: [{ to: 'posts', label: 'Global posts', icon: '☷', soon: true }],
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
                            {/* A hollow dot marks a section you can open and
                                look at but not yet use. Better than hiding
                                them: the plan is visible, and clicking one
                                explains itself. */}
                            {item.soon && (
                              <span
                                aria-label="not live yet"
                                title="Not live yet"
                                className="h-1.5 w-1.5 shrink-0 rounded-full border border-slate/60"
                              />
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
        {/* A div, not a <main>: Layout already renders the page's <main
            id="main">, and this sits inside it. Two main landmarks is one too
            many — a screen reader offers "main" twice and neither is the
            document's content.

            The minimum height is part of the transition, not the layout. Views
            differ enormously in length — Programs runs to hundreds of rows,
            Deadlines is a short list — and without a floor the footer flew up
            the screen on every switch, which reads as a jolt however smooth
            the fade on top of it is. */}
        <div className="min-h-[60vh] min-w-0 flex-1">
          {/* Mobile: the sidebar becomes one scrolling row. Every in-dashboard
              section is here, in sidebar order — a phone should not get a
              smaller product, only a narrower one. Links out of the dashboard
              (the survey) are left off; the row is for switching tools. */}
          <nav aria-label="Dashboard" className="-mx-6 mb-6 overflow-x-auto px-6 md:hidden">
            <ul className="flex gap-1.5">
              {groups
                .flatMap((g) => g.items)
                .filter((item) => !item.to.startsWith('/'))
                .map((item) => (
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
                      {item.soon && (
                        <span
                          aria-label="not live yet"
                          className="h-1.5 w-1.5 rounded-full border border-slate/60"
                        />
                      )}
                    </NavLink>
                  </li>
                ))}
            </ul>
          </nav>

          {/* The new tool eases up into place; the old one is simply gone.
              No AnimatePresence, because the thing that made this flash was
              waiting out an exit: the column stood empty in between. Keying on
              pathname is what replays the entrance when you switch tools. */}
          <motion.div
            key={pathname}
            variants={VIEW_ENTER}
            initial="initial"
            animate="animate"
          >
            <Outlet context={context} />
          </motion.div>
        </div>

        {/* -------------------------------------------------------- rail --- */}
        {/* Context, not navigation: what we know about you and how to change
            it. Hidden below xl, where its content would just push the tool
            off-screen — everything here is reachable elsewhere. */}
        <aside className="sticky top-24 hidden h-fit w-64 shrink-0 xl:block">
          <div className="rounded-xl border border-line bg-paper p-4">
            <Eyebrow>Your answers</Eyebrow>
            {shown.answers ? (
              <>
                {/* Every question can be skipped, so every row here has to
                    read properly when its answer is missing — "null%" was
                    exactly what a skipped average used to render as. */}
                <dl className="mt-3 space-y-2 text-sm">
                  <Row
                    label="Studying"
                    value={
                      shown.answers.field
                        ? FIELD_LABELS[shown.answers.field] ?? shown.answers.field
                        : 'Anything'
                    }
                  />
                  <Row
                    label="Region"
                    value={shown.answers.province ? PROVINCE_LABELS[shown.answers.province] : 'Anywhere'}
                  />
                  <Row
                    label="Average"
                    value={
                      typeof shown.answers.average === 'number'
                        ? `${shown.answers.average}%`
                        : 'Not given'
                    }
                  />
                  <Row label="Net" value={AMBITION_LABELS[shown.answers.ambition].label} />
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
            {/* This once read "no account, nothing uploaded". Both halves have
                since stopped being true for a signed-in student, and where their
                data is sitting is not something they should have to discover for
                themselves. */}
            <p className="text-sm leading-relaxed text-slate">
              {user ? (
                <>
                  Saved to <span className="font-600 text-ink">@{user.username}</span>
                  {sync === 'error' ? (
                    <>
                      {' '}
                      on this device. We can&rsquo;t reach the server, so today&rsquo;s changes
                      aren&rsquo;t backed up yet.
                    </>
                  ) : sync === 'pending' || sync === 'pushing' ? (
                    <> and backing up now.</>
                  ) : (
                    <> and backed up to our server.</>
                  )}
                </>
              ) : (
                'Stored on this device, against this browser rather than an account. Nothing is uploaded.'
              )}
            </p>
            <div className="mt-3 flex flex-col items-start gap-2">
              <Link
                to="/profile/account"
                className="text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
              >
                {user ? 'Manage my account' : 'Save this to an account'}
              </Link>
              <button
                type="button"
                onClick={() => {
                  clearProfile()
                  setProfile(null)
                }}
                className="text-sm text-slate underline-offset-2 hover:text-ink hover:underline"
              >
                Delete my data
              </button>
            </div>
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

/**
 * Nothing stored yet.
 *
 * The survey stays the primary door even for a signed-in student — an empty
 * account is still an empty list, and four questions is the fastest way to make
 * it not be. Sign-in is offered only to someone who isn't, and only third, so
 * the page never reads as a login wall.
 */
function FirstRun({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="container-page max-w-2xl py-24">
      <Eyebrow>My profile</Eyebrow>
      <h1 className="mt-2 font-display text-display-1 font-600 text-ink">
        Somewhere to think it through.
      </h1>
      <p className="mt-3 text-lead text-slate">
        Keep programs as you browse, tick off the courses you&rsquo;re taking, and see how your list
        actually stacks up.{' '}
        {signedIn
          ? 'Saved to your account, so it’s there on any device.'
          : 'Everything stays on this device unless you make an account.'}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button to="/survey">Answer four questions</Button>
        <Button to="/explore" variant="secondary">
          Just let me browse
        </Button>
      </div>
      {!signedIn && (
        <p className="mt-6 text-sm text-slate">
          Already made an account?{' '}
          <Link to="/signin" className="font-600 text-brand-600 hover:text-brand-700">
            Sign in
          </Link>{' '}
          to pick your list back up.
        </p>
      )}
    </section>
  )
}
