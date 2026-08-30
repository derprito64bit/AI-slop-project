import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CITY_POINTS, distanceKm } from '../data/campus-locations'
import { CAMPUS_POINTS, CAMPUS_POINTS_READ } from '../data/campus-points'
import { resolveTileSource } from '../lib/mapTiles'
import { groupByCity } from './CampusMap'
import type { MapConfig, UniversityContent } from '../lib/api'
import type { University } from '../data/types'

// The real basemap.
//
// `CampusMap` — the hand-drawn SVG scatter this sits in front of — was built
// with no coastline on purpose: inventing the shape of Ontario would have been
// the site drawing something its data does not contain. A surveyed basemap is
// the opposite of that problem. It is somebody else's real data, credited, with
// our marks on top, and it answers "how far is that, actually" in a way a
// scatter of dots never could.
//
// TWO ZOOM LEVELS, TWO KINDS OF TRUTH.
//
//   Zoomed out, the marks are CITIES, sized by how many programs sit in each.
//   Sixteen Ontario schools inside 100km would otherwise be one unreadable pile,
//   and at that scale "Toronto has six universities" is the useful fact.
//
//   Zoomed in past ZOOM_TO_CAMPUS, they become the CAMPUSES themselves, at the
//   coordinates in campus-points.ts. That file exists because a mark on
//   Hamilton's city hall while the page is showing you McMaster's streets is
//   visibly wrong, and this site's whole argument is that what it shows is true.
//
// THE SVG MAP IS STILL THERE and is still reached. `MapView` falls back to it
// when there is no tile source at all. That fallback is not a placeholder to be
// deleted; it is the honest answer when there is no basemap to draw.
//
// NO REACT WRAPPER LIBRARY. Leaflet owns its own DOM and mutates it directly,
// which is exactly what React expects not to happen. Handing it a ref'd div and
// driving it from effects is smaller and clearer than a binding layer, and it
// keeps the one rule that matters: nothing inside the map container is rendered
// by React.

/** Below this, marks are cities. At or above it, they are campuses. */
const ZOOM_TO_CAMPUS = 10

/** Where clicking a city takes you — close enough to read street names. */
const ZOOM_ON_PICK = 14

