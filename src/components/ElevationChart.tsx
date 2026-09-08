import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { ELEVATION_INTERVAL } from '../lib/valhalla'
import { SLOPE_STOPS, slopeColor, slopes } from '../lib/slope'
import { fmtElev, fmtKm } from '../lib/format'

interface Props {
  elevation: number[]
  hover: number | null
  onHover: (i: number | null) => void
}

const PAD = { top: 10, right: 8, bottom: 18, left: 40 }

export function ElevationChart({ elevation, hover, onHover }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = elevation.length
  const { w, h } = size
  const iw = w - PAD.left - PAD.right
  const ih = h - PAD.top - PAD.bottom
  const min = Math.min(...elevation)
  const max = Math.max(...elevation)
  const span = Math.max(20, max - min)
  const lo = min - span * 0.1
  const hi = max + span * 0.1
  const x = (i: number) => PAD.left + (i / Math.max(1, n - 1)) * iw
  const y = (e: number) => PAD.top + ih - ((e - lo) / (hi - lo)) * ih
  const grades = useMemo(() => slopes(elevation), [elevation])

  const segments = useMemo(() => {
    if (!w || n < 2) return []
    return grades.map((g, i) => ({ d: `M${x(i).toFixed(1)},${y(elevation[i]).toFixed(1)} L${x(i + 1).toFixed(1)},${y(elevation[i + 1]).toFixed(1)}`, color: slopeColor(g) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grades, w, h])

  const area = useMemo(() => {
    if (!w || n < 2) return ''
    const pts = elevation.map((e, i) => `${x(i).toFixed(1)},${y(e).toFixed(1)}`).join(' L')
    return `M${x(0).toFixed(1)},${(PAD.top + ih).toFixed(1)} L${pts} L${x(n - 1).toFixed(1)},${(PAD.top + ih).toFixed(1)} Z`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevation, w, h])

  const totalKm = ((n - 1) * ELEVATION_INTERVAL) / 1000
  const xTicks = useMemo(() => {
    const count = Math.max(2, Math.floor(iw / 80))
    const step = niceStep(totalKm / count)
    const out: number[] = []
    for (let k = 0; k <= totalKm + 1e-9; k += step) out.push(k)
    return out
  }, [iw, totalKm])
  const yTicks = useMemo(() => {
    const step = niceStep((hi - lo) / 3)
    const out: number[] = []
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v)
    return out
  }, [lo, hi])

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left - PAD.left
    const i = Math.round((px / iw) * (n - 1))
    onHover(i < 0 || i > n - 1 ? null : i)
  }

  return (
    <div className="chart" ref={ref}>
      {w > 0 && n > 1 && (
        <svg viewBox={`0 0 ${w} ${h}`} onPointerMove={onMove} onPointerLeave={() => onHover(null)} aria-label="Yükseklik profili" role="img">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} stroke="#e5e7eb" />
              <text x={PAD.left - 4} y={y(v) + 3} textAnchor="end">{Math.round(v)} m</text>
            </g>
          ))}
          {xTicks.map((k) => {
            const i = (k / totalKm) * (n - 1)
            return (
              <text key={k} x={x(i)} y={h - 4} textAnchor="middle">{fmtKm(k)}</text>
            )
          })}
          <path d={area} fill="#e5e7eb" opacity={0.7} />
          {segments.map((s, i) => (
            <path key={i} d={s.d} stroke={s.color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          ))}
          {hover !== null && hover < n && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} stroke="#111827" strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(elevation[hover])} r={4} fill="#111827" stroke="#fff" strokeWidth={1.5} />
            </g>
          )}
        </svg>
      )}
      {hover !== null && hover < n && (
        <div className="tip">
          {fmtKm((hover * ELEVATION_INTERVAL) / 1000)} · {fmtElev(elevation[hover])}
          {grades[Math.min(hover, grades.length - 1)] !== undefined && ` · ${grades[Math.min(hover, grades.length - 1)] >= 0 ? '+' : ''}${grades[Math.min(hover, grades.length - 1)].toFixed(1)}%`}
        </div>
      )}
    </div>
  )
}

export function SlopeLegend() {
  return (
    <div className="slope-legend" aria-label="Eğim renkleri">
      {SLOPE_STOPS.map(([pct, color]) => (
        <span key={pct}><i style={{ background: color }} />{pct > 0 ? `+${pct}` : pct}%</span>
      ))}
    </div>
  )
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / p
  const m = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10
  return m * p
}
