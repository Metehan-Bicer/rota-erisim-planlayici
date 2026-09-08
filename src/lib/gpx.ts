import type { RouteResult } from './valhalla'

function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] as string)
}

/** GPX 1.1 track with elevation interpolated from the sampled profile. */
export function toGpx(route: RouteResult, name: string): string {
  const n = route.coords.length
  const pts = route.coords
    .map(([lon, lat], i) => {
      const ei = route.elevation.length ? Math.min(route.elevation.length - 1, Math.round((i / Math.max(1, n - 1)) * (route.elevation.length - 1))) : -1
      const ele = ei >= 0 ? `<ele>${route.elevation[ei].toFixed(1)}</ele>` : ''
      return `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">${ele}</trkpt>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Rota ve Erişim Planlayıcı" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(name)}</name><time>${new Date().toISOString()}</time></metadata>
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`
}

export function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
