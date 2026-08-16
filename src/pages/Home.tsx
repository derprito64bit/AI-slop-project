import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react'
import Reveal from '../components/Reveal'
import Parallax from '../components/Parallax'
import CountUp from '../components/CountUp'
import Carousel from '../components/Carousel'
import UniversityBanner from '../components/UniversityBanner'
import HeroSearch from '../components/HeroSearch'
import Roadmap from '../components/Roadmap'
import Button from '../components/ui/Button'
import Eyebrow from '../components/ui/Eyebrow'
import { CAMPUS_ITEMS, POPULAR_ITEMS } from '../data/universities'
import SUMMARY from '../data/generated/summary.json'

// Every figure below comes from src/data/generated/summary.json, which the ETL
// writes from the dataset. It is ~1kB, so unlike programs.json it can be
// imported eagerly here. Hand-typing these was how the page ended up claiming
// "120+ programs" against a real 2,436.
const STATS = [
  { end: SUMMARY.programs, suffix: '', label: 'Programs tracked' },
  { end: SUMMARY.universities, suffix: '', label: 'Universities' },
  { end: SUMMARY.reports, suffix: '', label: 'Student reports' },
  { end: SUMMARY.programsWithCharts, suffix: '', label: 'With enough data to chart' },
]

// Step 03 used to read "Check your odds — realistic admission chances". It is
// the one claim this site must never make: 94-97% of the source records are
// offers, because students who get in are far likelier to report, so any
// "chance" derived from them is reporting bias with a percent sign on it. What
// the data does support is the distribution of averages admitted students
// reported, which is what the step now describes.
const STEPS = [
  { n: '01', title: 'Build your profile', body: 'Add your grades, interests, budget, and the kind of campus life you want.' },
  { n: '02', title: 'See your matches', body: 'Programs ranked by how well they fit you — not just generic rankings.' },
  { n: '03', title: 'See the real averages', body: 'What admitted students actually reported — medians, spread, and how many said so.' },
]

// Real programs, real medians, real links — the four most-reported, one per
// school. Previously these were hand-written with invented averages and all
// four linked to a bare /program, which just redirects to Explore.
const FEATURED = SUMMARY.featured.slice(0, 4)

const VALUES = [
  { title: 'Real accepted averages', body: 'Not the vague cutoffs on official sites — the numbers students actually got in with.' },
  { title: 'Community-sourced stats', body: 'Admitted students share grades and results, so you see the full picture.' },
  { title: 'Transparent methodology', body: 'We show where every number comes from. No black-box guessing.' },
]

