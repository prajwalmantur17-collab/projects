import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { Loader2, LocateFixed, Navigation, TriangleAlert } from 'lucide-react'
import { useI18n } from '../../i18n'
import { useRoadRoute } from '../../hooks/useRoadRoute'
import type { Coordinates } from '../../types'
import {
  createMePhotoIcon,
  createPhotoIcon,
  farmerIcon,
  machineIcon,
  meIcon,
  trackedIcon,
} from './mapIcons'

export interface MapMachine {
  id: string
  position: Coordinates
  title: string
  subtitle?: string
}

interface LiveMapProps {
  /** The viewer's own position (blue pulsing dot). */
  me?: Coordinates | null
  /** Listed machines to show as pins. Ignored for framing while `tracked` is set. */
  machines?: MapMachine[]
  /** A machine that is moving towards the viewer (live position). */
  tracked?: Coordinates | null
  /** Who `tracked` is: the machine (default) or the farmer, for the owner's map. */
  trackedKind?: 'machine' | 'farmer'
  /** The viewer's own profile photo. When set it replaces the blue dot. */
  mePhotoUrl?: string | null
  /** The tracked person's profile photo. When set it replaces the tractor / farmer icon. */
  trackedPhotoUrl?: string | null
  className?: string
}

const INDIA_CENTER: [number, number] = [20.5937, 78.9629]

function toLatLng(point: Coordinates): [number, number] {
  return [point.latitude, point.longitude]
}

function fitMap(map: L.Map, points: Coordinates[]) {
  if (points.length === 0) return
  if (points.length === 1) {
    map.setView(toLatLng(points[0]), 14)
    return
  }
  map.fitBounds(L.latLngBounds(points.map(toLatLng)), { padding: [40, 40], maxZoom: 16 })
}

/** Keeps everything in view until the person drags the map themselves. */
function AutoFit({
  points,
  userMoved,
}: {
  points: Coordinates[]
  userMoved: MutableRefObject<boolean>
}) {
  const map = useMap()

  useEffect(() => {
    const markMoved = () => {
      userMoved.current = true
    }
    map.on('dragstart', markMoved)
    return () => {
      map.off('dragstart', markMoved)
    }
  }, [map, userMoved])

  useEffect(() => {
    if (userMoved.current) return
    fitMap(map, points)
  }, [map, points, userMoved])

  return null
}

function formatTravelTime(
  seconds: number,
  t: (key: 'route.minutes' | 'route.hoursMinutes', params: Record<string, string | number>) => string,
): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60))
  if (totalMinutes < 60) return t('route.minutes', { count: totalMinutes })
  return t('route.hoursMinutes', {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  })
}

