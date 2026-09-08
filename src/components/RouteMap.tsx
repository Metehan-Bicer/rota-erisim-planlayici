import { useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Layer, Marker, NavigationControl, Popup, ScaleControl, Source, type LayerProps, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre'
import type { ExpressionSpecification } from 'maplibre-gl'
import along from '@turf/along'
import { lineString } from '@turf/helpers'
import type { Mode, Waypoint } from '../lib/types'
import { WAYPOINT_COLORS } from '../lib/types'
import { ELEVATION_INTERVAL, type IsoCollection, type RouteResult } from '../lib/valhalla'
import { gradientExpression } from '../lib/slope'
import type { Poi } from '../lib/overpass'

const STYLE = 'https://tiles.openfreemap.org/styles/liberty'

export interface PoiWithContour extends Poi {
  contour: number
  color: string
}

interface Props {
  mode: Mode
  waypoints: Waypoint[]
  onWaypointMove: (id: string, lat: number, lon: number) => void
  onMapClick: (lat: number, lon: number) => void
  route: RouteResult | null
  hover: number | null
  iso: IsoCollection | null
  isoOrigin: { lat: number; lon: number } | null
  pois: PoiWithContour[]
  /** Bounds to fit; the key changes whenever a new fit is requested. */
  focus: { bbox: [number, number, number, number]; key: number } | null
  /** A single point to fly to (maneuver clicks). */
  fly: { lon: number; lat: number; key: number } | null
  busy: boolean
  hint: string | null
}

export function RouteMap({ mode, waypoints, onWaypointMove, onMapClick, route, hover, iso, isoOrigin, pois, focus, fly, busy, hint }: Props) {
  const mapRef = useRef<MapRef>(null)
  const [cursor, setCursor] = useState<'crosshair' | 'pointer'>('crosshair')
  const [popup, setPopup] = useState<PoiWithContour | null>(null)

  const routeGeo = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: route ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: route.coords } }] : [],
    }),
    [route],
  )
  const gradient = useMemo(() => (route ? (gradientExpression(route.elevation) as unknown as ExpressionSpecification) : undefined), [route])

  const hoverPos = useMemo(() => {
    if (!route || hover === null || route.coords.length < 2) return null
    const p = along(lineString(route.coords), (hover * ELEVATION_INTERVAL) / 1000, { units: 'kilometers' })
    return p.geometry.coordinates as [number, number]
  }, [route, hover])

  const poiGeo = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: pois.map((p) => ({ type: 'Feature' as const, properties: { id: p.id, name: p.name, contour: p.contour, color: p.color }, geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] } })),
    }),
    [pois],
  )

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    const [w, s, e, n] = focus.bbox
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: { top: 60, bottom: 40, left: 40, right: 40 }, maxZoom: 16, duration: 700 },
    )
  }, [focus])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !fly) return
    map.flyTo({ center: [fly.lon, fly.lat], zoom: Math.max(map.getZoom(), 15), duration: 700 })
  }, [fly])

  const casing: LayerProps = { id: 'route-casing', type: 'line', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 } }
  const line: LayerProps = {
    id: 'route-line',
    type: 'line',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-width': 5, ...(gradient ? { 'line-gradient': gradient } : { 'line-color': '#2563eb' }) },
  }
  const isoFill: LayerProps = { id: 'iso-fill', type: 'fill', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.22 } }
  const isoLine: LayerProps = { id: 'iso-line', type: 'line', paint: { 'line-color': ['get', 'color'], 'line-width': 2 } }
  const poiLayer: LayerProps = {
    id: 'pois',
    type: 'circle',
    paint: { 'circle-radius': 6, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
  }

  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (f && f.layer.id === 'pois') {
      const p = pois.find((x) => x.id === Number(f.properties?.id))
      if (p) setPopup(p)
      return
    }
    setPopup(null)
    onMapClick(e.lngLat.lat, e.lngLat.lng)
  }

  return (
    <div className="map-area">
      <MapGL
        ref={mapRef}
        initialViewState={{ longitude: 32.85, latitude: 39.92, zoom: 11 }}
        mapStyle={STYLE}
        attributionControl={{ compact: true }}
        interactiveLayerIds={['pois']}
        cursor={cursor}
        onMouseEnter={() => setCursor('pointer')}
        onMouseLeave={() => setCursor('crosshair')}
        onClick={onClick}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-right" />

        {iso && (
          <Source id="iso" type="geojson" data={iso}>
            <Layer {...isoFill} />
            <Layer {...isoLine} />
          </Source>
        )}
        <Source id="route" type="geojson" data={routeGeo} lineMetrics>
          <Layer {...casing} />
          <Layer {...line} />
        </Source>
        <Source id="pois" type="geojson" data={poiGeo}>
          <Layer {...poiLayer} />
        </Source>

        {mode === 'route' &&
          waypoints.map((w, i) => {
            const color = i === 0 ? WAYPOINT_COLORS.start : i === waypoints.length - 1 ? WAYPOINT_COLORS.end : WAYPOINT_COLORS.via
            const label = i === 0 ? 'A' : i === waypoints.length - 1 ? 'B' : String(i)
            return (
              <Marker key={w.id} longitude={w.lon} latitude={w.lat} anchor="center" draggable onDragEnd={(e) => onWaypointMove(w.id, e.lngLat.lat, e.lngLat.lng)}>
                <div className="wp-marker" style={{ background: color }} title={w.label ?? label}>{label}</div>
              </Marker>
            )
          })}
        {mode === 'iso' && isoOrigin && (
          <Marker longitude={isoOrigin.lon} latitude={isoOrigin.lat} anchor="center">
            <div className="wp-marker" style={{ background: '#111827' }}>●</div>
          </Marker>
        )}
        {hoverPos && (
          <Marker longitude={hoverPos[0]} latitude={hoverPos[1]} anchor="center">
            <div className="hover-marker" />
          </Marker>
        )}
        {popup && (
          <Popup longitude={popup.lon} latitude={popup.lat} anchor="bottom" offset={10} onClose={() => setPopup(null)} closeButton={false}>
            <b>{popup.name}</b>
            <br />
            {popup.contour} dk içinde
          </Popup>
        )}
      </MapGL>
      {hint && <div className="map-hint">{hint}</div>}
      {busy && <div className="loading-badge">Hesaplanıyor…</div>}
    </div>
  )
}
