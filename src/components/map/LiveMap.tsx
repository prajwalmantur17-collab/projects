import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { LocateFixed } from 'lucide-react'
import type { Coordinates } from '../../types'
import { farmerIcon, machineIcon, meIcon, trackedIcon } from './mapIcons'

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

export function LiveMap({
  me,
  machines = [],
  tracked,
  trackedKind = 'machine',
  className = 'h-72',
}: LiveMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const userMoved = useRef(false)

  const points = useMemo(() => {
    const list: Coordinates[] = []
    if (me) list.push(me)
    if (tracked) {
      list.push(tracked)
    } else {
      for (const machine of machines) list.push(machine.position)
    }
    return list
  }, [me, tracked, machines])

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
                      View machine
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))
          : null}

        {me && tracked ? (
          <Polyline
            positions={[toLatLng(tracked), toLatLng(me)]}
            pathOptions={{ color: '#c48516', weight: 4, dashArray: '8 10' }}
          />
        ) : null}

        {tracked ? (
          <Marker
            position={toLatLng(tracked)}
            icon={trackedKind === 'farmer' ? farmerIcon : trackedIcon}
            zIndexOffset={900}
          />
        ) : null}
        {me ? <Marker position={toLatLng(me)} icon={meIcon} zIndexOffset={1000} /> : null}
      </MapContainer>

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