export function LiveMap({
  me,
  machines = [],
  tracked,
  trackedKind = 'machine',
  trackedPhotoUrl = null,
  mePhotoUrl = null,
  className = 'h-72',
}: LiveMapProps) {
  const { t } = useI18n()
  const meMarkerIcon = useMemo(
    () => (mePhotoUrl ? createMePhotoIcon(mePhotoUrl) : meIcon),
    [mePhotoUrl],
  )
  const trackedMarkerIcon = useMemo(
    () =>
      trackedPhotoUrl ? createPhotoIcon(trackedPhotoUrl) : trackedKind === 'farmer' ? farmerIcon : trackedIcon,
    [trackedPhotoUrl, trackedKind],
  )
  const mapRef = useRef<L.Map | null>(null)
  const userMoved = useRef(false)
  const { route, loading: routeLoading } = useRoadRoute(me, tracked)

  const points = useMemo(() => {
    const list: Coordinates[] = []
    if (me) list.push(me)
    if (tracked) {
      list.push(tracked)
      if (route) {
        for (const [latitude, longitude] of route.points) list.push({ latitude, longitude })
      }
    } else {
      for (const machine of machines) list.push(machine.position)
    }
    return list
  }, [me, tracked, machines, route])

  const recenter = () => {
    userMoved.current = false
    if (mapRef.current) fitMap(mapRef.current, points)
  }

  return (
    <div className={`relative isolate overflow-hidden ${className}`}>
      <MapContainer
        ref={mapRef}
        center={INDIA_CENTER}
        zoom={5}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <AutoFit points={points} userMoved={userMoved} />

        {!tracked
          ? machines.map((machine) => (
              <Marker key={machine.id} position={toLatLng(machine.position)} icon={machineIcon}>
                <Popup>
                  <div className="space-y-1">
                    <p className="text-sm font-bold">{machine.title}</p>
                    {machine.subtitle ? <p className="text-xs">{machine.subtitle}</p> : null}
                    <Link
                      to={`/farmer/machines/${machine.id}`}
                      className="text-xs font-bold text-leaf-700 underline"
                    >
                      {t('ui.viewMachine')}
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))
          : null}

        {me && tracked && route ? (
          <>
            <Polyline
              positions={route.points}
              pathOptions={{ color: '#ffffff', weight: 11, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={route.points}
              pathOptions={{ color: '#16a34a', weight: 6, lineCap: 'round', lineJoin: 'round' }}
            />
          </>
        ) : me && tracked ? (
          <Polyline
            positions={[toLatLng(tracked), toLatLng(me)]}
            pathOptions={{ color: '#c48516', weight: 4, dashArray: '8 10' }}
          />
        ) : null}

        {tracked ? (
          <Marker
            position={toLatLng(tracked)}
            icon={trackedMarkerIcon}
            zIndexOffset={900}
          />
        ) : null}
        {me ? <Marker position={toLatLng(me)} icon={meMarkerIcon} zIndexOffset={1000} /> : null}
      </MapContainer>

      {me && tracked ? (
        route ? (
          <div
            className="absolute bottom-8 left-3 z-[1000] flex h-9 w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-white/10 bg-[rgba(20,28,22,0.85)] px-3 py-1.5 shadow-lg backdrop-blur-md"
            title={t('route.viaRoad')}
            aria-label={t('route.viaRoad')}
          >
            <Navigation className="size-4 shrink-0 fill-[#f5b638] text-[#f5b638]" aria-hidden="true" />
            <span className="whitespace-nowrap text-sm font-bold text-white">
              {formatTravelTime(route.durationSeconds, t)}
            </span>
            <span className="h-4 w-px shrink-0 bg-white/20" aria-hidden="true" />
            <span className="whitespace-nowrap text-sm font-medium text-white/75">
              {(route.distanceMeters / 1000).toFixed(1)} km
            </span>
            <span
              className="size-1.5 shrink-0 rounded-full bg-[#4ade80] motion-safe:animate-pulse"
              aria-hidden="true"
            />
          </div>
        ) : routeLoading ? (
          <div
            className="absolute bottom-8 left-3 z-[1000] flex h-9 w-fit max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-white/10 bg-[rgba(20,28,22,0.85)] px-3 py-1.5 shadow-lg backdrop-blur-md"
            aria-live="polite"
          >
            <Loader2 className="size-4 shrink-0 text-white/80 motion-safe:animate-spin" aria-hidden="true" />
            <span className="whitespace-nowrap text-xs text-white/80">{t('route.loading')}</span>
          </div>
        ) : (
          <div
            className="absolute bottom-8 left-3 z-[1000] flex min-h-[36px] w-fit max-w-[16rem] items-center gap-2 rounded-2xl border border-white/10 bg-[rgba(20,28,22,0.85)] px-3 py-1.5 shadow-lg backdrop-blur-md"
          >
            <TriangleAlert className="size-4 shrink-0 text-[#f5b638]" aria-hidden="true" />
            <span className="line-clamp-2 text-xs text-white/80">{t('route.straightLine')}</span>
          </div>
        )
      ) : null}

      {points.length > 0 ? (
        <button
          type="button"
          onClick={recenter}
          aria-label="Recenter map"
          className="absolute right-3 top-3 z-[1000] flex size-10 items-center justify-center rounded-full bg-white text-leaf-800 shadow-soft ring-1 ring-cream-300 hover:bg-cream-50"
        >
          <LocateFixed className="size-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
