import { POI_CATEGORIES } from '../lib/overpass'
import { fmtArea } from '../lib/format'
import type { PoiWithContour } from './RouteMap'

export const MINUTE_OPTIONS = [5, 10, 15, 20, 30, 45, 60]

export interface ContourStat {
  minutes: number
  color: string
  areaKm2: number
  poiCount: number
}

interface Props {
  origin: { lat: number; lon: number } | null
  originLabel: string | null
  minutes: number[]
  onMinutes: (m: number[]) => void
  reverse: boolean
  onReverse: (v: boolean) => void
  stats: ContourStat[]
  category: string
  onCategory: (id: string) => void
  onCount: () => void
  pois: PoiWithContour[]
  poiBusy: boolean
  poiError: string | null
  onPoiPick: (p: PoiWithContour) => void
  onClear: () => void
}

export function IsoPanel({ origin, originLabel, minutes, onMinutes, reverse, onReverse, stats, category, onCategory, onCount, pois, poiBusy, poiError, onPoiPick, onClear }: Props) {
  const toggle = (m: number) => {
    if (minutes.includes(m)) {
      if (minutes.length > 1) onMinutes(minutes.filter((x) => x !== m))
    } else if (minutes.length < 4) onMinutes([...minutes, m].sort((a, b) => a - b))
  }
  return (
    <>
      <div className="section">
        <h2>Başlangıç noktası</h2>
        {origin ? (
          <div className="inline">
            <span className="grow">{originLabel ?? `${origin.lat.toFixed(5)}, ${origin.lon.toFixed(5)}`}</span>
            <button type="button" className="btn small" onClick={onClear}>Temizle</button>
          </div>
        ) : (
          <p className="label">Haritaya tıklayarak başlangıç noktasını seçin.</p>
        )}
      </div>
      <div className="section">
        <h2>Süre (dakika, en fazla 4)</h2>
        <div className="chips" role="group" aria-label="Süreler">
          {MINUTE_OPTIONS.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={minutes.includes(m)} onClick={() => toggle(m)}>{m}</button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={reverse} onChange={(e) => onReverse(e.target.checked)} />
          Varış yönü (bu noktaya ulaşabilenler)
        </label>
      </div>
      {stats.length > 0 && (
        <div className="section">
          <h2>Erişim alanları</h2>
          <table className="iso-table">
            <thead>
              <tr><th>Süre</th><th>Alan</th><th>{POI_CATEGORIES.find((c) => c.id === category)?.name ?? 'Nokta'}</th></tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.minutes}>
                  <td><span className="sw" style={{ background: s.color }} />{s.minutes} dk</td>
                  <td>{fmtArea(s.areaKm2)}</td>
                  <td>{pois.length ? s.poiCount : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="label">Alanlar iç içedir; sayımlar birikimlidir (15 dk sütunu 5 ve 10 dk alanlarını da kapsar).</p>
        </div>
      )}
      {stats.length > 0 && (
        <div className="section">
          <h2>Erişilebilen yerler</h2>
          <div className="inline">
            <select className="grow" value={category} onChange={(e) => onCategory(e.target.value)} aria-label="Kategori">
              {POI_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button type="button" className="btn primary" onClick={onCount} disabled={poiBusy}>{poiBusy ? 'Sayılıyor…' : 'Say'}</button>
          </div>
          {poiError && <div className="msg error">{poiError}</div>}
          {pois.length > 0 && (
            <ul className="poi-list">
              {pois.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onPoiPick(p)}>{p.name}</button>
                  <span className="t"><span className="sw" style={{ background: p.color, display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 4 }} />{p.contour} dk</span>
                </li>
              ))}
            </ul>
          )}
          <p className="label">Veriler OpenStreetMap'ten Overpass API ile alınır; eksik ya da eski kayıtlar olabilir.</p>
        </div>
      )}
    </>
  )
}