export default function Home() {
  return (
    <>
      {/* ================= HERO ================= */}
      {/* The section deliberately does NOT clip. Its overflow-hidden used to
          live here to contain the blur blob, but it also clipped the search
          suggestions, which drop below the hero's bottom edge. Clipping is now
          scoped to the decorative layer only. */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {/* soft background wash + graph-paper texture (decorative) */}
          <div className="absolute inset-0 -z-20 bg-gradient-to-b from-brand-50 to-paper" />
          <div className="bg-grid pattern-fade absolute inset-0 -z-10" />
          {/* parallax accent blob — drifts as you scroll */}
          <Parallax distance={70} className="absolute -right-32 -top-32 -z-10">
            <div className="h-96 w-96 rounded-full bg-brand-100 opacity-60 blur-3xl" />
          </Parallax>
        </div>

        {/* Floating editorial photos — desktop only. Squared frames, slight tilt.
            Swap the placeholders for real campus/student photos later. */}
        {/* Anchored to the page container, not the viewport edge — otherwise on a
            wide monitor these drift hundreds of px away from the headline. */}
        <div className="pointer-events-none absolute inset-0 z-0 hidden lg:block" aria-hidden="true">
          <div className="container-page relative h-full">
            <Parallax distance={38} className="absolute right-0 top-16 w-52 rotate-3 2xl:w-64 3xl:w-72">
              <PhotoFrame label="Waterloo" logo="waterloo" gradient="from-brand-100 to-brand-50" ratio="4 / 5" />
            </Parallax>
            <Parallax distance={80} className="absolute right-48 top-48 w-40 -rotate-3 2xl:right-56 2xl:w-48 3xl:right-64 3xl:w-56">
              <PhotoFrame label="McMaster" logo="mcmaster" gradient="from-cloud to-brand-100" ratio="1 / 1" />
            </Parallax>
            <Parallax distance={56} className="absolute right-6 top-80 w-36 rotate-6 2xl:w-44 3xl:w-52">
              <PhotoFrame label="Western" logo="western" gradient="from-brand-50 to-cloud" ratio="4 / 3" />
            </Parallax>
          </div>
        </div>

        <div className="relative z-10 container-page pb-24 pt-20 sm:pt-28">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="text-sm font-500 uppercase tracking-wider text-brand-500"
          >
            For Ontario high schoolers
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 max-w-3xl font-display text-display-1 font-600 text-ink"
          >
            Find where you <span className="text-brand-500">actually</span> get in.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-lead text-slate"
          >
            Official sites give vague cutoffs. We show what admitted students actually
            reported — the real averages behind the programs you&rsquo;re considering.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Button to="/profile">Build my profile</Button>
            <Button to="/explore" variant="secondary">
              Explore programs
            </Button>
          </motion.div>

          {/* Quick search — suggests programs as you type, and falls through to
              Explore for the full result list. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroSearch />
          </motion.div>
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
              <Reveal key={`${f.universityId}-${f.slug}`} delay={i * 0.04}>
                <Link
                  to={`/program/${f.universityId}/${f.slug}`}
                  className="group block h-full overflow-hidden rounded-2xl border border-line bg-paper transition-all hover:-translate-y-1 hover:shadow-[0_12px_36px_rgba(20,24,31,0.08)]"
                >
                  {/* Same logo band as the Explore cards — fills the top edge to edge. */}
                  <UniversityBanner id={f.universityId} name={f.school} className="aspect-[16/9]" />
                  <div className="p-5">
                    <h3 className="font-600 text-ink group-hover:text-brand-600">{f.name}</h3>
                    <p className="text-sm text-slate">{f.school}</p>
                    {/* Median with its sample size — a median without an n is the
                        kind of number this site exists to replace. */}
                    <p className="mt-3 text-xs text-slate">
                      Accepted median · {f.median}% of {f.sampleSize} offers
                    </p>
                  </div>
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
            imgFit="contain"
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
            <Reveal key={v.title} delay={i * 0.04}>
              <div className="border-t-2 border-brand-500 pt-5">
                <h3 className="text-lg font-600 text-ink">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate">{v.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* A testimonials section lived here with three invented students
          ("Priya, Grade 12 · Mississauga"). Removed 2026-08-08: fabricated
          quotes are the one thing that would undercut a site whose whole pitch
          is not misleading students. Bring it back when the community page
          produces real, consented submissions. */}

      {/* ================= CTA ================= */}
      <section className="container-page pb-8 pt-20">
        <Reveal>
          <div className="overflow-hidden rounded-3xl bg-brand-700 px-8 py-16 text-center sm:px-16">
            <h2 className="mx-auto max-w-2xl font-display text-display-2 font-600 text-white">
              Stop guessing. See the real numbers.
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

// A squared, slightly-matted frame. Intentionally NOT pill-rounded — editorial,
// not corporate. With `logo` it shows a university mark on white; without one it
// falls back to the original gradient tile, so campus photos can replace either
// later without touching the layout.
function PhotoFrame({
  label,
  gradient,
  ratio,
  logo,
}: {
  label: string
  gradient: string
  ratio: string
  logo?: string
}) {
  return (
    <div className="rounded-md border border-line bg-paper p-1.5 shadow-[0_12px_40px_rgba(20,24,31,0.12)]">
      {logo ? (
        <img
          src={`${import.meta.env.BASE_URL}images/universities/square/${logo}.png`}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="w-full rounded-sm bg-white object-contain p-3"
          style={{ aspectRatio: ratio }}
        />
      ) : (
        <div
          className={`flex items-end justify-start rounded-sm bg-gradient-to-br ${gradient} p-2`}
          style={{ aspectRatio: ratio }}
        >
          <span className="rounded bg-paper/80 px-1.5 py-0.5 text-[9px] font-600 uppercase tracking-wider text-slate">
            {label}
          </span>
        </div>
      )}
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
