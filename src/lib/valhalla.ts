import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import type { Costing, CostingOptions, Waypoint } from './types'
import { decodePolyline } from './polyline'

const BASE = 'https://valhalla1.openstreetmap.de'
export const ELEVATION_INTERVAL = 100 // metres between elevation samples

export interface Maneuver {
  type: number
  instruction: string
  length: number // km
  time: number // s
  begin_shape_index: number
  end_shape_index: number
  street_names?: string[]
}

export interface RouteResult {
  /** [lon, lat] pairs of the full route */
  coords: [number, number][]
  lengthKm: number
  timeSec: number
  maneuvers: Maneuver[]
  /** Elevation (m) sampled every ELEVATION_INTERVAL metres along the route */
  elevation: number[]
  /** Which leg each maneuver's shape indices refer to is flattened into global indices */
}

function costingOptions(costing: Costing, o: CostingOptions) {
  switch (costing) {
    case 'auto':
      return { auto: { use_highways: o.useHighways, use_tolls: o.useTolls } }
    case 'bicycle':
      return { bicycle: { bicycle_type: o.bicycleType, use_hills: o.useHills } }
    case 'pedestrian':
      return { pedestrian: { walking_speed: o.walkingSpeed } }
  }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    let msg = `Sunucu ${res.status}`
    try {
      const j = (await res.json()) as { error?: string }
      if (j.error) msg = translateError(j.error)
    } catch {
      /* keep generic message */
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
}

function translateError(e: string): string {
  if (/No path could be found/i.test(e)) return 'Bu noktalar arasında rota bulunamadı.'
  if (/Cannot find|No suitable edges|Path distance exceeds/i.test(e)) return 'Nokta yola çok uzak ya da mesafe sınırı aşıldı.'
  if (/exceeds the max/i.test(e)) return 'Mesafe ya da süre sınırı aşıldı.'
  return e
}

interface TripResponse {
  trip: {
    summary: { length: number; time: number }
    legs: Array<{ shape: string; maneuvers: Maneuver[]; elevation?: number[] }>
  }
}

export async function fetchRoute(waypoints: Waypoint[], costing: Costing, options: CostingOptions, signal?: AbortSignal): Promise<RouteResult> {
  const data = await post<TripResponse>(
    'route',
    {
      locations: waypoints.map((w, i) => ({ lat: w.lat, lon: w.lon, type: i === 0 || i === waypoints.length - 1 ? 'break' : 'through' })),
      costing,
      costing_options: costingOptions(costing, options),
      language: 'tr-TR',
      units: 'kilometers',
      elevation_interval: ELEVATION_INTERVAL,
    },
    signal,
  )
  const coords: [number, number][] = []
  const maneuvers: Maneuver[] = []
  const elevation: number[] = []
  for (const leg of data.trip.legs) {
    const shape = decodePolyline(leg.shape)
    const offset = coords.length
    // Legs share their boundary vertex; skip the duplicate when concatenating.
    coords.push(...(offset ? shape.slice(1) : shape))
    const shift = offset ? offset - 1 : 0
    for (const m of leg.maneuvers) maneuvers.push({ ...m, begin_shape_index: m.begin_shape_index + shift, end_shape_index: m.end_shape_index + shift })
    if (leg.elevation) elevation.push(...(elevation.length ? leg.elevation.slice(1) : leg.elevation))
  }
  return { coords, lengthKm: data.trip.summary.length, timeSec: data.trip.summary.time, maneuvers, elevation }
}

export type IsoCollection = FeatureCollection<Polygon | MultiPolygon, { contour: number; color?: string }>

export async function fetchIsochrone(origin: { lat: number; lon: number }, costing: Costing, minutes: number[], reverse: boolean, options: CostingOptions, signal?: AbortSignal): Promise<IsoCollection> {
  return post<IsoCollection>(
    'isochrone',
    {
      locations: [{ lat: origin.lat, lon: origin.lon }],
      costing,
      costing_options: costingOptions(costing, options),
      contours: minutes.map((time) => ({ time })),
      polygons: true,
      denoise: 0.3,
      generalize: 30,
      reverse,
    },
    signal,
  )
}
