import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import Reveal from '../components/Reveal'
import Carousel from '../components/Carousel'
import { CAMPUS_ITEMS, POPULAR_ITEMS } from '../data/universities'

const STEPS = [
  { n: '01', title: 'Build your profile', body: 'Add your grades, interests, budget, and the kind of campus life you want.' },
  { n: '02', title: 'See your matches', body: 'Programs ranked by how well they fit you — not just generic rankings.' },
  { n: '03', title: 'Check your odds', body: 'Realistic admission chances, grounded in what actual students reported.' },
]

const FEATURED = [
  { program: 'Computer Science', school: 'University of Waterloo', avg: 'low-90s', tag: 'Reach' },
  { program: 'Life Sciences', school: 'McMaster University', avg: 'mid-80s', tag: 'Likely' },
  { program: 'Commerce', school: 'Queen’s University', avg: 'high-80s', tag: 'Reach' },
  { program: 'Engineering', school: 'University of Toronto', avg: 'low-90s', tag: 'Reach' },
]

const VALUES = [
  { title: 'Real accepted averages', body: 'Not the vague cutoffs on official sites — the numbers students actually got in with.' },
  { title: 'Community-sourced stats', body: 'Admitted students share grades and results, so you see the full picture.' },
  { title: 'Transparent methodology', body: 'We show where every number comes from. No black-box guessing.' },
]

export default function Home() {
  return (
    <>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden">
        {/* soft background wash */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 to-paper" />
        <div className="pointer-events-none absolute -right-32 -top-32 -z-10 h-96 w-96 rounded-full bg-brand-100 blur-3xl opacity-60" />

        <div className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-sm font-500 uppercase tracking-wider text-brand-500"
          >
            For Ontario high schoolers
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 max-w-3xl font-display text-5xl font-600 leading-[1.05] tracking-tight text-ink sm:text-6xl"
          >
            Find where you <span className="text-brand-500">actually</span> get in.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-lg text-slate"
          >
            Official sites give vague cutoffs. We use real admission data — personalized to
            your grades and interests — so you know your true odds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/profile"
              className="rounded-full bg-brand-500 px-6 py-3 text-sm font-600 text-white shadow-sm transition-colors hover:bg-brand-600"
            >
              Build my profile
            </Link>
            <Link
              to="/explore"
              className="rounded-full border border-line bg-paper px-6 py-3 text-sm font-600 text-ink transition-colors hover:border-brand-300 hover:text-brand-600"
            >
              Explore programs
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ============ CAMPUS CAROUSEL (above How it works) ============ */}
      {/* Rotating band of university images. Placeholders for now — set
          `img` on each item in src/data/universities.ts to use real photos. */}
      <section className="py-10">
        <Reveal className="mx-auto mb-6 max-w-6xl px-6">
          <p className="text-sm font-500 uppercase tracking-wider text-brand-500">
            Universities on the platform
          </p>
        </Reveal>
        <Carousel
          items={CAMPUS_ITEMS}
          speed={45}
          direction="left"
          tileWidth={320}
          aspect="16 / 10"
          gap={20}
        />
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="font-display text-3xl font-600 text-ink">How it works</h2>
          <p className="mt-2 max-w-lg text-slate">Three steps from “I have no idea” to a real shortlist.</p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className="h-full rounded-2xl border border-line bg-paper p-7 transition-shadow hover:shadow-[0_8px_30px_rgba(20,24,31,0.06)]">
                <div className="font-display text-4xl font-500 text-brand-300">{s.n}</div>
                <h3 className="mt-4 text-lg font-600 text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= FEATURED PROGRAMS ================= */}
      <section className="bg-cloud">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-600 text-ink">Popular right now</h2>
                <p className="mt-2 text-slate">A peek at programs students are comparing.</p>
              </div>
              <Link to="/explore" className="hidden text-sm font-600 text-brand-600 hover:text-brand-700 sm:block">
                Browse all →
              </Link>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURED.map((f, i) => (
              <Reveal key={f.program + f.school} delay={i * 0.08}>
                <Link
                  to="/program"
                  className="group block h-full rounded-2xl border border-line bg-paper p-5 transition-all hover:-translate-y-1 hover:shadow-[0_12px_36px_rgba(20,24,31,0.08)]"
                >
                  <div className="mb-4 h-24 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50" />
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-600 ${
                      f.tag === 'Reach' ? 'bg-accent/15 text-accent' : 'bg-success/15 text-success'
                    }`}
                  >
                    {f.tag}
                  </span>
                  <h3 className="mt-3 font-600 text-ink group-hover:text-brand-600">{f.program}</h3>
                  <p className="text-sm text-slate">{f.school}</p>
                  <p className="mt-3 text-xs text-slate">Accepted avg · {f.avg}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Rotating carousel of popular programs — placeholder images for now. */}
        <Reveal className="mx-auto max-w-6xl px-6 pb-4">
          <p className="text-sm font-500 uppercase tracking-wider text-brand-500">
            Trending programs
          </p>
        </Reveal>
        <div className="pb-16">
          <Carousel
            items={POPULAR_ITEMS}
            speed={38}
            direction="right"
            tileWidth={260}
            aspect="4 / 3"
            gap={18}
          />
        </div>
      </section>

      {/* ================= VALUES ================= */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="max-w-2xl font-display text-3xl font-600 text-ink">
            Built to be honest — the part other sites skip.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.1}>
              <div className="border-t-2 border-brand-500 pt-5">
                <h3 className="text-lg font-600 text-ink">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate">{v.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <Reveal>
          <div className="overflow-hidden rounded-3xl bg-brand-700 px-8 py-16 text-center sm:px-16">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-600 text-white sm:text-4xl">
              Stop guessing. See your real odds.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-brand-100">
              Build a profile in a few minutes and get a shortlist that fits you.
            </p>
            <Link
              to="/profile"
              className="mt-8 inline-block rounded-full bg-white px-7 py-3 text-sm font-600 text-brand-700 transition-transform hover:scale-[1.03]"
            >
              Get started — it’s free
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
