import { pushLiveLocation, stopLiveLocation } from './liveLocation'
import type { Coordinates } from '../types'

/**
 * Live location sharing for BOTH the machine owner and the farmer.
 *
 * This lives outside React on purpose: booking lists re-render (and briefly
 * unmount) whenever a booking changes, and route changes unmount pages. A
 * module-level session keeps sharing alive for as long as the app tab stays
 * open. One GPS watch serves every confirmed booking being shared.
 *
 * Sharing starts automatically for confirmed bookings around their service
 * date (see LiveShareAutoStart). A person can stop it; that choice is
 * remembered per booking so it does not silently restart.
 */

export interface ShareState {
  activeBookingIds: string[]
  lastSentAt: number | null
  error: string | null
}

const SEND_INTERVAL_MS = 5000
const PAUSED_KEY = 'harvest-rentals-live-paused'
const FATAL_CODES = ['HR_OUT_OF_WINDOW', 'HR_INVALID_STATE', 'HR_NOT_OWNER', 'HR_NOT_FOUND']

const active = new Set<string>()
const listeners = new Set<() => void>()

let state: ShareState = { activeBookingIds: [], lastSentAt: null, error: null }
let watchId: number | null = null
let timer: number | null = null
let lastFix: { position: Coordinates; heading: number | null } | null = null
let wakeLock: WakeLockSentinel | null = null

/** Sharing is available from the day before the service date until the day after. */
export function isInShareWindow(serviceDate: string): boolean {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const diffDays = (Date.parse(serviceDate) - Date.parse(today)) / 86_400_000
  return Number.isFinite(diffDays) && Math.abs(diffDays) <= 1
}

function readPaused(): Set<string> {
  try {
    const raw = window.localStorage.getItem(PAUSED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function writePaused(paused: Set<string>) {
  try {
    window.localStorage.setItem(PAUSED_KEY, JSON.stringify([...paused].slice(-100)))
  } catch {
    // Storage can be unavailable (private mode); sharing still works.
  }
}

export function isPaused(bookingId: string): boolean {
  return readPaused().has(bookingId)
}

function publish(patch: Partial<ShareState> = {}) {
  state = { ...state, ...patch, activeBookingIds: [...active] }
  listeners.forEach((listener) => listener())
}

export function subscribeShare(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getShareState(): ShareState {
  return state
}

function messageOf(caught: unknown): string {
  if (caught && typeof caught === 'object' && 'message' in caught) {
    return String((caught as { message: unknown }).message)
  }
  return ''
}

function friendlyError(message: string): string {
  if (message.includes('HR_OUT_OF_WINDOW')) {
    return 'Live location is only available around the service date.'
  }
  if (message.includes('HR_INVALID_STATE')) {
    return 'This booking is no longer confirmed, so sharing was stopped.'
  }
  return 'Could not send your location. Check your internet connection.'
}

async function acquireWakeLock() {
  if (!('wakeLock' in navigator) || wakeLock) return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => {
      wakeLock = null
    })
  } catch {
    wakeLock = null
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && active.size > 0) {
    void acquireWakeLock()
  }
}

async function sendToAll() {
  if (!lastFix || active.size === 0) return
  const fix = lastFix
  let anySent = false
  let failure: string | null = null

  await Promise.all(
    [...active].map(async (bookingId) => {
      try {
        await pushLiveLocation(bookingId, fix.position, fix.heading)
        anySent = true
      } catch (caught) {
        const message = messageOf(caught)
        failure = friendlyError(message)
        if (FATAL_CODES.some((code) => message.includes(code))) {
          active.delete(bookingId)
        }
      }
    }),
  )

  if (active.size === 0) teardown()
  publish({
    lastSentAt: anySent ? Date.now() : state.lastSentAt,
    error: failure,
  })
}

function ensureRunning() {
  if (watchId !== null) return

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const isFirstFix = lastFix === null
      lastFix = {
        position: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        heading:
          position.coords.heading !== null && Number.isFinite(position.coords.heading)
            ? position.coords.heading
            : null,
      }
      if (isFirstFix) void sendToAll()
    },
    (error) => {
      const denied = error.code === error.PERMISSION_DENIED
      releaseAll()
      publish({
        error: denied
          ? 'Location permission was denied. Allow location access in your browser to share your live location.'
          : 'Could not read your location. Move to an open area and try again.',
      })
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  )

  // Heartbeat: keeps the other person's map fresh even when you are standing still.
  timer = window.setInterval(() => void sendToAll(), SEND_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
  void acquireWakeLock()
}

function teardown() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
  if (timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
  document.removeEventListener('visibilitychange', onVisibilityChange)
  void wakeLock?.release().catch(() => undefined)
  wakeLock = null
  lastFix = null
}

/**
 * Start sharing for a booking. `auto` means the app started it on its own
 * (booking accepted, or app opened on the service day); an auto start never
 * overrides a booking the person stopped themselves.
 */
export function startSharing(bookingId: string, auto = false): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    publish({ error: 'This device or browser does not support location.' })
    return
  }
  if (auto) {
    if (isPaused(bookingId)) return
  } else {
    const paused = readPaused()
    if (paused.delete(bookingId)) writePaused(paused)
  }
  active.add(bookingId)
  publish({ error: null })
  ensureRunning()
}

/** Person pressed Stop: stop now and do not auto-restart this booking. */
export function stopSharing(bookingId: string): void {
  const paused = readPaused()
  paused.add(bookingId)
  writePaused(paused)
  releaseSharing(bookingId)
}

/** Stop one booking without remembering it as a manual stop. */
export function releaseSharing(bookingId: string): void {
  if (!active.delete(bookingId)) return
  void stopLiveLocation(bookingId).catch(() => undefined)
  if (active.size === 0) teardown()
  publish()
}

/** Stop everything (sign-out, permission denied) without remembering it as a manual stop. */
export function releaseAll(): void {
  const ids = [...active]
  active.clear()
  teardown()
  ids.forEach((id) => void stopLiveLocation(id).catch(() => undefined))
  publish()
}

/** Person pressed Stop on the banner: stop every booking and do not auto-restart them. */
export function stopAllSharing(): void {
  const paused = readPaused()
  active.forEach((id) => paused.add(id))
  writePaused(paused)
  releaseAll()
}
