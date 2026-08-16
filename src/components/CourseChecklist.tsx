import { Link } from 'react-router-dom'
import { COURSES, COURSE_NAMES, gapFor } from '../lib/courses'
import { getProgramInfo } from '../data/program-info'
import type { Program } from '../data/types'

// Which Grade 12 courses you're taking, and what that means for your list.
//
// Prerequisites are the one hard gate on this site: an average is a
// comparison, but a missing course is a closed door. That makes this the most
// useful tool here and the most dangerous — see the safety rules at the top of
// lib/courses.ts. Anything unresolved is shown as the university's own wording
// and never counted against a program.

export default function CourseChecklist({
  taking,
  onToggle,
  programs,
  uniName,
}: {
  taking: string[]
  onToggle: (code: string) => void
  programs: Program[]
  uniName: Map<string, string>
}) {
  const rows = programs.map((p) => {
    const info = getProgramInfo(p.id)
    return { program: p, info, gap: gapFor(info?.requiredCourses, taking) }
  })

  const unverified = rows.filter((r) => !r.gap)
  const blocked = rows.filter((r) => r.gap && !r.gap.satisfied)
  const clear = rows.filter((r) => r.gap?.satisfied)

  return (
    <section>
      <h3 className="font-display text-display-3 font-600 text-ink">Courses you&rsquo;re taking</h3>
      <p className="mt-2 max-w-2xl text-sm text-slate">
        Tick your Grade 12 U courses. Saved on this device only.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {COURSES.map((c) => {
          const on = taking.includes(c.code)
          return (
            <button
              key={c.code}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(c.code)}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                on
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-line bg-paper text-ink hover:border-brand-300'
              }`}
            >
              {on ? '✓ ' : ''}
              {c.name}
              <span className={`ml-1.5 text-xs ${on ? 'text-white/70' : 'text-slate'}`}>
                {c.code}
              </span>
            </button>
          )
        })}
      </div>

      {programs.length === 0 ? (
        <p className="mt-8 rounded-xl border border-line bg-surface p-5 text-sm text-slate">
          Keep a few programs and this will show which prerequisites you still need for them.
        </p>
      ) : (
        <>
          <h3 className="mt-12 font-display text-display-3 font-600 text-ink">
            What your list needs
          </h3>

          {blocked.length > 0 && (
            <ul className="mt-5 space-y-3">
              {blocked.map(({ program, gap }) => (
                <li key={program.id} className="rounded-xl border border-line bg-paper p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      to={`/program/${program.universityId}/${program.slug}`}
                      className="font-600 text-ink hover:text-brand-600"
                    >
                      {program.name}
                    </Link>
                    <span className="text-xs text-slate">
                      {uniName.get(program.universityId) ?? program.universityId}
                    </span>
                  </div>

                  {gap!.missing.length > 0 && (
                    <p className="mt-2 text-sm text-ink">
                      Still needs{' '}
                      <strong className="font-600">
                        {gap!.missing.map((c) => COURSE_NAMES[c] ?? c).join(', ')}
                      </strong>
                    </p>
                  )}

                  {gap!.choices.map((ch, i) => (
                    <p key={i} className="mt-2 text-sm text-ink">
                      Needs {ch.count} of{' '}
                      {ch.codes.map((c) => COURSE_NAMES[c] ?? c).join(', ')}{' '}
                      <span className="text-slate">({ch.have} so far)</span>
                    </p>
                  ))}

                  {gap!.notes.length > 0 && <Notes notes={gap!.notes} />}
                </li>
              ))}
            </ul>
          )}

          {clear.length > 0 && (
            <div className="mt-5 rounded-xl border border-line bg-surface p-4">
              <p className="text-sm font-600 text-ink">
                {clear.length} program{clear.length === 1 ? '' : 's'} — prerequisites covered
              </p>
              <p className="mt-1 text-sm text-slate">
                {clear.map((r) => r.program.name).join(' · ')}
              </p>
              {clear.some((r) => r.gap!.notes.length > 0) && (
                <p className="mt-2 text-xs text-slate">
                  Some also list general requirements (an extra 4U course, a total subject count)
                  that a checklist can&rsquo;t confirm — open the program to read them.
                </p>
              )}
            </div>
          )}

          {unverified.length > 0 && (
            <div className="mt-5 rounded-xl border border-line bg-surface p-4">
              <p className="text-sm font-600 text-ink">
                {unverified.length} program{unverified.length === 1 ? '' : 's'} — requirements not
                verified yet
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate">
                We only list courses we&rsquo;ve read on the university&rsquo;s own page. Until then
                we say nothing rather than guess — check the official page for{' '}
                {unverified.map((r) => r.program.name).join(', ')}.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Notes({ notes }: { notes: string[] }) {
  return (
    <div className="mt-2 border-t border-line pt-2">
      <p className="text-xs text-slate">
        Also listed, in the university&rsquo;s wording:
      </p>
      <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed text-slate">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  )
}
