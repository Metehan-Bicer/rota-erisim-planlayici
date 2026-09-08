export interface Place {
  label: string
  lat: number
  lon: number
}

interface NominatimHit {
  display_name: string
  lat: string
  lon: string
}

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=tr&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Arama servisi ${res.status}`)
  const hits = (await res.json()) as NominatimHit[]
  return hits.map((h) => ({ label: h.display_name, lat: Number(h.lat), lon: Number(h.lon) }))
}

export async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=tr&lat=${lat}&lon=${lon}`
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const j = (await res.json()) as { display_name?: string; address?: Record<string, string> }
    const a = j.address ?? {}
    const short = [a.road ?? a.pedestrian ?? a.neighbourhood ?? a.suburb, a.town ?? a.city_district ?? a.city ?? a.county].filter(Boolean).join(', ')
    return short || j.display_name || null
  } catch {
    return null
  }
}
