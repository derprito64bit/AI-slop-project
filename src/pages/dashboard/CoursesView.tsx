import CourseChecklist from '../../components/CourseChecklist'
import { toggleCourse } from '../../lib/profile'
import { useDashboard } from './context'

// Prerequisites: the one hard gate on this site. An average is a comparison;
// a missing course is a closed door.
export default function CoursesView() {
  const { profile, setProfile, kept, uniName } = useDashboard()

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-display-2 font-600 text-ink">Courses</h1>
        <p className="mt-2 max-w-2xl text-slate">
          Tick what you&rsquo;re taking and see which programs on your list you still need
          prerequisites for.
        </p>
      </header>

      <CourseChecklist
        taking={profile.courses}
        onToggle={(code) => setProfile(toggleCourse(code))}
        programs={kept}
        uniName={uniName}
      />
    </>
  )
}
