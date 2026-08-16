import type { ReactNode } from 'react'

// The banner every unfinished section carries.
//
// These sections are in the navigation on purpose: the shape of the finished
// product is easier to judge from a real layout with mock content than from a
// description. But a mock that does not announce itself is a lie, and this site
// is built on being trusted about numbers — so the banner is loud, it names
// what is missing, and it sits ABOVE the fake content rather than under it.
//
// Rule for anything below one of these: it must be obviously illustrative.
// Never a real program, never a real deadline, never a real student.
export default function NotLiveYet({
  what,
  blocker,
  children,
}: {
  /** what this section will do once it works */
  what: string
  /** why it does not work yet — the honest reason, not a roadmap tease */
  blocker: string
  children?: ReactNode
}) {
  return (
    <div className="mb-6 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <p className="flex items-center gap-2 text-sm font-600 text-ink">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full border border-accent bg-accent/30"
        />
        Not live yet — everything below is made up
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
        {what} {blocker}
      </p>
      {children}
    </div>
  )
}

/** Marks one block of mock content, for anyone who scrolled past the banner. */
export function MockLabel({ children = 'Example content' }: { children?: string }) {
  return (
    <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-600 uppercase tracking-wider text-slate">
      {children}
    </span>
  )
}
