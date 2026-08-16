import NotLiveYet, { MockLabel } from '../../components/NotLiveYet'

// Global posts — the layout, not the posts.
//
// The idea: what everyone else is finding, in one feed. Someone reports an
// offer, someone asks which of two programs to take, someone posts what their
// supplementary actually asked for.
//
// Two things have to be true before a single real post appears here, and
// neither exists yet:
//
//  1. A BACKEND. Everything on this site is static files and localStorage;
//     there is nowhere for a post to live.
//  2. MODERATION, because the audience is mostly minors. The rule the whole
//     project runs on is that no personal data is published — the ETL already
//     refuses to read the username column in the source spreadsheet, and the
//     survey posts only an anonymous band. A feed cannot be shipped with less
//     care than that: no names, no schools, no ages, nothing that identifies a
//     student, and something has to check.
//
// The mock posts below are written to show that shape — outcomes and questions,
// attributed to nobody.

const MOCK = [
  {
    tag: 'Reported outcome',
    body: 'Offer from an example engineering program, mid-90s average, applied in the first round.',
    meta: 'Anonymous · example cycle',
  },
  {
    tag: 'Question',
    body: 'Two programs, same school, one has co-op and one doesn’t — did anyone regret picking the non-co-op one?',
    meta: 'Anonymous · 12 replies',
  },
  {
    tag: 'Supplementary',
    body: 'The video response was three questions, 90 seconds each, no retries. Practise out loud first.',
    meta: 'Anonymous · example cycle',
  },
]

export default function PostsView() {
  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-display-2 font-600 text-ink">Global posts</h1>
        <p className="mt-2 max-w-2xl text-slate">
          What everyone else is finding — outcomes, questions, and what the applications actually
          asked for.
        </p>
      </header>

      <NotLiveYet
        what="This will be a shared feed of anonymous outcomes and questions."
        blocker="It needs two things this site does not have: somewhere on a server for posts to live, and moderation — the audience is mostly under 18, so nothing that could identify a student can ever be published here."
      />

      <div className="mb-3">
        <MockLabel>Example posts — written by nobody</MockLabel>
      </div>

      <ul className="grid gap-3 opacity-80">
        {MOCK.map((post) => (
          <li key={post.body} className="rounded-xl border border-line bg-paper p-4">
            <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-600 uppercase tracking-wider text-slate">
              {post.tag}
            </span>
            <p className="mt-3 leading-relaxed text-ink">{post.body}</p>
            <p className="mt-2 text-xs text-slate">{post.meta}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs leading-relaxed text-slate">
        When this is live, posts will carry no name, no school and no age — the same rule the rest
        of the site follows. The number beside a program is still a count of what people reported,
        never an acceptance rate.
      </p>
    </>
  )
}
