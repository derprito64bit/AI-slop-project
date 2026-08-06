import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react'
import Reveal from '../components/Reveal'
import Parallax from '../components/Parallax'
import CountUp from '../components/CountUp'
import Carousel from '../components/Carousel'
import Roadmap from '../components/Roadmap'
import Button from '../components/ui/Button'
import Tag from '../components/ui/Tag'
import Eyebrow from '../components/ui/Eyebrow'
import { CAMPUS_ITEMS, POPULAR_ITEMS } from '../data/universities'

// Placeholder voices until real community stats land. Swap `initials` for
// student avatars once we have them.
const TESTIMONIALS = [
  {
    quote: 'I thought my average locked me out of everything. Turned out three programs I loved were well within reach.',
    name: 'Priya',
    detail: 'Grade 12 · Mississauga',
    initials: 'PR',
  },
  {
    quote: 'The forums all said 95+. Seeing what people actually got in with took so much pressure off.',
    name: 'Daniel',
    detail: 'Grade 12 · Ottawa',
    initials: 'DA',
  },
  {
    quote: 'I finally had a shortlist I could explain to my parents, with real numbers behind it.',
    name: 'Amara',
    detail: 'First year · Hamilton',
    initials: 'AM',
  },
]

const STATS = [
  { end: 120, suffix: '+', label: 'Programs tracked' },
  { end: 20, suffix: '+', label: 'Ontario universities' },
  { end: 3500, suffix: '+', label: 'Data points' },
  { end: 100, suffix: '%', label: 'Sources cited' },
]

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
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore')
  }

  return (
    <>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden">
        {/* soft background wash + graph-paper texture (decorative) */}
        <div className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-brand-50 to-paper" />
        <div className="bg-grid pattern-fade pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        {/* parallax accent blob — drifts as you scroll */}
        <Parallax distance={70} className="pointer-events-none absolute -right-32 -top-32 -z-10">
          <div className="h-96 w-96 rounded-full bg-brand-100 opacity-60 blur-3xl" />
        </Parallax>

        {/* Floating editorial photos — desktop only. Squared frames, slight tilt.
            Swap the placeholders for real campus/student photos later. */}
        {/* Anchored to the page container, not the viewport edge — otherwise on a
            wide monitor these drift hundreds of px away from the headline. */}
        <div className="pointer-events-none absolute inset-0 z-0 hidden lg:block" aria-hidden="true">
          <div className="container-page relative h-full">
            <Parallax distance={38} className="absolute right-0 top-16 w-52 rotate-3 2xl:w-64 3xl:w-72">
              <PhotoFrame label="Campus life" gradient="from-brand-100 to-brand-50" ratio="4 / 5" />
            </Parallax>
            <Parallax distance={80} className="absolute right-48 top-48 w-40 -rotate-3 2xl:right-56 2xl:w-48 3xl:right-64 3xl:w-56">
              <PhotoFrame label="Students" gradient="from-cloud to-brand-100" ratio="1 / 1" />
            </Parallax>
            <Parallax distance={56} className="absolute right-6 top-80 w-36 rotate-6 2xl:w-44 3xl:w-52">
              <PhotoFrame label="On campus" gradient="from-brand-50 to-cloud" ratio="4 / 3" />
            </Parallax>
          </div>
        </div>

        <div className="relative z-10 container-page pb-24 pt-20 sm:pt-28">
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
            className="mt-4 max-w-3xl font-display text-display-1 font-600 text-ink"
          >
            Find where you <span className="text-brand-500">actually</span> get in.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-lead text-slate"
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
            <Button to="/profile">Build my profile</Button>
            <Button to="/explore" variant="secondary">
              Explore programs
            </Button>
          </motion.div>

          {/* Quick search — routes to Explore with the query */}
          <motion.form
            onSubmit={onSearch}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 flex max-w-md items-center gap-2 rounded-full border border-line bg-paper p-1.5 shadow-sm focus-within:border-brand-300"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a program or university…"
              aria-label="Search programs or universities"
              className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm text-ink outline-none placeholder:text-slate"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-brand-500 px-5 py-2 text-sm font-600 text-white transition-colors hover:bg-brand-600"
            >
              Search
            </button>
          </motion.form>
        </div>
      </section>

      {/* ================= STATS BAND ================= */}
      <StatsBand />

      {/* ============ CAMPUS CAROUSEL (above How it works) ============ */}
      {/* Rotating band of university images. Placeholders for now — set
          `img` on each item in src/data/universities.ts to use real photos. */}
      <section className="py-10">
        <Reveal className="container-page mb-6">
          <Eyebrow>Universities on the platform</Eyebrow>
        </Reveal>
        <Carousel
          items={CAMPUS_ITEMS}
          variant="logo"
          logoHeight={40}
          speed={45}
          direction="left"
          gap={0}
        />
      </section>

      {/* ================= HOW IT WORKS ================= */}
      {/* TEST feature: `pinned` makes this stick to the full screen while the
          roadmap draws as you scroll. Drop `pinned` to revert to inline. The
          pinned variant renders its own heading + full-viewport section. */}
      <Roadmap steps={STEPS} pinned />

      {/* ================= FEATURED PROGRAMS ================= */}
      <section className="relative bg-surface">
        {/* dot grid (decorative) */}
        <div className="bg-dots pattern-fade pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative container-page py-20">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-display-2 font-600 text-ink">Popular right now</h2>
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
                  <Tag tone={f.tag === 'Reach' ? 'reach' : 'likely'}>{f.tag}</Tag>
                  <h3 className="mt-3 font-600 text-ink group-hover:text-brand-600">{f.program}</h3>
                  <p className="text-sm text-slate">{f.school}</p>
                  <p className="mt-3 text-xs text-slate">Accepted avg · {f.avg}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Rotating carousel of popular programs — placeholder images for now. */}
        <Reveal className="container-page pb-4">
          <Eyebrow>Trending programs</Eyebrow>
        </Reveal>
        <div className="pb-16">
          <Carousel
            items={POPULAR_ITEMS}
            speed={38}
            direction="right"
            tileWidth={260}
            aspect="4 / 3"
            gap={18}
            startOffset={0.5}
          />
        </div>
      </section>

      {/* ================= VALUES ================= */}
      <section className="container-page py-20">
        <Reveal>
          <h2 className="max-w-2xl font-display text-display-2 font-600 text-ink">
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

      {/* ================= SOCIAL PROOF ================= */}
      {/* Placeholder voices — replaced by real community stats later.
          Faces/avatars go in the circle once we have them. */}
      <section className="bg-cloud">
        <div className="container-page py-20">
          <Reveal>
            <Eyebrow>From students like you</Eyebrow>
            <h2 className="mt-2 max-w-2xl font-display text-display-2 font-600 text-ink">
              You’re not behind. You just need better information.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.1}>
                <figure className="flex h-full flex-col rounded-lg border border-line bg-paper p-6">
                  <blockquote className="flex-1 text-[15px] leading-relaxed text-ink">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-600 text-brand-600"
                      aria-hidden="true"
                    >
                      {t.initials}
                    </span>
                    <span>
                      <span className="block text-sm font-600 text-ink">{t.name}</span>
                      <span className="block text-xs text-slate">{t.detail}</span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="container-page pb-8 pt-20">
        <Reveal>
          <div className="overflow-hidden rounded-3xl bg-brand-700 px-8 py-16 text-center sm:px-16">
            <h2 className="mx-auto max-w-2xl font-display text-display-2 font-600 text-white">
              Stop guessing. See your real odds.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-white/80">
              Build a profile in a few minutes and get a shortlist that fits you.
            </p>
            <Button to="/profile" variant="inverse" className="mt-8 px-7 py-3">
              Get started — it’s free
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  )
}

