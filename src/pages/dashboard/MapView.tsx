import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CampusMap, { groupByCity } from '../../components/CampusMap'
import { ListSkeleton, FetchingNote } from '../../components/Skeleton'
import { CITY_POINTS } from '../../data/campus-locations'
import { fetchMapConfig, type MapConfig, type UniversityContent } from '../../lib/api'
import { resolveTileSource } from '../../lib/mapTiles'
import { loadUniversityContent } from '../../lib/dataSource'
import { PROVINCE_LABELS, updateProfile } from '../../lib/profile'
import { useDashboard } from './context'

// "Where are these places, actually?"
//
// The site could answer what a program wants and what students reported, but
// not where it is — and distance from home decides a lot of real shortlists,
// often more than a median does. Every university record already carried a
// city; nothing used it.
//
// TWO MAPS, AND BOTH ARE REAL ANSWERS.
//
// `TileMap` draws a surveyed basemap through our own tile proxy. `CampusMap` is
// the hand-drawn SVG scatter that came first: no coastline, because inventing
// the shape of Ontario would be this site drawing something its data does not
// contain. Which one you get depends on whether a tile provider is configured.
//
// The fallback is NOT a placeholder waiting to be deleted. It is what a student
// sees when TILE_URL_TEMPLATE is unset — the state this project is in until
// somebody signs up for a provider — and it is also what covers a sleeping
// Render instance and a provider outage. A blank grey rectangle where a map
// should be reads as a broken site; a working scatter plot does not.
//
// Leaflet is loaded lazily for the same reason the catalogue is: it is ~40kB
// plus a stylesheet that nobody who never opens this tool should pay for.
//
// Ontario is drawn. The schools elsewhere in Canada are listed instead of
// plotted: a map of the whole country for schools in Halifax, Vancouver and
// Regina would be mostly empty space, and the list tells you the same thing.

const TileMap = lazy(() => import('../../components/TileMap'))

/**
 * Where the home city used to live.
 *
 * It is a survey answer now, so it travels with the account instead of being
 * stranded on one browser. This key is still READ once, so nobody who set a
 * city before the move loses it — but nothing writes it any more.
 */
const LEGACY_HOME_KEY = 'acceptiversity.map.home'

export default function MapView() {
  const { data, profile, setProfile } = useDashboard()
  const universities = data?.universities ?? []

  const ontario = useMemo(() => universities.filter((u) => u.province === 'ON'), [universities])
  const elsewhere = useMemo(
    () =>
      universities
        .filter((u) => u.province !== 'ON')
        .sort((a, b) => a.province.localeCompare(b.province) || b.programCount - a.programCount),
    [universities],
  )

  // Which city the student calls home, for distances. A city is not an address:
  // it is the coarsest thing that still makes the distances mean something,
  // which is why it is safe to keep in a profile that syncs.
  //
  // Read from the survey answers, falling back once to the old map-only key so
  // a city chosen before the move is not silently forgotten.
  const [legacyHome, setLegacyHome] = useState<string>(() => {
    try {
      return localStorage.getItem(LEGACY_HOME_KEY) ?? ''
    } catch {
      return ''
    }
  })
  // The legacy key is a FALLBACK FOR AN UNANSWERED QUESTION, not a default that
  // outranks an answer. Reading `answers?.homeCity || legacyHome` made "nowhere
  // in particular" impossible to choose on any device that still had the old
  // key: the empty string is falsy, so the stale city came straight back.
  //
  // So it applies only when there are no survey answers at all — the one state
  // where nothing has been said about a home city either way.
  const home = profile.answers ? profile.answers.homeCity || null : legacyHome || null

  const chooseHome = (city: string) => {
    // Writing through the profile rather than to a key of its own is what makes
    // this follow the student to another device. `updateProfile` returns the
    // saved record, so the view re-renders from the same object the shell holds.
    //
    // AND IT ONLY WRITES `answers` WHEN THERE ALREADY ARE SOME. Fabricating a
    // full default SurveyAnswers here would flip `profile.answers != null` — the
    // site-wide test for "has this student answered the survey?" — on for
    // somebody who has only picked a city off a dropdown. They would stop being
    // offered the survey, and the rail would show four answers they never gave.
    // Before the survey, the city goes back to the standalone key it came from.
    if (!profile.answers) {
      try {
        if (city) localStorage.setItem(LEGACY_HOME_KEY, city)
        else localStorage.removeItem(LEGACY_HOME_KEY)
      } catch {
        /* storage unavailable — the map still works, distances just do not persist */
      }
      setLegacyHome(city)
      return
    }
    setProfile(updateProfile({ answers: { ...profile.answers, homeCity: city } }))
  }

  const { unplaceable } = useMemo(() => groupByCity(ontario), [ontario])

  // Whether a real basemap can be drawn, and the editable prose to hang off the
  // marks. Both are network calls to a service that spends most of its life
  // asleep, so both fail closed: no provider means the SVG map, no content means
  // marks without blurbs. Neither is an error state a student should ever see.
  //
  // `undefined` is "still asking" and is distinct from `{available: false}` —
  // drawing the fallback and then swapping in a real map a second later would be
  // a worse experience than a moment of "Checking for a map".
  const [mapConfig, setMapConfig] = useState<MapConfig | undefined>()
  const [content, setContent] = useState<Record<string, UniversityContent>>({})

  // Whether there is ANY basemap to draw — through our proxy, or straight from
  // a keyless source. `resolveTileSource` owns that cascade and the reasons.
  const hasTiles = resolveTileSource(mapConfig) !== null

  useEffect(() => {
    let live = true
    fetchMapConfig()
      .then((config) => live && setMapConfig(config))
      .catch(() => live && setMapConfig({ available: false, attribution: '' }))
    loadUniversityContent().then((c) => live && setContent(c))
    return () => {
      live = false
    }
  }, [])

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
        {/* This used to say "Stays on this device", which stopped being true the
            moment the home city became a survey answer. The account page is
            where the full story lives; this just does not claim otherwise. */}
        <span className="text-xs">Saved with your answers.</span>
      </label>

      {!data ? (
        <>
          <FetchingNote>Loading universities…</FetchingNote>
          <ListSkeleton rows={4} />
        </>
      ) : (
        <>
          {mapConfig === undefined ? (
            <>
              <FetchingNote slow="Still checking — the server may be waking up.">
                Checking for a map…
              </FetchingNote>
              <div className="mt-3 h-[30rem] w-full rounded-xl border border-line bg-surface" />
            </>
          ) : hasTiles ? (
            // Suspense, because TileMap is a lazy chunk. The fallback reserves
            // the same height the map will take, so the page below it does not
            // jump when Leaflet arrives — the CLS lesson from Skeleton.tsx.
            <Suspense
              fallback={<div className="h-[30rem] w-full rounded-xl border border-line bg-surface" />}
            >
              <TileMap universities={ontario} home={home} config={mapConfig} content={content} />
            </Suspense>
          ) : (
            <CampusMap universities={ontario} home={home} />
          )}

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
                      {/* Both branches of the old ternary were `u.province`,
                          so the lookup did nothing. The code back was two
                          letters either way; spelling the province out is what
                          it was reaching for. */}
                      {u.city}, {PROVINCE_LABELS[u.province] ?? u.province}
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
