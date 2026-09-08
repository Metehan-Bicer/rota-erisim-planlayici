import { ELEVATION_INTERVAL } from './valhalla'

/** Colour stops for grade (%): descents blue, flat green, climbs yellow → red. */
export const SLOPE_STOPS: Array<[number, string]> = [
  [-12, '#1d4ed8'],
  [-4, '#60a5fa'],
  [0, '#22c55e'],
  [4, '#facc15'],
  [8, '#f97316'],
  [12, '#dc2626'],
]

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function slopeColor(pct: number): string {
  const s = SLOPE_STOPS
  if (pct <= s[0][0]) return s[0][1]
  if (pct >= s[s.length - 1][0]) return s[s.length - 1][1]
  for (let i = 0; i < s.length - 1; i++) {
    if (pct >= s[i][0] && pct <= s[i + 1][0]) {
      const t = (pct - s[i][0]) / (s[i + 1][0] - s[i][0])
      const a = hex(s[i][1])
      const b = hex(s[i + 1][1])
      return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(',')})`
    }
  }
  return s[0][1]
}

/** Grade (%) between consecutive elevation samples, lightly smoothed. */
export function slopes(elevation: number[]): number[] {
  if (elevation.length < 2) return []
  const raw = elevation.slice(1).map((e, i) => ((e - elevation[i]) / ELEVATION_INTERVAL) * 100)
  return raw.map((_, i) => {
    const a = raw[Math.max(0, i - 1)]
    const b = raw[i]
    const c = raw[Math.min(raw.length - 1, i + 1)]
    return (a + b + c) / 3
  })
}

export interface Profile {
  ascent: number
  descent: number
  min: number
  max: number
}

export function profileStats(elevation: number[]): Profile {
  let ascent = 0
  let descent = 0
  const THRESHOLD = 1 // ignore sub-metre noise
  let last = elevation[0] ?? 0
  for (const e of elevation.slice(1)) {
    const d = e - last
    if (Math.abs(d) >= THRESHOLD) {
      if (d > 0) ascent += d
      else descent -= d
      last = e
    }
  }
  return { ascent, descent, min: Math.min(...elevation), max: Math.max(...elevation) }
}

/** MapLibre line-gradient expression from the slope series (capped to keep the expression small). */
export function gradientExpression(elevation: number[]): unknown[] {
  const s = slopes(elevation)
  if (s.length === 0) return ['literal', '#2563eb']
  const MAX = 240
  const step = Math.max(1, Math.ceil(s.length / MAX))
  const expr: unknown[] = ['interpolate', ['linear'], ['line-progress']]
  for (let i = 0; i < s.length; i += step) {
    const progress = Math.min(1, (i + 0.5) / s.length)
    expr.push(progress, slopeColor(s[i]))
  }
  return expr
}
