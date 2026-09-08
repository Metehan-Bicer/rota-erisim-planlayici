import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import area from '@turf/area'
import bbox from '@turf/bbox'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import { RouteMap, type PoiWithContour } from './components/RouteMap'
import { Waypoints } from './components/Waypoints'
import { ElevationChart, SlopeLegend } from './components/ElevationChart'
import { Maneuvers } from './components/Maneuvers'
import { IsoPanel, type ContourStat } from './components/IsoPanel'
import { COSTING_LABEL, DEFAULT_OPTIONS, newId, type Costing, type CostingOptions, type Mode, type Waypoint } from './lib/types'
import { fetchIsochrone, fetchRoute, type IsoCollection, type RouteResult } from './lib/valhalla'
import { reverseGeocode, type Place } from './lib/geocode'
import { POI_CATEGORIES, fetchPois } from './lib/overpass'
import { profileStats } from './lib/slope'
import { fmtDuration, fmtElev, fmtKm } from './lib/format'
import { download, toGpx } from './lib/gpx'
import { readHash, writeHash } from './lib/hash'

const COSTINGS: Costing[] = ['auto', 'bicycle', 'pedestrian']
const CONTOUR_COLORS = ['#16a34a', '#ca8a04', '#ea580c', '#dc2626']

export default function App() {
  const initial = useMemo(readHash, [])
  const [mode, setMode] = useState<Mode>(initial.mode ?? 'route')
  const [costing, setCosting] = useState<Costing>(initial.costing ?? 'auto')
  const [options, setOptions] = useState<CostingOptions>(DEFAULT_OPTIONS)
  const [waypoints, setWaypoints] = useState<Waypoint[]>(initial.waypoints ?? [])
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [routeBusy, setRouteBusy] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [focus, setFocus] = useState<{ bbox: [number, number, number, number]; key: number } | null>(null)
  const [fly, setFly] = useState<{ lon: number; lat: number; key: number } | null>(null)

  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(initial.origin ?? null)
  const [originLabel, setOriginLabel] = useState<string | null>(null)
  const [minutes, setMinutes] = useState<number[]>(initial.minutes ?? [5, 10, 15])
  const [reverse, setReverse] = useState(false)
  const [iso, setIso] = useState<IsoCollection | null>(null)
  const [isoBusy, setIsoBusy] = useState(false)
  const [isoError, setIsoError] = useState<string | null>(null)
  const [category, setCategory] = useState(POI_CATEGORIES[0].id)
  const [pois, setPois] = useState<PoiWithContour[]>([])
  const [poiBusy, setPoiBusy] = useState(false)
  const [poiError, setPoiError] = useState<string | null>(null)

  const setOpt = (p: Partial<CostingOptions>) => setOptions((o) => ({ ...o, ...p }))

  // Persist shareable state in the URL.
  useEffect(() => {
    writeHash({ mode, costing, waypoints, origin, minutes })
  }, [mode, costing, waypoints, origin, minutes])

  // Route request (debounced, cancels the previous one).
  useEffect(() => {
    if (mode !== 'route') return
    if (waypoints.length < 2) {
      setRoute(null)
      setRouteError(null)
      return
    }
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      setRouteBusy(true)
      setRouteError(null)
      try {
        const r = await fetchRoute(waypoints, costing, options, ctrl.signal)
        setRoute(r)
        setFocus({ bbox: bbox({ type: 'LineString', coordinates: r.coords }) as [number, number, number, number], key: Date.now() })
      } catch (e) {
        if (ctrl.signal.aborted) return
        setRoute(null)
        setRouteError((e as Error).message)
      } finally {
        if (!ctrl.signal.aborted) setRouteBusy(false)
      }
    }, 350)
    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
  }, [mode, waypoints, costing, options])

  // Isochrone request.
  useEffect(() => {
    if (mode !== 'iso' || !origin) {
      setIso(null)
      setPois([])
      return
    }
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      setIsoBusy(true)
      setIsoError(null)
      setPois([])
      try {
        const fc = await fetchIsochrone(origin, costing, minutes, reverse, options, ctrl.signal)
        // Draw larger contours first so the smaller ones stay visible on top.
        fc.features.sort((a, b) => b.properties.contour - a.properties.contour)
        const sorted = [...minutes].sort((a, b) => a - b)
        for (const f of fc.features) f.properties.color = CONTOUR_COLORS[sorted.indexOf(f.properties.contour)] ?? '#2563eb'
        setIso(fc)
        setFocus({ bbox: bbox(fc) as [number, number, number, number], key: Date.now() })
      } catch (e) {
        if (ctrl.signal.aborted) return
        setIso(null)
        setIsoError((e as Error).message)
      } finally {
        if (!ctrl.signal.aborted) setIsoBusy(false)
      }
    }, 300)
    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
  }, [mode, origin, costing, minutes, reverse, options])

  // Label the isochrone origin.
  useEffect(() => {
    if (!origin) {
      setOriginLabel(null)
      return
    }
    const ctrl = new AbortController()
    reverseGeocode(origin.lat, origin.lon, ctrl.signal).then((l) => { if (!ctrl.signal.aborted) setOriginLabel(l) })
    return () => ctrl.abort()
  }, [origin])

  const labelTimers = useRef<globalThis.Map<string, AbortController>>(new globalThis.Map())
  const labelWaypoint = useCallback((w: Waypoint) => {
    labelTimers.current.get(w.id)?.abort()
    const ctrl = new AbortController()
    labelTimers.current.set(w.id, ctrl)
    reverseGeocode(w.lat, w.lon, ctrl.signal).then((label) => {
      if (ctrl.signal.aborted || !label) return
      setWaypoints((prev) => prev.map((x) => (x.id === w.id ? { ...x, label } : x)))
    })
  }, [])

  // Waypoints restored from the URL have no label yet.
  useEffect(() => {
    for (const w of waypoints) if (!w.label) labelWaypoint(w)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onMapClick = (lat: number, lon: number) => {
    if (mode === 'route') {
      const w: Waypoint = { id: newId(), lat, lon }
      setWaypoints((prev) => [...prev, w])
      labelWaypoint(w)
    } else {
      setOrigin({ lat, lon })
    }
  }
  const onWaypointMove = (id: string, lat: number, lon: number) => {
    setWaypoints((prev) => prev.map((w) => (w.id === id ? { ...w, lat, lon, label: undefined } : w)))
    labelWaypoint({ id, lat, lon })
  }
  const addPlace = (p: Place) => {
    const w: Waypoint = { id: newId(), lat: p.lat, lon: p.lon, label: p.label.split(',').slice(0, 2).join(',') }
    setWaypoints((prev) => [...prev, w])
    setFly({ lon: p.lon, lat: p.lat, key: Date.now() })
  }

  const stats = useMemo(() => (route && route.elevation.length ? profileStats(route.elevation) : null), [route])

  const isoStats = useMemo<ContourStat[]>(() => {
    if (!iso) return []
    return [...iso.features]
      .sort((a, b) => a.properties.contour - b.properties.contour)
      .map((f) => ({
        minutes: f.properties.contour,
        color: f.properties.color ?? '#2563eb',
        areaKm2: area(f) / 1e6,
        poiCount: pois.filter((p) => p.contour <= f.properties.contour).length,
      }))
  }, [iso, pois])

  const countPois = async () => {
    if (!iso) return
    const cat = POI_CATEGORIES.find((c) => c.id === category)!
    setPoiBusy(true)
    setPoiError(null)
    try {
      const list = await fetchPois(cat, bbox(iso) as [number, number, number, number])
      const contours = [...iso.features].sort((a, b) => a.properties.contour - b.properties.contour)
      const inside: PoiWithContour[] = []
      for (const p of list) {
        const pt = point([p.lon, p.lat])
        const c = contours.find((f) => booleanPointInPolygon(pt, f))
        if (c) inside.push({ ...p, contour: c.properties.contour, color: c.properties.color ?? '#2563eb' })
      }
      inside.sort((a, b) => a.contour - b.contour || a.name.localeCompare(b.name, 'tr'))
      setPois(inside)
      if (inside.length === 0) setPoiError('Bu alanda kayıtlı yer bulunamadı.')
    } catch (e) {
      setPoiError((e as Error).message)
    } finally {
      setPoiBusy(false)
    }
  }

  const exportGeoJSON = () => {
    if (!route) return
    const fc = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { name: 'Rota', costing, length_km: route.lengthKm, time_s: route.timeSec }, geometry: { type: 'LineString', coordinates: route.coords } },
        ...waypoints.map((w, i) => ({ type: 'Feature', properties: { name: w.label ?? `Nokta ${i + 1}`, order: i }, geometry: { type: 'Point', coordinates: [w.lon, w.lat] } })),
      ],
    }
    download('rota.geojson', JSON.stringify(fc, null, 2), 'application/geo+json')
  }

  const hint =
    mode === 'route'
      ? waypoints.length === 0
        ? 'Başlangıç için haritaya tıklayın'
        : waypoints.length === 1
          ? 'Varış noktası için tekrar tıklayın'
          : null
      : origin
        ? null
        : 'Başlangıç noktası için haritaya tıklayın'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-head">
          <h1>Rota ve Erişim Planlayıcı</h1>
          <p>Valhalla yönlendirme, OpenStreetMap verisi</p>
        </div>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'route'} onClick={() => setMode('route')}>Rota</button>
          <button type="button" role="tab" aria-selected={mode === 'iso'} onClick={() => setMode('iso')}>Erişim alanı</button>
        </div>

        <div className="panel">
          <div className="section">
            <h2>Ulaşım</h2>
            <div className="seg" role="group" aria-label="Ulaşım türü">
              {COSTINGS.map((c) => (
                <button key={c} type="button" aria-pressed={costing === c} onClick={() => setCosting(c)}>{COSTING_LABEL[c]}</button>
              ))}
            </div>
            {costing === 'auto' && (
              <div className="inline">
                <label className="check"><input type="checkbox" checked={options.useHighways < 0.5} onChange={(e) => setOpt({ useHighways: e.target.checked ? 0 : 1 })} />Otoyoldan kaçın</label>
                <label className="check"><input type="checkbox" checked={options.useTolls < 0.5} onChange={(e) => setOpt({ useTolls: e.target.checked ? 0 : 1 })} />Ücretli yoldan kaçın</label>
              </div>
            )}
            {costing === 'bicycle' && (
              <>
                <div className="control">
                  <label htmlFor="btype">Bisiklet türü</label>
                  <select id="btype" value={options.bicycleType} onChange={(e) => setOpt({ bicycleType: e.target.value as CostingOptions['bicycleType'] })}>
                    <option value="Road">Yol bisikleti</option>
                    <option value="Hybrid">Şehir / hibrit</option>
                    <option value="Mountain">Dağ bisikleti</option>
                  </select>
                </div>
                <div className="control">
                  <label htmlFor="hills">Yokuş toleransı: {Math.round(options.useHills * 100)}%</label>
                  <input id="hills" type="range" min={0} max={1} step={0.1} value={options.useHills} onChange={(e) => setOpt({ useHills: Number(e.target.value) })} />
                </div>
              </>
            )}
            {costing === 'pedestrian' && (
              <div className="control">
                <label htmlFor="speed">Yürüme hızı: {options.walkingSpeed.toFixed(1)} km/sa</label>
                <input id="speed" type="range" min={2} max={7} step={0.1} value={options.walkingSpeed} onChange={(e) => setOpt({ walkingSpeed: Number(e.target.value) })} />
              </div>
            )}
          </div>

          {mode === 'route' && (
            <>
              <Waypoints waypoints={waypoints} onChange={(next) => setWaypoints(next)} onAdd={addPlace} onZoom={(w) => setFly({ lon: w.lon, lat: w.lat, key: Date.now() })} />
              {routeError && <div className="section"><div className="msg error">{routeError}</div></div>}
              {route && (
                <>
                  <div className="section">
                    <h2>Özet</h2>
                    <div className="stats">
                      <div className="stat"><div className="k">Mesafe</div><div className="v">{fmtKm(route.lengthKm)}</div></div>
                      <div className="stat"><div className="k">Süre</div><div className="v">{fmtDuration(route.timeSec)}</div></div>
                      <div className="stat"><div className="k">Ortalama</div><div className="v">{(route.lengthKm / (route.timeSec / 3600)).toFixed(0)} <small>km/sa</small></div></div>
                      {stats && (
                        <>
                          <div className="stat"><div className="k">Tırmanış</div><div className="v">{fmtElev(stats.ascent)}</div></div>
                          <div className="stat"><div className="k">İniş</div><div className="v">{fmtElev(stats.descent)}</div></div>
                          <div className="stat"><div className="k">Yükseklik</div><div className="v">{fmtElev(stats.min)}<small> – {fmtElev(stats.max)}</small></div></div>
                        </>
                      )}
                    </div>
                    <div className="btn-row">
                      <button type="button" className="btn" onClick={() => download('rota.gpx', toGpx(route, 'Rota'), 'application/gpx+xml')}>GPX indir</button>
                      <button type="button" className="btn" onClick={exportGeoJSON}>GeoJSON indir</button>
                      <button type="button" className="btn" onClick={() => setFocus({ bbox: bbox({ type: 'LineString', coordinates: route.coords }) as [number, number, number, number], key: Date.now() })}>Rotayı sığdır</button>
                    </div>
                  </div>
                  {route.elevation.length > 1 && (
                    <div className="section">
                      <h2>Yükseklik profili</h2>
                      <ElevationChart elevation={route.elevation} hover={hover} onHover={setHover} />
                      <SlopeLegend />
                    </div>
                  )}
                  <div className="section" style={{ padding: 0 }}>
                    <h2 style={{ padding: '12px 16px 6px' }}>Yol tarifi ({route.maneuvers.length} adım)</h2>
                    <Maneuvers maneuvers={route.maneuvers} onPick={(i) => { const c = route.coords[Math.min(i, route.coords.length - 1)]; setFly({ lon: c[0], lat: c[1], key: Date.now() }) }} />
                  </div>
                </>
              )}
            </>
          )}

          {mode === 'iso' && (
            <>
              <IsoPanel
                origin={origin}
                originLabel={originLabel}
                minutes={minutes}
                onMinutes={setMinutes}
                reverse={reverse}
                onReverse={setReverse}
                stats={isoStats}
                category={category}
                onCategory={(id) => { setCategory(id); setPois([]); setPoiError(null) }}
                onCount={countPois}
                pois={pois}
                poiBusy={poiBusy}
                poiError={poiError}
                onPoiPick={(p) => setFly({ lon: p.lon, lat: p.lat, key: Date.now() })}
                onClear={() => { setOrigin(null); setIso(null); setPois([]) }}
              />
              {isoError && <div className="section"><div className="msg error">{isoError}</div></div>}
            </>
          )}

          <div className="section">
            <p className="label">
              Yönlendirme ve erişim alanları <a href="https://valhalla.github.io/valhalla/" target="_blank" rel="noreferrer">Valhalla</a> (OSM sunucusu), yer arama Nominatim, yer sayımı Overpass API ile yapılır. Sayfa adresi mevcut planı içerir; paylaşılabilir.
            </p>
          </div>
        </div>
      </aside>

      <RouteMap
        mode={mode}
        waypoints={waypoints}
        onWaypointMove={onWaypointMove}
        onMapClick={onMapClick}
        route={mode === 'route' ? route : null}
        hover={hover}
        iso={mode === 'iso' ? iso : null}
        isoOrigin={origin}
        pois={mode === 'iso' ? pois : []}
        focus={focus}
        fly={fly}
        busy={routeBusy || isoBusy}
        hint={hint}
      />
    </div>
  )
}
