import { useEffect, useState } from 'react'
import { WAYPOINT_COLORS, type Waypoint } from '../lib/types'
import { searchPlaces, type Place } from '../lib/geocode'

interface Props {
  waypoints: Waypoint[]
  onChange: (next: Waypoint[]) => void
  onAdd: (place: Place) => void
  onZoom: (w: Waypoint) => void
}

function usePlaceSearch(q: string) {
  const [hits, setHits] = useState<Place[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (q.trim().length < 3) {
      setHits([])
      return
    }
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      setBusy(true)
      try {
        setHits(await searchPlaces(q.trim(), ctrl.signal))
      } catch {
        if (!ctrl.signal.aborted) setHits([])
      } finally {
        if (!ctrl.signal.aborted) setBusy(false)
      }
    }, 500)
    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
  }, [q])
  return { hits, busy, clear: () => setHits([]) }
}

function AddRow({ onAdd }: { onAdd: (p: Place) => void }) {
  const [q, setQ] = useState('')
  const { hits, busy, clear } = usePlaceSearch(q)
  return (
    <div className="wp">
      <span className="dot" style={{ background: '#9ca3af' }}>+</span>
      <input type="search" placeholder="Adres ya da yer adı arayın…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Yeni nokta ara" />
      <span className="label">{busy ? '…' : ''}</span>
      {hits.length > 0 && (
        <ul className="suggest">
          {hits.map((h, i) => (
            <li key={i}><button type="button" onClick={() => { onAdd(h); setQ(''); clear() }}>{h.label}</button></li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Waypoints({ waypoints, onChange, onAdd, onZoom }: Props) {
  const remove = (id: string) => onChange(waypoints.filter((w) => w.id !== id))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= waypoints.length) return
    const next = waypoints.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="section">
      <div className="inline" style={{ justifyContent: 'space-between' }}>
        <h2>Noktalar</h2>
        <div className="btn-row">
          <button type="button" className="btn small" disabled={waypoints.length < 2} onClick={() => onChange(waypoints.slice().reverse())}>Ters çevir</button>
          <button type="button" className="btn small" disabled={waypoints.length === 0} onClick={() => onChange([])}>Temizle</button>
        </div>
      </div>
      {waypoints.map((w, i) => {
        const color = i === 0 ? WAYPOINT_COLORS.start : i === waypoints.length - 1 ? WAYPOINT_COLORS.end : WAYPOINT_COLORS.via
        const label = i === 0 ? 'A' : i === waypoints.length - 1 ? 'B' : String(i)
        return (
          <div className="wp" key={w.id}>
            <span className="dot" style={{ background: color }}>{label}</span>
            <button type="button" className="btn" style={{ justifyContent: 'flex-start', overflow: 'hidden' }} onClick={() => onZoom(w)} title="Haritada göster">
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.label ?? `${w.lat.toFixed(5)}, ${w.lon.toFixed(5)}`}</span>
            </button>
            <span className="actions">
              <button type="button" className="iconbtn" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="iconbtn" aria-label="Aşağı taşı" disabled={i === waypoints.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="iconbtn" aria-label="Kaldır" onClick={() => remove(w.id)}>✕</button>
            </span>
          </div>
        )
      })}
      <AddRow onAdd={onAdd} />
      <p className="label">Haritaya tıklayarak da nokta ekleyebilir, işaretçileri sürükleyebilirsiniz.</p>
    </div>
  )
}
