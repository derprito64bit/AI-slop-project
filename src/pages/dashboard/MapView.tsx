import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CampusMap, { groupByCity } from '../../components/CampusMap'
import { ListSkeleton, LoadingNote } from '../../components/Skeleton'
import { CITY_POINTS } from '../../data/campus-locations'
import { PROVINCE_LABELS } from '../../lib/profile'
import { useDashboard } from './context'

// "Where are these places, actually?"
//
// The site could answer what a program wants and what students reported, but
// not where it is — and distance from home decides a lot of real shortlists,
// often more than a median does. Every university record already carried a
// city; nothing used it.
//
// Ontario is drawn. The sixteen schools elsewhere in Canada are listed instead
// of plotted: a map of the whole country for schools in Halifax, Vancouver and
// Regina would be mostly empty space, and the list tells you the same thing.

const HOME_KEY = 'acceptiversity.map.home'

export default function MapView() {
  const { data } = useDashboard()
  const universities = data?.universities ?? []

  const ontario = useMemo(() => universities.filter((u) => u.province === 'ON'), [universities])
  const elsewhere = useMemo(
    () =>
      universities
        .filter((u) => u.province !== 'ON')
        .sort((a, b) => a.province.localeCompare(b.province) || b.programCount - a.programCount),
    [universities],
  )

  // Which city the student calls home, for distances. Stored like everything
  // else here — on the device, and never sent anywhere. A city is not an
  // address: it is the coarsest thing that still makes the distances mean
  // something.
  const [home, setHome] = useState<string | null>(() => {
    try {
      return localStorage.getItem(HOME_KEY)
    } catch {
      return null
    }
  })

  const chooseHome = (city: string) => {
    setHome(city || null)
    try {
      if (city) localStorage.setItem(HOME_KEY, city)
      else localStorage.removeItem(HOME_KEY)
    } catch {
      /* storage unavailable — the map still works, distances just do not persist */
    }
  }

  const { unplaceable } = useMemo(() => groupByCity(ontario), [ontario])

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-display-2 font-600 text-ink">Map</h1>
        <p className="mt-2 max-w-2xl text-slate">
          Where the universities are, and how far apart. Distance decides more shortlists than
          people admit — living at home, going home at reading week, how often anyone visits.
        </p>
      </header>

      <label className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate">
        Measure distances from
        <select
          value={home ?? ''}
          onChange={(e) => chooseHome(e.target.value)}
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-brand-300"
        >
          <option value="">nowhere in particular</option>
          {Object.keys(CITY_POINTS)
            .sort()
            .map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
        </select>
        <span className="text-xs">Stays on this device.</span>
      </label>

      {!data ? (
        <>
          <LoadingNote>Loading universities…</LoadingNote>
          <ListSkeleton rows={4} />
        </>
      ) : (
        <>
          <CampusMap universities={ontario} home={home} />

          {/* Anything the map could not place. Empty in practice — it exists so
              a new city in the dataset shows up as a visible gap rather than a
              school that quietly stopped existing. */}
          {unplaceable.length > 0 && (
            <p className="mt-4 rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm text-ink">
              Not on the map yet: {unplaceable.map((u) => `${u.name} (${u.city})`).join(', ')}. Add
              the city to <code>src/data/campus-locations.ts</code>.
            </p>
          )}

          <section className="mt-10">
            <h2 className="font-display text-display-3 font-600 text-ink">
              Elsewhere in Canada
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate">
              {elsewhere.length} schools outside Ontario have reports in the dataset — far fewer
              than the Ontario ones, so treat their numbers as thinner evidence rather than as a
              quieter admissions story.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {elsewhere.map((u) => (
                <li key={u.id}>
                  <Link
                    to={`/profile/programs?uni=${u.id}`}
                    className="flex min-w-0 items-baseline justify-between gap-3 rounded-lg border border-line bg-paper px-3 py-2 text-sm transition-colors hover:border-brand-300"
                  >
                    <span className="min-w-0 truncate text-ink">{u.name}</span>
                    <span className="shrink-0 text-xs text-slate">
                      {u.city}, {PROVINCE_LABELS[u.province] ? u.province : u.province}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-8 text-xs leading-relaxed text-slate">
            Positions are approximate city centres, not campus addresses, and distances are
            straight-line — nobody travels in a straight line, so treat them as a sense of scale
            rather than a journey time.
          </p>
        </>
      )}
    </>
  )
}
