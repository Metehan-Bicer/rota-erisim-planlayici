export type Mode = 'route' | 'iso'
export type Costing = 'auto' | 'bicycle' | 'pedestrian'

export interface Waypoint {
  id: string
  lat: number
  lon: number
  label?: string
}

export interface CostingOptions {
  useHighways: number // 0..1 (auto)
  useTolls: number // 0..1 (auto)
  bicycleType: 'Road' | 'Hybrid' | 'Mountain'
  useHills: number // 0..1 (bicycle)
  walkingSpeed: number // km/h (pedestrian)
}

export const DEFAULT_OPTIONS: CostingOptions = {
  useHighways: 1,
  useTolls: 1,
  bicycleType: 'Hybrid',
  useHills: 0.5,
  walkingSpeed: 5.1,
}

export const COSTING_LABEL: Record<Costing, string> = {
  auto: 'Araba',
  bicycle: 'Bisiklet',
  pedestrian: 'Yaya',
}

export const WAYPOINT_COLORS = { start: '#16a34a', via: '#2563eb', end: '#dc2626' }

export function newId(): string {
  return Math.random().toString(36).slice(2, 9)
}