// A squared, slightly-matted photo frame placeholder. Intentionally NOT
// pill-rounded — editorial, not corporate. Set a real <img> here later.
function PhotoFrame({ label, gradient, ratio }: { label: string; gradient: string; ratio: string }) {
  return (
    <div className="rounded-md border border-line bg-paper p-1.5 shadow-[0_12px_40px_rgba(20,24,31,0.12)]">
      <div
        className={`flex items-end justify-start rounded-sm bg-gradient-to-br ${gradient} p-2`}
        style={{ aspectRatio: ratio }}
      >
        <span className="rounded bg-paper/80 px-1.5 py-0.5 text-[9px] font-600 uppercase tracking-wider text-slate">
          {label}
        </span>
      </div>
    </div>
  )
}

// ================= STATS BAND (with scroll-zoom TEST feature) =================
// NOTE: the scroll-driven zoom is an experimental effect and can be removed
// later — just render the grid without the motion.div wrapper / scale style.
function StatsBand() {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'center center'],
  })
  // Numbers grow from small to full size as the section scrolls into view.
  const scale = useTransform(scrollYProgress, [0, 1], [0.55, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.4], [0.2, 1])

  return (
    <section ref={ref} className="relative border-y border-line bg-cloud">
      {/* notebook rules behind the numbers (decorative) */}
      <div className="bg-ruled pattern-fade pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative container-page py-16 text-center">
        <Reveal>
          <p className="text-sm font-500 uppercase tracking-wider text-brand-500">
            What we provide to you
          </p>
          <h2 className="mt-2 font-display text-display-3 font-600 text-ink">
            Everything you need, in one place.
          </h2>
        </Reveal>

        <motion.div
          style={reduced ? undefined : { scale, opacity }}
          className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4"
        >
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display text-display-1 font-600 text-brand-600">
                <CountUp end={s.end} suffix={s.suffix} />
              </div>
              <p className="mt-2 text-sm text-slate">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