export default function TileMap({
  universities,
  home,
  config,
  content,
}: {
  universities: University[]
  /** the city the student picked, for distances. null = none chosen */
  home: string | null
  config: MapConfig
  /** editable prose per university id, when the server had any */
  content: Record<string, UniversityContent>
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const cityLayer = useRef<L.LayerGroup | null>(null)
  const campusLayer = useRef<L.LayerGroup | null>(null)
  const tiles = useRef<L.TileLayer | null>(null)
  /** Whether the camera has been placed. It is the student's to move after that. */
  const framed = useRef(false)

  const dark = useTheme() === 'dark'
  const [scrollArmed, setScrollArmed] = useState(false)

  const { groups } = useMemo(() => groupByCity(universities), [universities])
  const source = useMemo(() => resolveTileSource(config), [config])

  /* ------------------------------------------------------------ create --- */
  // Leaflet throws "Map container is already initialized" if this ever runs
  // twice against the same node, which is exactly what React 19's StrictMode
  // double-invoke does in development — hence the teardown.
  useEffect(() => {
    if (!box.current || map.current) return

    const instance = L.map(box.current, {
      center: [44.4, -79.6],
      zoom: 6,
      // Off until the student clicks the map. Leaflet's default traps the page
      // scroll: someone scrolling past the map ends up zooming it instead and
      // cannot get back out. Clicking is an unambiguous "I meant this one".
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    })

    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(instance)

    cityLayer.current = L.layerGroup().addTo(instance)
    campusLayer.current = L.layerGroup()
    map.current = instance

    const arm = () => {
      instance.scrollWheelZoom.enable()
      setScrollArmed(true)
    }
    const disarm = () => {
      instance.scrollWheelZoom.disable()
      setScrollArmed(false)
    }
    instance.on('click', arm)
    instance.on('mouseout', disarm)

    // Swap city marks for campus marks as the student zooms in. Doing it on the
    // map's own zoomend rather than from React state keeps it in step with the
    // animation instead of a render behind it.
    const onZoom = () => {
      const campus = instance.getZoom() >= ZOOM_TO_CAMPUS
      if (campus && !instance.hasLayer(campusLayer.current!)) {
        instance.removeLayer(cityLayer.current!)
        instance.addLayer(campusLayer.current!)
      } else if (!campus && !instance.hasLayer(cityLayer.current!)) {
        instance.removeLayer(campusLayer.current!)
        instance.addLayer(cityLayer.current!)
      }
    }
    instance.on('zoomend', onZoom)
    // Labels have to be re-thinned whenever the marks move relative to each
    // other, which is every zoom and every pan.
    instance.on('zoomend moveend', () => thinLabels(instance, cityLayer.current))

    return () => {
      instance.off()
      instance.remove()
      map.current = null
      cityLayer.current = null
      campusLayer.current = null
      tiles.current = null
      framed.current = false
    }
  }, [])

  /* ------------------------------------------------------------- tiles --- */
  // Its own effect, so switching theme swaps the basemap without tearing down
  // the map and losing wherever the student had panned to.
  useEffect(() => {
    const instance = map.current
    if (!instance || !source) return
    if (tiles.current) instance.removeLayer(tiles.current)
    tiles.current = L.tileLayer(source.url, {
      attribution: source.attribution,
      subdomains: source.subdomains ?? 'abc',
      maxZoom: 19,
      // Every tile is a request somebody pays for — us, when it goes through the
      // proxy. Leaflet's default keeps panned-away tiles; a small buffer keeps
      // the bill small.
      keepBuffer: 1,
    }).addTo(instance)
  }, [source])

  /* ------------------------------------------------------------- marks --- */
  useEffect(() => {
    const instance = map.current
    if (!instance || !cityLayer.current || !campusLayer.current || !groups.length) return

    cityLayer.current.clearLayers()
    campusLayer.current.clearLayers()

    const homePoint = home ? CITY_POINTS[home] ?? null : null
    const biggest = Math.max(...groups.map((g) => g.programs))

    for (const group of groups) {
      const isHome = group.city === home
      // Area-proportional, like the SVG map: sizing the radius by the value
      // makes Toronto look four times bigger than it is.
      const radius = 7 + Math.sqrt(group.programs / biggest) * 16

      const marker = L.circleMarker([group.point.lat, group.point.lon], {
        radius,
        className: `campus-mark${isHome ? ' campus-mark--home' : ''}`,
        weight: isHome ? 3 : 1.5,
      })

      // Permanent, so the map reads as a map of places rather than a scatter
      // you have to hover to decode.
      marker.bindTooltip(group.city, {
        permanent: true,
        direction: 'bottom',
        offset: [0, radius],
        className: 'map-label',
      })

      const distance =
        homePoint && !isHome
          ? `<p class="tile-map-distance">about ${distanceKm(homePoint, group.point).toLocaleString()} km from ${escapeHtml(home!)}, in a straight line</p>`
          : ''

      // Built as a string because this is Leaflet's DOM, not React's. Every
      // value interpolated here comes from either the dataset or the editable
      // content collection, and the second of those is typed by an admin — so
      // it is escaped rather than trusted.
      const schools = group.universities
        .map((u) => {
          const blurb = content[u.id]?.blurb
          return `<li>
            <strong>${escapeHtml(u.name)}</strong>
            <span>${u.programCount} programs</span>
            ${blurb ? `<em>${escapeHtml(blurb)}</em>` : ''}
          </li>`
        })
        .join('')

      marker.bindPopup(
        `<div class="tile-map-popup">
          <h3>${escapeHtml(group.city)}</h3>
          ${distance}
          <ul>${schools}</ul>
          <p class="tile-map-hint">Zoom in to see each campus.</p>
        </div>`,
      )
      // Clicking a city frames THE CAMPUSES IN IT, not the city centre. Flying
      // to the centre looked right and wasn't: Mississauga's city hall is 4km
      // from U of T Mississauga, so at street zoom the campus you clicked
      // towards was off the screen entirely. Fitting their bounds puts every
      // campus in that city on screen, however spread out they are.
      const campuses = group.universities
        .map((u) => CAMPUS_POINTS[u.id])
        .filter(Boolean)
        .map((p) => [p.lat, p.lon] as [number, number])

      marker.on('click', () => {
        // `animate: false` under reduced motion. Leaflet drives this pan-and-zoom
        // itself, in JS, so neither <MotionConfig> nor the global CSS
        // `transition-duration: 0.001ms` rule can reach it — this was the largest
        // uncontrolled movement left on the site. Read at click time rather than
        // captured, so toggling the OS setting takes effect without a remount.
        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (campuses.length) {
          instance.flyToBounds(L.latLngBounds(campuses), {
            padding: [70, 70],
            // Never further out than the city/campus threshold, or clicking a
            // city would swap back to the very marks you just clicked.
            maxZoom: ZOOM_ON_PICK,
            animate: !still,
          })
        } else {
          instance.flyTo([group.point.lat, group.point.lon], ZOOM_ON_PICK, { animate: !still })
        }
      })
      marker.addTo(cityLayer.current)
    }

    /* --------------------------------------------------------- campuses --- */
    for (const uni of universities) {
      const point = CAMPUS_POINTS[uni.id]
      if (!point) continue
      const blurb = content[uni.id]?.blurb

      const marker = L.marker([point.lat, point.lon], {
        icon: L.divIcon({
          className: 'campus-pin-wrap',
          html: `<span class="campus-pin"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      })

      marker.bindTooltip(uni.name, {
        permanent: true,
        direction: 'right',
        offset: [10, 0],
        className: 'map-label map-label--campus',
      })

      marker.bindPopup(
        `<div class="tile-map-popup">
          <h3>${escapeHtml(uni.name)}</h3>
          <p class="tile-map-distance">${escapeHtml(uni.city)} · ${uni.programCount} programs</p>
          ${blurb ? `<p>${escapeHtml(blurb)}</p>` : ''}
          <p class="tile-map-hint">${
            point.approximate
              ? 'Placed at the city centre — we could not confirm this campus.'
              : `Campus location from OpenStreetMap, read ${CAMPUS_POINTS_READ}.`
          }</p>
        </div>`,
      )
      marker.addTo(campusLayer.current)
    }

    // Frame everything ONCE. This effect also reruns when the editable content
    // arrives — a second or two late, over the network — and refitting then
    // would yank the map back to its starting view under a student who had
    // already panned somewhere.
    if (!framed.current) {
      const bounds = L.latLngBounds(
        groups.map((g) => [g.point.lat, g.point.lon] as [number, number]),
      )
      if (homePoint) bounds.extend([homePoint.lat, homePoint.lon])
      instance.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 })
      framed.current = true
    }

    // After the marks exist and the camera has settled, decide which labels fit.
    thinLabels(instance, cityLayer.current)
  }, [groups, home, content, universities])

  const placed = universities.filter((u) => CAMPUS_POINTS[u.id] && !CAMPUS_POINTS[u.id].approximate)

  return (
    // `theme-map` is what makes the Leaflet chrome follow the site's theme.
    // Leaflet's stylesheet arrives in this lazy chunk, i.e. after index.css, so
    // it wins every tie at equal specificity — without this class the map is a
    // white box in dark mode. See the block in index.css.
    <div className={`theme-map${dark ? ' is-dark' : ''}`}>
      <div className="relative">
        {/* A fixed height, because a Leaflet container with none collapses to
            zero and renders nothing at all — with no error to explain it. */}
        <div
          ref={box}
          className="h-[30rem] w-full overflow-hidden rounded-xl border border-line"
          role="application"
          aria-label={`Map of ${groups.length} cities with universities`}
        />
        {/* Top-right: the bottom-right corner is Leaflet's attribution, which is
            a condition of using the tiles and must not be sat on top of, and the
            top-left is the zoom control. */}
        {!scrollArmed && (
          <p className="pointer-events-none absolute right-3 top-3 z-[500] rounded-full border border-line bg-paper/90 px-3 py-1.5 text-xs text-slate shadow-sm">
            Click a city to zoom in
          </p>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate">
        Zoomed out the marks are cities, sized by how many programs are in each. Zoom in and they
        become the {placed.length} campuses themselves, located from OpenStreetMap on{' '}
        {CAMPUS_POINTS_READ}. Distances are straight-line — nobody travels in a straight line.
      </p>

      {/* The same information as the map, reachable without it. A map is a
          picture: keyboard and screen-reader users get the list, and so does
          anyone whose tiles failed to load. */}
      <details className="mt-3 rounded-xl border border-line bg-paper p-4">
        <summary className="cursor-pointer text-sm font-600 text-ink">
          List the {groups.length} cities instead
        </summary>
        <ul className="mt-3 space-y-2">
          {groups.map((g) => (
            <li key={g.city}>
              <p className="text-sm font-600 text-ink">
                {g.city}
                {home && g.city !== home && CITY_POINTS[home] && (
                  <span className="ml-2 font-400 text-slate">
                    about {distanceKm(CITY_POINTS[home], g.point).toLocaleString()} km from {home}
                  </span>
                )}
              </p>
              <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                {g.universities.map((u) => (
                  <li key={u.id}>
                    <Link
                      to={`/profile/programs?uni=${u.id}`}
                      className="flex items-baseline justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:border-brand-300"
                    >
                      <span className="min-w-0 truncate text-ink">{u.name}</span>
                      <span className="shrink-0 text-xs text-slate [font-variant-numeric:tabular-nums]">
                        {u.programCount}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

/**
 * Hide the city labels that would land on top of one another.
 *
 * Southern Ontario is the problem, and it is the same one `CampusMap` solved
 * for the SVG map: Toronto, Mississauga, Hamilton, Waterloo, Guelph and
 * St. Catharines sit inside about 100km, so at province scale their labels
 * overlap into an unreadable stack of words. Labelling everything looked
 * thorough and read as a smear.
 *
 * Greedy, largest city first, in SCREEN space rather than in degrees — the
 * whole point is how close the words are to each other on the display, which
 * changes with every zoom. Nothing is lost by hiding one: the mark is still
 * there, still clickable, still named in its popup and in the list below.
 */
function thinLabels(map: L.Map, layer: L.LayerGroup | null) {
  if (!layer) return
  const placed: Array<{ x: number; y: number }> = []
  layer.eachLayer((entry) => {
    const marker = entry as L.CircleMarker
    const tooltip = marker.getTooltip?.()
    if (!tooltip || !marker.getLatLng) return
    const { x, y } = map.latLngToContainerPoint(marker.getLatLng())
    const clash = placed.some((p) => Math.abs(p.x - x) < 78 && Math.abs(p.y - y) < 22)
    tooltip.setOpacity(clash ? 0 : 1)
    if (!clash) placed.push({ x, y })
  })
}

/**
 * The site's current theme, tracked as it changes.
 *
 * `ThemeToggle` writes `data-theme` on the document element, so an observer on
 * that one attribute is the whole implementation. Needed because the basemap
 * has a light and a dark rendering: a bright street map under a dark page is the
 * single thing that makes an embedded map look bolted on.
 */
function useTheme(): string {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme ?? 'light',
  )
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setTheme(document.documentElement.dataset.theme ?? 'light'),
    )
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return theme
}

/**
 * Escape text on its way into Leaflet's popup HTML.
 *
 * React escapes for us everywhere else on this site, which is exactly why this
 * is easy to forget in the one place it does not. University blurbs are typed
 * into the admin panel and stored on the server; an admin account is trusted to
 * write copy, not to be the last line of defence against a stored script.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
