export interface PoiCategory {
  id: string
  name: string
  /** Overpass tag filter, e.g. ["amenity"="pharmacy"] */
  filter: string
  color: string
}

export const POI_CATEGORIES: PoiCategory[] = [
  { id: 'pharmacy', name: 'Eczane', filter: '["amenity"="pharmacy"]', color: '#16a34a' },
  { id: 'hospital', name: 'Hastane', filter: '["amenity"~"hospital|clinic"]', color: '#dc2626' },
  { id: 'school', name: 'Okul', filter: '["amenity"~"school|kindergarten"]', color: '#7c3aed' },
  { id: 'supermarket', name: 'Market', filter: '["shop"~"supermarket|convenience"]', color: '#ea580c' },
  { id: 'bus_stop', name: 'Otobüs durağı', filter: '["highway"="bus_stop"]', color: '#0891b2' },
  { id: 'park', name: 'Park', filter: '["leisure"="park"]', color: '#65a30d' },
  { id: 'atm', name: 'ATM / banka', filter: '["amenity"~"atm|bank"]', color: '#4f46e5' },
  { id: 'cafe', name: 'Kafe / restoran', filter: '["amenity"~"cafe|restaurant"]', color: '#be185d' },
]

export interface Poi {
  id: number
  name: string
  lat: number
  lon: number
}

interface OverpassElement {
  id: number
  type: string
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

export async function fetchPois(category: PoiCategory, bbox: [number, number, number, number], signal?: AbortSignal): Promise<Poi[]> {
  const [w, s, e, n] = bbox
  const query = `[out:json][timeout:25];nwr${category.filter}(${s},${w},${n},${e});out center 500;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
    signal,
  })
  if (res.status === 429 || res.status === 504) throw new Error('Overpass sunucusu yoğun, biraz sonra tekrar deneyin.')
  if (!res.ok) throw new Error(`Overpass ${res.status}`)
  const data = (await res.json()) as { elements: OverpassElement[] }
  return data.elements
    .map((el) => {
      const lat = el.lat ?? el.center?.lat
      const lon = el.lon ?? el.center?.lon
      if (lat === undefined || lon === undefined) return null
      return { id: el.id, name: el.tags?.name ?? el.tags?.brand ?? `${category.name} (adsız)`, lat, lon }
    })
    .filter((p): p is Poi => p !== null)
}
