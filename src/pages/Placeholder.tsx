import { Link, useSearchParams } from 'react-router-dom'

// Temporary page for sections not yet built. Each gets its own branch
// (feature/explore, feature/program, ...) and replaces this.
export default function Placeholder({ title, blurb }: { title: string; blurb: string }) {
  const [params] = useSearchParams()
  const q = params.get('q')

  return (
    <section className="mx-auto max-w-3xl px-6 py-28 text-center">
      <p className="text-sm font-500 uppercase tracking-wider text-brand-500">Coming together</p>
      <h1 className="mt-3 font-display text-4xl font-600 text-ink">{title}</h1>
      <p className="mx-auto mt-4 max-w-xl text-slate">{blurb}</p>
      {q && (
        <p className="mx-auto mt-4 inline-block rounded-full border border-line bg-cloud px-4 py-2 text-sm text-ink">
          Searching for: <span className="font-600 text-brand-600">{q}</span>
        </p>
      )}
      <Link
        to="/"
        className="mt-8 inline-block rounded-full border border-line px-5 py-2.5 text-sm font-500 text-ink transition-colors hover:border-brand-300 hover:text-brand-600"
      >
        ← Back home
      </Link>
    </section>
  )
}
