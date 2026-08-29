import { useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import Button from '../../components/ui/Button'
import Eyebrow from '../../components/ui/Eyebrow'
import { VIEW_ENTER } from '../../lib/motion'
import { loadCatalogue } from '../../lib/dataSource'
import { listNeeds } from '../../lib/courseNeeds'
import {
  AMBITION_LABELS,
  EMPTY_PROFILE,
  FIELD_LABELS,
  PROVINCE_LABELS,
  clearProfile,
  coopLabel,
  loadProfile,
  type SavedProfile,
} from '../../lib/profile'
import { tickedCourses } from '../../lib/overview'
import { CITY_POINTS } from '../../data/campus-locations'
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
//   Track      what I have to actually do      (built)
//   Understand where all of this came from     (built)
//
// There was a fifth group, Community, holding a single "Global posts" item:
// real layout, mock content, a banner saying so. It is gone. A feed needs a
// server and needs moderation for an audience that is mostly minors, and
// neither was any closer than the day it was drawn — meanwhile it sat in the
// sidebar duplicating the idea of the /community page. Understand is what
// replaced both: the data, its bias, and what it cannot tell you, in one place.
//
// Track became real once its blocker turned out to be a design question rather
// than missing infrastructure: see lib/tracker.ts.

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

  /**
   * The one requirement walk, for everything that needs one.
   *
   * Keyed on `profile?.courses` rather than `profile`: the previous version
   * depended on the whole object, so editing a note or renaming a tag re-parsed
   * every requirement string on the list for no reason.
   */
  const needs = useMemo(
    () => listNeeds(kept, profile?.courses ?? []),
    [kept, profile?.courses],
  )
  const gapCount = needs.blocked

  // Nothing stored at all — offer both doors rather than an empty chrome.
  //
  // Two exceptions, and both are about not stranding somebody who has a real
  // reason to be on a page before they have a profile:
  //
  //   account   somebody who has just created an account and kept nothing yet
  //             still needs a page to change their password or sign out on,
  //             and bouncing them to "answer the questions" is a dead end.
  //   database  the methodology. It used to be /about, a public page reachable
  //             from the navbar; it is now a dashboard tool, and gating it
  //             behind a saved profile would mean a first-time visitor — or
  //             anyone following the /about redirect — cannot read how the
  //             numbers were made before deciding whether to trust them. That
  //             is precisely backwards.
  const isOpenRoute = pathname.endsWith('/account') || pathname.endsWith('/database')
  if (!profile && !isOpenRoute) return <FirstRun signedIn={Boolean(user)} />

  // Empty rather than null for the account route, so every view can still assume
  // the full shape. Nothing is written until the student changes something.
  const shown: SavedProfile = profile ?? { ...EMPTY_PROFILE, savedAt: new Date().toISOString() }
  const average = shown.answers?.average ?? null

  const context: DashboardContext = {
    profile: shown, setProfile, data, byId, uniName, kept, average, compare, toggleCompare,
    needs, gapCount,
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
        { to: '/survey', label: shown.answers ? 'Change answers' : 'Answer the questions', icon: '✎' },
      ],
    },
    {
      label: 'Track',
      items: [
        { to: 'applications', label: 'Applications', icon: '↗' },
        { to: 'deadlines', label: 'Deadlines', icon: '◷' },
      ],
    },
    {
      label: 'Understand',
      items: [{ to: 'database', label: 'The data', icon: '▤' }],
    },
  ]

  // The only link to /admin anywhere on the site, and it exists solely so an
  // admin does not have to remember a URL. It is not what protects the route —
  // AdminShell renders a 404 without the flag, and UniServer re-reads the
  // database on every write. This is a convenience, and appears for nobody else.
  if (user?.isAdmin) {
    groups.push({ label: 'Admin', items: [{ to: '/admin', label: 'Site content', icon: '✎' }] })
  }

  return (
    <div className="container-page py-8">
      <div className="flex gap-8">
        {/* ---------------------------------------------------- sidebar --- */}
        {/* One step up from the page, not two, and the same card idiom used
            everywhere else rather than a bespoke treatment for the chrome.
            It was fully transparent before — no background, no border, no
            padding — so the only painted pixels in the whole column were the
            active item and hover, and navigation and content shared a surface.

            `surface` is DARKER than `paper` in light and LIGHTER in dark, which
            is the conventional reading in each: chrome recedes on white, lifts
            on black. One token, correct in both, no `dark:` variant.

            The padding is inside the fixed width, because box-sizing is
            border-box — so this cannot widen the flex row or trip the sweep's
            horizontal-overflow check. Collapsed gets less of it, or the 40px
            icon rows would not fit inside 56px. */}
        <aside
          className={`sticky top-24 hidden h-fit shrink-0 rounded-xl border border-line bg-surface md:block ${
            collapsed ? 'w-14 p-1.5' : 'w-56 p-3'
          }`}
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
          {/* bg-surface, not bg-paper: paper is the page colour, so this card
              was distinguished from its background by nothing but a hairline.
              The rail itself stays transparent — giving it a surface too would
              nest one panel inside another for no gain. */}
          <div className="rounded-xl border border-line bg-surface p-4">
            {/* All eight, in the order the survey asks them (STEPS in
                lib/surveySteps.ts). It used to be four, under the heading
                "Some of your answers" — hedged on purpose, because claiming
                "Your answers" while hiding co-op, home city, graduating year
                and courses made those four look like questions that were never
                asked, and reopening the survey was the only way to find out
                otherwise. Now that all eight show, the heading can say so.

                COURSES IS HERE despite living on `profile.courses` rather than
                on `answers` — the survey asks it (step 6), so a student looking
                for what they told us expects to find it. Do not "tidy" it out
                because the object it comes from is different. */}
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
                  <Row label="Co-op" value={coopLabel(shown.answers.coop)} />
                  {/* `?? province` rather than a bare lookup. PROVINCE_LABELS
                      is not exhaustive over what can be stored: applyRemoteProfile
                      validates `ambition` and `coop` and copies `province`
                      straight through, so an unknown code rendered blank here. */}
                  <Row
                    label="Region"
                    value={
                      shown.answers.province
                        ? PROVINCE_LABELS[shown.answers.province] ?? shown.answers.province
                        : 'Anywhere'
                    }
                  />
                  {/* Checked against CITY_POINTS, not against truthiness. A city
                      the map cannot place is functionally not an answer — the
                      map's own dropdown renders blank for it — so echoing it
                      back would show a value nothing on the site can use. */}
                  <Row
                    label="Home city"
                    value={
                      shown.answers.homeCity && CITY_POINTS[shown.answers.homeCity]
                        ? shown.answers.homeCity
                        : 'Rather not say'
                    }
                  />
                  <Row
                    label="Average"
                    value={
                      typeof shown.answers.average === 'number'
                        ? `${shown.answers.average}%`
                        : 'Not given'
                    }
                  />
                  <Row
                    label="Courses"
                    value={
                      tickedCourses(shown) === 0 ? 'None ticked' : `${tickedCourses(shown)} ticked`
                    }
                  />
                  <Row
                    label="Graduating"
                    value={
                      typeof shown.answers.gradYear === 'number'
                        ? String(shown.answers.gradYear)
                        : 'Not given'
                    }
                  />
                  {/* Same guard as Region, for the same reason. */}
                  <Row
                    label="Net"
                    value={AMBITION_LABELS[shown.answers.ambition]?.label ?? 'Balanced'}
                  />
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
                  You haven&rsquo;t answered the questions yet. Balance and matching need an
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
 * account is still an empty list, and the questions are the fastest way to make
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
        <Button to="/survey">Answer the questions</Button>
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
