import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Eyebrow from '../components/ui/Eyebrow'
import Button from '../components/ui/Button'
import Tag from '../components/ui/Tag'
import UniversityMark from '../components/UniversityMark'
import { loadCatalogue } from '../lib/dataSource'
import { difficultyBand, DIFFICULTY_LABELS } from '../lib/search'
import {
  AMBITION_LABELS,
  FIELD_LABELS,
  PROVINCE_LABELS,
  clearProfile,
  loadProfile,
  matchPrograms,
  toggleShortlist,
  type SavedProfile,
} from '../lib/profile'
import type { Program, University } from '../data/types'

// Where the survey's answers land: your matches, and the ones you've kept.
//
// Everything here comes from localStorage — no account, nothing on a server.
// That is the decision recorded in HANDOFF §4, and it is also why the survey
// can ask for an average at all: it never leaves the device.

export default function Profile() {
  const [profile, setProfile] = useState<SavedProfile | null>(null)
  const [data, setData] = useState<{ programs: Program[]; universities: University[] } | null>(null)

  useEffect(() => {
    setProfile(loadProfile())
    loadCatalogue().then(setData).catch(() => {})
  }, [])

  const matches = useMemo(
    () => (profile && data ? matchPrograms(profile.answers, data.programs, data.universities) : []),
    [profile, data],
  )

  const uniName = useMemo(
    () => new Map((data?.universities ?? []).map((u) => [u.id, u.name])),
    [data],
  )

  const kept = useMemo(
    () => matches.filter((p) => profile?.shortlist.includes(p.id)),
    [matches, profile],
  )

  // No survey taken yet — send them to it rather than showing an empty shell.
  if (!profile) {
    return (
      <section className="container-page max-w-2xl py-24">
        <Eyebrow>My profile</Eyebrow>
        <h1 className="mt-2 font-display text-display-1 font-600 text-ink">
          Let&rsquo;s narrow things down.
        </h1>
        <p className="mt-3 max-w-xl text-lead text-slate">
          Answer four quick questions and we&rsquo;ll turn 2,436 programs into a shortlist you can
          actually work through. Your answers stay on this device.
        </p>
        <Button to="/survey" className="mt-8">
          Start the survey
        </Button>
      </section>
    )
  }

  const { answers } = profile

  return (
    <section className="container-page py-20">
      <Eyebrow>My profile</Eyebrow>
      <h1 className="mt-2 font-display text-display-1 font-600 text-ink">Your shortlist.</h1>

      {/* What they told us, and a way to change it. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Tag>{FIELD_LABELS[answers.field] ?? answers.field}</Tag>
        <Tag>{answers.province ? PROVINCE_LABELS[answers.province] : 'Anywhere'}</Tag>
        <Tag>{answers.average}% average</Tag>
        <Tag>{AMBITION_LABELS[answers.ambition].label}</Tag>
        <Link to="/survey" className="ml-1 text-sm font-600 text-brand-600 hover:text-brand-700">
          Change answers
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

      {kept.length > 0 && (
        <>
          <h2 className="mt-14 font-display text-display-3 font-600 text-ink">
            Kept ({kept.length})
          </h2>
          <ProgramList
            programs={kept}
            uniName={uniName}
            shortlist={profile.shortlist}
            onToggle={(id) => setProfile(toggleShortlist(id))}
          />
        </>
      )}

      <h2 className="mt-14 font-display text-display-3 font-600 text-ink">
        {matches.length > 0 ? `${matches.length} programs match` : 'Matches'}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-slate">
        Programs where admitted students reported averages near yours, most-reported first.
      </p>

      {!data ? (
        <p className="mt-6 text-slate">Loading programs…</p>
      ) : matches.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-surface p-6">
          <p className="text-ink">Nothing matched those answers.</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate">
            Try widening the net — switching the province to &ldquo;Anywhere&rdquo; or moving to a
            more ambitious setting usually brings programs back.
          </p>
          <Button to="/survey" variant="secondary" className="mt-5">
            Adjust answers
          </Button>
        </div>
      ) : (
        <ProgramList
          programs={matches}
          uniName={uniName}
          shortlist={profile.shortlist}
          onToggle={(id) => setProfile(toggleShortlist(id))}
        />
      )}

      <p className="mt-10 max-w-2xl rounded-lg border border-line bg-surface p-4 text-sm leading-relaxed text-slate">
        <strong className="font-600 text-ink">These aren&rsquo;t admission chances.</strong> Students
        who get in report far more often than students who don&rsquo;t, so these medians describe
        who reported — not your odds. Use them to decide what to research, not what to expect.
      </p>
    </section>
  )
}

function ProgramList({
  programs,
  uniName,
  shortlist,
  onToggle,
}: {
  programs: Program[]
  uniName: Map<string, string>
  shortlist: string[]
  onToggle: (id: string) => void
}) {
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {programs.map((p) => {
        const school = uniName.get(p.universityId) ?? p.universityId
        const band = difficultyBand(p)
        const isKept = shortlist.includes(p.id)
        return (
          <li key={p.id} className="flex flex-col rounded-xl border border-line bg-paper p-4">
            <div className="flex items-start gap-3">
              <UniversityMark id={p.universityId} name={school} size={36} />
              <Link
                to={`/program/${p.universityId}/${p.slug}`}
                className="min-w-0 flex-1 hover:text-brand-600"
              >
                <span className="block text-sm font-600 leading-snug text-ink">{p.name}</span>
                <span className="block truncate text-xs text-slate">{school}</span>
              </Link>
            </div>

            <div className="mt-4 flex items-end justify-between gap-2">
              <div>
                <span className="font-display text-xl font-600 text-brand-600 [font-variant-numeric:tabular-nums]">
                  {p.accepted?.median}%
                </span>
                <span className="ml-1.5 text-xs text-slate">of {p.sampleSize}</span>
              </div>
              {band && (
                <Tag tone={band === 'highly-competitive' ? 'reach' : band === 'competitive' ? 'safety' : 'likely'}>
                  {DIFFICULTY_LABELS[band]}
                </Tag>
              )}
            </div>

            <button
              type="button"
              onClick={() => onToggle(p.id)}
              aria-pressed={isKept}
              className={`mt-4 rounded-full border px-3 py-1.5 text-xs font-600 transition-colors ${
                isKept
                  ? 'border-brand-500 bg-brand-50 text-brand-600'
                  : 'border-line text-slate hover:border-brand-300 hover:text-ink'
              }`}
            >
              {isKept ? '✓ Kept' : 'Keep'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
