import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { CITY_POINTS, distanceKm, mapCity, project, type Point } from '../data/campus-locations'
import { DURATION, EASE, staggerDelay } from '../lib/motion'
import type { University } from '../data/types'

// Where the schools actually are.
//
// There is no coastline and no provincial outline, on purpose. Drawing one
// without real boundary data would mean inventing the shape of Ontario, and a
// site whose whole argument is "we only tell you what the data says" cannot
// hand-draw a border and present it as a map. What is here is true: relative
// positions, distances, and how much sits in each place.
//
// Marks are cities, sized by how many programs are in them — see the note in
// campus-locations.ts for why cities rather than campuses.

export type CityGroup = {
  city: string
  point: Point
  universities: University[]
  programs: number
}

/**
 * Group universities into the cities we can place.
 *
 * Anything in an unlisted city comes back in `unplaceable` rather than being
 * silently dropped — a school that quietly vanished from the map would be worse
 * than one the page admits it cannot draw.
 */
export function groupByCity(universities: University[]): {
  groups: CityGroup[]
  unplaceable: University[]
} {
  const groups = new Map<string, CityGroup>()
  const unplaceable: University[] = []

  for (const u of universities) {
    const city = mapCity(u.city)
    const point = CITY_POINTS[city]
    if (!point) {
      unplaceable.push(u)
      continue
    }
    const existing = groups.get(city)
    if (existing) {
      existing.universities.push(u)
      existing.programs += u.programCount
    } else {
      groups.set(city, { city, point, universities: [u], programs: u.programCount })
    }
  }

  return {
    // Biggest first, so the small marks draw on top of the large ones and stay
    // clickable rather than being covered by Toronto.
    groups: [...groups.values()].sort((a, b) => b.programs - a.programs),
    unplaceable,
  }
}

const W = 760
const H = 460

