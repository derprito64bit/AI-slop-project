import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { COURSES, COURSE_NAMES, gapFor, parseRequirement } from '../lib/courses'
import type { ListNeeds } from '../lib/courseNeeds'
import { getProgramInfo } from '../data/program-info'
import type { Program } from '../data/types'

// Which Grade 12 courses you're taking, and what that means for your list.
//
// Prerequisites are the one hard gate on this site: an average is a
// comparison, but a missing course is a closed door. That makes this the most
// useful tool here and the most dangerous — see the safety rules at the top of
// lib/courses.ts. Anything unresolved is shown as the university's own wording
// and never counted against a program.
//
// REQUIRED AND RECOMMENDED ARE KEPT VISIBLY APART, and the separation is the
// safety rule rather than a layout choice. `ProgramInfo` has carried
// `recommendedCourses` since the research began and nothing has ever rendered
// it, so a course the university merely suggests has been invisible. Showing it
// is useful. Showing it anywhere near the missing-prerequisite list would be
// worse than not showing it at all: a student who drops a required course
// because it looked optional loses a year, and `gapFor` deliberately never
// reads the recommended list for exactly that reason.
//
// So: different heading, different weight, an explicit "not required" label,
// and no effect on whether a program counts as blocked.

export default function CourseChecklist({
  taking,
  onToggle,
  programs,
  uniName,
  needs,
}: {
  taking: string[]
  onToggle: (code: string) => void
  programs: Program[]
  uniName: Map<string, string>
  /** the list-level rollup, computed once in the shell */
  needs: ListNeeds
}) {
  // Memoised: this re-parses every requirement string of every kept program,
  // and it used to run on every render — including every one of the nine course
  // toggles above, which is the most-clicked control on the page.
  const rows = useMemo(
    () =>
      programs.map((p) => {
        const info = getProgramInfo(p.id)
        return { program: p, info, gap: gapFor(info?.requiredCourses, taking) }
      }),
    [programs, taking],
  )

  const unverified = rows.filter((r) => !r.gap)
  const blocked = rows.filter((r) => r.gap && !r.gap.satisfied)
  const clear = rows.filter((r) => r.gap?.satisfied)

  return (
    <section>
      <h3 className="font-display text-display-3 font-600 text-ink">Courses you&rsquo;re taking</h3>
      {/* Used to end "Saved on this device only", which stopped being true for a
          signed-in student when profiles started syncing. The account page is
          where the full answer lives; this just does not claim otherwise. */}
      <p className="mt-2 max-w-2xl text-sm text-slate">
        Tick your Grade 12 U courses. Saved automatically.
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

          {/* The heading finally saying something about the LIST.
              Everything below it is per-program, and a student with six kept
              programs read "Still needs Chemistry" six times without ever being
              told that one course would clear four of them. That sentence is
              the most actionable thing this tool can produce and it was the one
              thing missing.

              It leads with coverage rather than with a clean-looking zero:
              "nothing missing" and "we have not read the requirements" are
              different facts, and only one of them is good news. */}
          <div className="mt-4 rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed">
            {needs.requiredCodes.length === 0 && needs.choices.length === 0 ? (
              <p className="text-slate">
                {needs.unverified === programs.length
                  ? 'None of the programs on your list have had their requirements read yet, so there is nothing to check against. That is a gap in our research, not a clear run.'
                  : 'Nothing specific is outstanding for the programs we have read.'}
              </p>
            ) : (
              <>
                <p className="text-ink">
                  <span className="font-600">
                    Your list names {needs.requiredCodes.length} course
                    {needs.requiredCodes.length === 1 ? '' : 's'}.
                  </span>{' '}
                  You have {needs.heldCodes.length} of them.
                </p>

                {/* "NEEDED BY", not "would clear". Adding this course removes
                    one requirement from those programs; it does not follow that
                    they are then clear, because they may be short others too.
                    An earlier draft said "would clear 2 of your 3 programs",
                    which is the kind of small overstatement a student would
                    plan a timetable around. */}
                {needs.missing.length > 0 && (
                  <p className="mt-2 text-slate">
                    <span className="font-600 text-ink">
                      {COURSE_NAMES[needs.missing[0].code] ?? needs.missing[0].code}
                    </span>{' '}
                    is the one your list asks for most — {needs.missing[0].programIds.length} of
                    your {programs.length} {programs.length === 1 ? 'program' : 'programs'}{' '}
                    {needs.missing[0].programIds.length === 1 ? 'needs' : 'need'} it.
                  </p>
                )}

                {needs.unused.length > 0 && (
                  <p className="mt-2 text-slate">
                    {needs.unused.map((c) => COURSE_NAMES[c] ?? c).join(', ')}{' '}
                    {needs.unused.length === 1 ? 'is' : 'are'} ticked, and no program we have read
                    on your list asks for {needs.unused.length === 1 ? 'it' : 'them'}.
                  </p>
                )}
              </>
            )}

            {needs.unverified > 0 && needs.unverified !== programs.length && (
              <p className="mt-2 text-xs text-slate">
                Based on the {needs.blocked + needs.covered} of {programs.length} we have read the
                requirements for.
              </p>
            )}
          </div>

          {blocked.length > 0 && (
            <ul className="mt-5 space-y-3">
              {blocked.map(({ program, info, gap }) => (
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

                  <p className="mt-3 text-[11px] font-600 uppercase tracking-wider text-accent">
                    Required
                  </p>

                  {gap!.missing.length > 0 && (
                    <p className="mt-1 text-sm text-ink">
                      Still needs{' '}
                      <strong className="font-600">
                        {gap!.missing.map((c) => COURSE_NAMES[c] ?? c).join(', ')}
                      </strong>
                    </p>
                  )}

                  {gap!.choices.map((ch, i) => (
                    <p key={i} className="mt-1 text-sm text-ink">
                      Needs {ch.count} of{' '}
                      {ch.codes.map((c) => COURSE_NAMES[c] ?? c).join(', ')}{' '}
                      <span className="text-slate">({ch.have} so far)</span>
                    </p>
                  ))}

                  {gap!.notes.length > 0 && <Notes notes={gap!.notes} />}

                  <Recommended courses={info?.recommendedCourses} taking={taking} />
                </li>
              ))}
            </ul>
          )}

          {clear.length > 0 && (
            <div className="mt-5 rounded-xl border border-line bg-surface p-4">
              <p className="text-sm font-600 text-ink">
                {clear.length} program{clear.length === 1 ? '' : 's'} — prerequisites covered
              </p>
              {/* Deliberately compact: these are the ones needing no action, so
                  they get a line each rather than a card each. The exception is
                  a recommended course, which is the one thing here a student
                  might still want to do something about. */}
              <ul className="mt-1 space-y-1">
                {clear.map((r) => (
                  <li key={r.program.id} className="text-sm text-slate">
                    {r.program.name}
                    {r.info?.recommendedCourses?.length ? (
                      <Recommended courses={r.info.recommendedCourses} taking={taking} inline />
                    ) : null}
                  </li>
                ))}
              </ul>
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

/**
 * Courses the university suggests but does not require.
 *
 * NEVER A GAP. It renders nothing at all when the program has no recommended
 * list, says "not required" on its face, and takes no part in whether a program
 * counts as blocked — `gapFor` does not read this field and must not start.
 *
 * A course the student is already taking is ticked, because "you have this one
 * covered" is the useful half of the message. One that is missing is stated
 * plainly and left alone: it is a suggestion, and dressing it up as an
 * outstanding item is how a recommendation turns into a false requirement.
 *
 * The wording is the university's own, parsed only far enough to spot a single
 * named course. Anything more complicated is printed verbatim.
 */
function Recommended({
  courses,
  taking,
  inline = false,
}: {
  courses?: string[]
  taking: string[]
  /** a one-line variant, for the compact "prerequisites covered" list */
  inline?: boolean
}) {
  if (!courses?.length) return null

  const have = new Set(taking)
  const items = courses.map((text) => {
    const req = parseRequirement(text)
    return { text, held: req.kind === 'course' && have.has(req.code) }
  })

  if (inline) {
    return (
      <span className="text-xs text-slate">
        {' '}
        · also recommends {items.map((i) => i.text).join('; ')}{' '}
        <span className="text-slate/70">(not required)</span>
      </span>
    )
  }

  return (
    <div className="mt-3 border-t border-line pt-2">
      <p className="text-[11px] font-600 uppercase tracking-wider text-slate">
        Recommended · not required
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((i) => (
          <li key={i.text} className="text-xs leading-relaxed text-slate">
            <span aria-hidden="true" className={i.held ? 'text-brand-600' : 'text-slate/60'}>
              {i.held ? '✓ ' : '· '}
            </span>
            {i.text}
            {i.held && <span className="sr-only"> — you are taking this</span>}
          </li>
        ))}
      </ul>
    </div>
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
