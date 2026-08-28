import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { tileUrlTemplate } from '../lib/api'
import { CITY_POINTS, distanceKm } from '../data/campus-locations'
import { groupByCity } from './CampusMap'
import type { UniversityContent } from '../lib/api'
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
// TILES COME THROUGH OUR OWN SERVER. See the note in lib/api.ts: the provider
// sees UniServer rather than a student's IP and every pan they make, and the
// provider key stays out of a bundle that is public by definition.
//
// THE SVG MAP IS STILL THERE and is still reachable. `MapView` falls back to it
// whenever /api/map/config says no provider is configured, which is the state
// this project is in until somebody sets TILE_URL_TEMPLATE — and it is also
// what covers a sleeping Render instance. That fallback is not a placeholder to
// be deleted later; it is the honest answer when there is no basemap to draw.
//
// NO REACT WRAPPER LIBRARY. Leaflet owns its own DOM and mutates it directly,
// which is exactly what React expects not to happen. Handing it a ref'd div and
// driving it from effects is smaller and clearer than a binding layer, and it
// keeps the one rule that matters: nothing inside the map container is rendered
// by React.

/** Ontario, roughly, for the initial view. */
const INITIAL_CENTRE: [number, number] = [44.4, -79.6]
const INITIAL_ZOOM = 6

export default function TileMap({
  universities,
  home,
  attribution,
  content,
}: {
  universities: University[]
  /** the city the student picked, for distances. null = none chosen */
  home: string | null
  attribution: string
  /** editable prose per university id, when the server had any */
  content: Record<string, UniversityContent>
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marks = useRef<L.LayerGroup | null>(null)
  /** Whether the camera has been placed. It is the student's to move after that. */
  const framed = useRef(false)

  const { groups } = useMemo(() => groupByCity(universities), [universities])

  // Create once. Leaflet throws "Map container is already initialized" if this
  // ever runs twice against the same node, which is exactly what React 19's
  // StrictMode double-invoke does in development — hence the teardown.
  useEffect(() => {
    if (!box.current || map.current) return

    const instance = L.map(box.current, {
      center: INITIAL_CENTRE,
      zoom: INITIAL_ZOOM,
      // Leaflet's default scroll-wheel zoom fights the page scroll: a student
      // scrolling past the map gets trapped zooming it instead. Ctrl+wheel and
      // the +/- buttons still work.
      scrollWheelZoom: false,
      attributionControl: true,
    })

    L.tileLayer(tileUrlTemplate(), {
      attribution,
      maxZoom: 19,
      // Every tile is a request our server pays for. Leaflet's default is to
      // keep panned-away tiles; keeping the buffer small keeps the bill small.
      keepBuffer: 1,
    }).addTo(instance)

    marks.current = L.layerGroup().addTo(instance)
    map.current = instance

    return () => {
      instance.remove()
      map.current = null
      marks.current = null
      // A new map instance needs framing again — StrictMode's double-invoke in
      // development tears this down and rebuilds it immediately.
      framed.current = false
    }
  }, [attribution])

  // Redraw the marks whenever the data or the chosen home changes.
  useEffect(() => {
    const instance = map.current
    const layer = marks.current
    if (!instance || !layer) return

    layer.clearLayers()
    if (!groups.length) return

    const homePoint = home ? CITY_POINTS[home] ?? null : null
    const biggest = Math.max(...groups.map((g) => g.programs))

    for (const group of groups) {
      const isHome = group.city === home
      // Area-proportional, like the SVG map: sizing the radius by the value
      // makes Toronto look four times bigger than it is.
      const radius = 6 + Math.sqrt(group.programs / biggest) * 16

      // Colour comes from a class, not from Leaflet's `color`/`fillColor`.
      // Those become SVG presentation attributes, where `var(--color-chart)`
      // does not resolve — the mark would silently render black. A class lets
      // index.css own it, which also means the marks follow the theme toggle
      // instead of being frozen at whatever the palette was on first paint.
      const marker = L.circleMarker([group.point.lat, group.point.lon], {
        radius,
        className: `campus-mark${isHome ? ' campus-mark--home' : ''}`,
        weight: isHome ? 3 : 1.5,
      })

      const distance =
        homePoint && !isHome
          ? `<p class="tile-map-distance">about ${distanceKm(homePoint, group.point).toLocaleString()} km from ${escapeHtml(home!)}, in a straight line</p>`
          : ''

      // Built as a string because this is Leaflet's DOM, not React's. Every
      // value interpolated here comes from either the dataset or the editable
      // content collection, and the second of those is typed by an admin — so
      // it is escaped rather than trusted. An admin panel is not a trusted
      // input path just because it is behind a password.
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
        </div>`,
      )
      marker.bindTooltip(
        `${escapeHtml(group.city)} — ${group.universities.length} school${
          group.universities.length === 1 ? '' : 's'
        }`,
      )
      marker.addTo(layer)
    }

    // Frame everything that is actually on the map, rather than trusting the
    // hardcoded starting view to still be right when the dataset grows.
    //
    // ONCE, THOUGH. This effect also reruns when the editable content arrives —
    // which happens a second or two late, over the network — and refitting then
    // would yank the map back to its starting view under a student who had
    // already panned somewhere. Same for changing the home city: redrawing the
    // marks is right, moving the camera out from under them is not.
    if (!framed.current) {
      const bounds = L.latLngBounds(
        groups.map((g) => [g.point.lat, g.point.lon] as [number, number]),
      )
      if (homePoint) bounds.extend([homePoint.lat, homePoint.lon])
      instance.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 })
      framed.current = true
    }
  }, [groups, home, content])

  return (
    // `theme-map` is what makes the Leaflet chrome follow the site's theme.
    // Leaflet's stylesheet arrives in this lazy chunk, i.e. after index.css, so
    // it wins every tie at equal specificity — without this class the map is a
    // white box in dark mode. See the block in index.css.
    <div className="theme-map">
      {/* A fixed height, because a Leaflet container with none collapses to
          zero and renders nothing at all — with no error to explain it. */}
      <div
        ref={box}
        className="h-[26rem] w-full overflow-hidden rounded-xl border border-line"
        role="application"
        aria-label={`Map of ${groups.length} cities with universities`}
      />

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
