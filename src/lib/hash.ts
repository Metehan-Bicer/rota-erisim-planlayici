import { newId, type Costing, type Mode, type Waypoint } from './types'

export interface HashState {
  mode: Mode
  costing: Costing
  waypoints: Waypoint[]
  origin: { lat: number; lon: number } | null
  minutes: number[]
}

const COSTINGS: Costing[] = ['auto', 'bicycle', 'pedestrian']

export function readHash(): Partial<HashState> {
  const p = new URLSearchParams(window.location.hash.slice(1))
  const out: Partial<HashState> = {}
  const m = p.get('m')
  if (m === 'route' || m === 'iso') out.mode = m
  const c = p.get('c') as Costing | null
  if (c && COSTINGS.includes(c)) out.costing = c
  const wp = p.get('wp')
  if (wp) {
    const pts = wp
      .split(';')
      .map((s) => s.split(',').map(Number))
      .filter((a) => a.length === 2 && a.every(Number.isFinite))
    if (pts.length) out.waypoints = pts.map(([lat, lon]) => ({ id: newId(), lat, lon }))
  }
  const o = p.get('o')?.split(',').map(Number)
  if (o && o.length === 2 && o.every(Number.isFinite)) out.origin = { lat: o[0], lon: o[1] }
  const t = p.get('t')?.split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0)
  if (t && t.length) out.minutes = t.slice(0, 4)
  return out
}

export function writeHash(s: HashState) {
  const p = new URLSearchParams()
  p.set('m', s.mode)
  p.set('c', s.costing)
  if (s.waypoints.length) p.set('wp', s.waypoints.map((w) => `${w.lat.toFixed(5)},${w.lon.toFixed(5)}`).join(';'))
  if (s.origin) p.set('o', `${s.origin.lat.toFixed(5)},${s.origin.lon.toFixed(5)}`)
  p.set('t', s.minutes.join(','))
  window.history.replaceState(null, '', `#${p.toString().replace(/%2C/g, ',').replace(/%3B/g, ';')}`)
}