export default function CampusMap({
  universities,
  home,
}: {
  universities: University[]
  /** the city the student picked, for distances. null = none chosen */
  home: string | null
}) {
  const [active, setActive] = useState<string | null>(null)
  const { groups } = useMemo(() => groupByCity(universities), [universities])

  const bounds = useMemo(() => {
    const lats = groups.map((g) => g.point.lat)
    const lons = groups.map((g) => g.point.lon)
    // A small margin so the outermost marks are not flush against the frame.
    return {
      minLat: Math.min(...lats) - 0.4,
      maxLat: Math.max(...lats) + 0.4,
      minLon: Math.min(...lons) - 0.6,
      maxLon: Math.max(...lons) + 0.6,
    }
  }, [groups])

  if (!groups.length) return null

  const maxPrograms = Math.max(...groups.map((g) => g.programs))
  // Area-proportional, not radius-proportional: sizing the radius by the value
  // makes Toronto look four times bigger than it is.
  const radiusFor = (n: number) => 5 + Math.sqrt(n / maxPrograms) * 17

  const homePoint = home ? CITY_POINTS[home] ?? null : null
  const shown = groups.find((g) => g.city === active) ?? null

  // Which cities get a permanent label.
  //
  // Southern Ontario is the problem: Toronto, Mississauga, Scarborough,
  // Hamilton, Waterloo and Guelph sit inside about 100km, and labelling all of
  // them at map scale produced an unreadable stack of overlapping words. So
  // labels are placed greedily, largest city first, and one is skipped when it
  // would land on top of a label already placed. Nothing is lost: an unlabelled
  // mark still names itself on hover, on focus, and in the readout below.
  const labelled = useMemo(() => {
    const placed: Array<{ x: number; y: number }> = []
    const keep = new Set<string>()
    for (const g of groups) {
      const { x, y } = project(g.point, bounds, { width: W, height: H, pad: 40 })
      const clash = placed.some((p) => Math.abs(p.x - x) < 58 && Math.abs(p.y - y) < 16)
      if (clash) continue
      placed.push({ x, y })
      keep.add(g.city)
    }
    return keep
  }, [groups, bounds])

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
          aria-label={`${groups.length} cities with universities, ${universities.length} schools in total`}
        >
          {/* A faint graticule instead of a coastline: it gives the eye
              something to measure against without asserting a border. */}
          {[0.25, 0.5, 0.75].map((f) => (
            <g key={f} stroke="var(--color-line)" strokeWidth="1" opacity="0.5">
              <line x1={W * f} y1={0} x2={W * f} y2={H} />
              <line x1={0} y1={H * f} x2={W} y2={H * f} />
            </g>
          ))}

          <text x={16} y={26} fontSize="11" fill="var(--color-slate)" style={{ fontWeight: 600 }}>
            N ↑
          </text>

          {/* Lines from home to everywhere, drawn under the marks. */}
          {homePoint &&
            groups.map((g) => {
              const a = project(homePoint, bounds, { width: W, height: H, pad: 40 })
              const b = project(g.point, bounds, { width: W, height: H, pad: 40 })
              return (
                <line
                  key={`ray-${g.city}`}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="var(--color-brand-300)"
                  strokeWidth="1"
                  opacity={active === g.city ? 0.9 : 0.25}
                />
              )
            })}

          {groups.map((g, i) => {
            const { x, y } = project(g.point, bounds, { width: W, height: H, pad: 40 })
            const r = radiusFor(g.programs)
            const isHome = g.city === home
            const isActive = g.city === active
            return (
              <motion.g
                key={g.city}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: DURATION.base, ease: EASE.out, delay: staggerDelay(i) }}
                style={{ transformOrigin: `${x}px ${y}px`, cursor: 'pointer' }}
                onPointerEnter={() => setActive(g.city)}
                onPointerLeave={() => setActive((c) => (c === g.city ? null : c))}
                tabIndex={0}
                onFocus={() => setActive(g.city)}
                onBlur={() => setActive((c) => (c === g.city ? null : c))}
              >
                <circle
                  cx={x} cy={y} r={r}
                  fill="var(--color-chart)"
                  opacity={isActive ? 0.55 : 0.3}
                  stroke={isHome ? 'var(--color-accent)' : 'var(--color-chart)'}
                  strokeWidth={isHome ? 2.5 : 1.5}
                />
                {/* The city you are pointing at, and the one you call home,
                    are always named — those are the two you are reading. */}
                {(labelled.has(g.city) || isActive || isHome) && (
                  <text
                    x={x} y={y + r + 13}
                    textAnchor="middle"
                    fontSize="11"
                    fill={isActive || isHome ? 'var(--color-ink)' : 'var(--color-slate)'}
                    style={{ fontWeight: isActive || isHome ? 600 : 400 }}
                  >
                    {g.city}
                  </text>
                )}
                <title>{`${g.city}: ${g.universities.length} school${
                  g.universities.length === 1 ? '' : 's'
                }, ${g.programs} programs`}</title>
              </motion.g>
            )
          })}
        </svg>
      </div>

      {/* The readout sits below the map rather than floating over it, for the
          same reason the chart's does: a panel that covers what you are pointing
          at is worse than one that stays still. */}
      <div className="mt-4 min-h-[7rem] rounded-xl border border-line bg-paper p-4">
        {shown ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-600 text-ink">{shown.city}</h3>
              {homePoint && shown.city !== home && (
                <span className="text-sm text-slate">
                  about {distanceKm(homePoint, shown.point).toLocaleString()} km from {home}, in a
                  straight line
                </span>
              )}
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {shown.universities.map((u) => (
                <li key={u.id}>
                  <Link
                    to={`/profile/programs?uni=${u.id}`}
                    className="flex items-baseline justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:border-brand-300"
                  >
                    <span className="min-w-0 truncate text-ink">{u.name}</span>
                    <span className="shrink-0 text-xs text-slate [font-variant-numeric:tabular-nums]">
                      {u.programCount} programs
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-slate">
            Hover or tab through a city to see the schools there
            {home ? ` and how far it is from ${home}` : ''}. Each circle is sized by how many
            programs sit in that city.
          </p>
        )}
      </div>
    </div>
  )
}
