const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })
const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 })

export function fmtKm(km: number): string {
  if (km < 1) return `${nf0.format(km * 1000)} m`
  return `${nf.format(km)} km`
}

export function fmtMeters(m: number): string {
  return fmtKm(m / 1000)
}

export function fmtDuration(sec: number): string {
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} dk`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} sa ${m} dk` : `${h} sa`
}

export function fmtElev(m: number): string {
  return `${nf0.format(m)} m`
}

export function fmtArea(km2: number): string {
  return `${nf.format(km2)} km²`
}
