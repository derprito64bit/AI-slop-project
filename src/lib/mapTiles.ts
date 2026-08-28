import { tileUrlTemplate, type MapConfig } from './api'

// Where the basemap comes from, and the order it is looked for in.
//
// There are two ways to get tiles and they are not equivalent, so the choice is
// made once, here, rather than in the component:
//
//   1. OUR OWN PROXY, when the server says a provider is configured. The
//      provider sees UniServer and nothing else — not a student's IP, not which
//      part of Ontario they were looking at — and the provider key stays in
//      Render's environment instead of in a bundle that is public by definition.
//      This is the preferred path and it wins whenever it is available.
//
//   2. A KEYLESS CDN, straight from the browser. Works with no backend at all,
//      which is what makes the map real on GitHub Pages today. The trade is
//      honest and worth stating plainly: the tile host sees each visitor's IP
//      and their map movements, the same way any externally-hosted image or font
//      would. It sees nothing else — no answers, no shortlist, no account.
//
// THE CASCADE IS THE POINT. The moment /api/map/config reports a provider, the
// proxy takes over on its own and the direct path stops being used. Nothing has
// to be rewritten or redeployed to get the stronger privacy posture back; it
// resumes by itself. Until then a student gets a real map instead of an
// apology, and if both are unavailable the hand-drawn SVG map still is.

export type TileSource = {
  url: string
  attribution: string
  /** Leaflet's {s} placeholder, when the host shards across subdomains. */
  subdomains?: string
  /** which of the two paths above produced this */
  via: 'proxy' | 'direct'
}

/**
 * The default keyless basemap: OpenStreetMap's own standard tiles.
 *
 * CARTO's basemaps were tried first and rejected AFTER LOOKING AT THEM. Their
 * tile server answers 200 with a valid PNG while no key is set — and stamps
 * "API KEY REQUIRED" diagonally across every tile. A status code and a
 * content-type are not proof that an image is the image you wanted, which is
 * the lesson that cost a screenshot to learn.
 *
 * OSM's own tiles are genuinely keyless and unwatermarked. THE CAVEAT MATTERS
 * AND IS NOT HIDDEN: their Tile Usage Policy is a tolerance for small projects,
 * not an entitlement — it asks for a real referrer and attribution, forbids
 * bulk downloading, and blocks heavy users. That is fine for a student project
 * being read by a few hundred people and is NOT the answer if this ever gets
 * traffic. The proper answer is already built: configure TILE_URL_TEMPLATE with
 * a provider you hold an account with, and the proxy takes over automatically.
 *
 * That same policy also forbids putting OSM behind a proxy, which is exactly why
 * the server path must be pointed at a commercial provider and never at this.
 *
 * ATTRIBUTION IS NOT OPTIONAL — it is the condition of use, and Leaflet renders
 * it in the corner of the map. Do not remove it to tidy the frame.
 */
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/**
 * A build-time override, for pointing the direct path somewhere else.
 *
 * `VITE_TILE_URL=""` disables the direct path entirely, which is how you get
 * back to "proxy or nothing" without touching this file — the map then falls to
 * the SVG one until the server has a provider.
 */
const OVERRIDE_URL = import.meta.env.VITE_TILE_URL as string | undefined
const OVERRIDE_ATTRIBUTION = import.meta.env.VITE_TILE_ATTRIBUTION as string | undefined

/**
 * Which tiles to draw, given what the server said.
 *
 * `config` is undefined while the question is still outstanding; the caller
 * must not draw anything yet in that case, because falling back and then
 * swapping to a real map a second later is worse than a moment of "checking".
 *
 * There is no `dark` argument, and that is deliberate: OSM publishes one
 * rendering. A bright street map under a dark page is the thing that makes an
 * embedded map look bolted on, so the dark treatment is a CSS filter over the
 * tile pane instead — see `.theme-map.is-dark` in index.css. That way it also
 * applies to whatever an operator configures through the proxy, rather than
 * only to basemaps we happen to know a dark variant of.
 */
export function resolveTileSource(config: MapConfig | undefined): TileSource | null {
  if (!config) return null

  if (config.available) {
    return {
      url: tileUrlTemplate(),
      attribution: config.attribution,
      via: 'proxy',
    }
  }

  // An explicitly empty override means "do not go direct".
  if (OVERRIDE_URL === '') return null

  if (OVERRIDE_URL) {
    return {
      url: OVERRIDE_URL,
      attribution: OVERRIDE_ATTRIBUTION ?? OSM_ATTRIBUTION,
      subdomains: OVERRIDE_URL.includes('{s}') ? 'abcd' : undefined,
      via: 'direct',
    }
  }

  return {
    url: OSM_TILES,
    attribution: OVERRIDE_ATTRIBUTION ?? OSM_ATTRIBUTION,
    via: 'direct',
  }
}
