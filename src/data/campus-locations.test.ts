import { describe, it, expect } from 'vitest'
import { CITY_POINTS, distanceKm, mapCity, project } from './campus-locations'
import UNIVERSITIES from './generated/universities.json'

describe('CITY_POINTS', () => {
  it('places every Ontario city in the dataset', () => {
    const missing = [...new Set(
      (UNIVERSITIES as Array<{ province: string; city: string }>)
        .filter((u) => u.province === 'ON')
        .map((u) => mapCity(u.city)),
    )].filter((city) => !CITY_POINTS[city])
    expect(missing).toEqual([])
  })

  it('keeps every point inside Ontario’s real extent', () => {
    for (const [city, p] of Object.entries(CITY_POINTS)) {
      expect(p.lat, city).toBeGreaterThan(41.6)
      expect(p.lat, city).toBeLessThan(56.9)
      expect(p.lon, city).toBeLessThan(-74.3)
      expect(p.lon, city).toBeGreaterThan(-95.2)
    }
  })
})

describe('distanceKm', () => {
  // Sanity anchors: these are well-known separations, and a projection or unit
  // slip shows up here immediately rather than as a map that looks plausible.
  it('matches known distances within a sensible tolerance', () => {
    expect(distanceKm(CITY_POINTS.Toronto, CITY_POINTS.Ottawa)).toBeGreaterThan(320)
    expect(distanceKm(CITY_POINTS.Toronto, CITY_POINTS.Ottawa)).toBeLessThan(380)
    expect(distanceKm(CITY_POINTS.Toronto, CITY_POINTS.Hamilton)).toBeLessThan(80)
    // ~830km as the crow flies. The drive is closer to 1,400km because it goes
    // around Lake Superior — which is exactly why the UI says "straight line"
    // rather than quoting a journey nobody could make.
    const windsorToThunderBay = distanceKm(CITY_POINTS.Windsor, CITY_POINTS['Thunder Bay'])
    expect(windsorToThunderBay).toBeGreaterThan(780)
    expect(windsorToThunderBay).toBeLessThan(880)
  })

  it('is zero for a city against itself, and symmetric', () => {
    expect(distanceKm(CITY_POINTS.Guelph, CITY_POINTS.Guelph)).toBe(0)
    expect(distanceKm(CITY_POINTS.London, CITY_POINTS.Kingston)).toBe(
      distanceKm(CITY_POINTS.Kingston, CITY_POINTS.London),
    )
  })
})

describe('project', () => {
  const bounds = { minLat: 42, maxLat: 49, minLon: -90, maxLon: -75 }
  const box = { width: 760, height: 460, pad: 40 }

  it('puts north above south and west left of east', () => {
    const north = project({ lat: 48, lon: -80 }, bounds, box)
    const south = project({ lat: 43, lon: -80 }, bounds, box)
    const west = project({ lat: 45, lon: -88 }, bounds, box)
    const east = project({ lat: 45, lon: -76 }, bounds, box)
    expect(north.y).toBeLessThan(south.y)
    expect(west.x).toBeLessThan(east.x)
  })

  it('keeps every projected point inside the box', () => {
    for (const p of Object.values(CITY_POINTS)) {
      const { x, y } = project(p, { minLat: 42, maxLat: 49, minLon: -90, maxLon: -75 }, box)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(box.width)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(box.height)
    }
  })
})
