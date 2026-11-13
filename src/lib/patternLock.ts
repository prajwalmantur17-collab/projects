// Pattern lock helpers.
// The pattern is a quick unlock for THIS device only. It is stored hashed
// (PBKDF2 + random salt) in the browser, never sent to the server, and it
// never replaces the account password.

export const MIN_PATTERN_DOTS = 4
export const MAX_PATTERN_ATTEMPTS = 5
/** Lock again after the app has been in the background this long. */
export const RELOCK_AFTER_MS = 5 * 60 * 1000
export const PATTERN_CHANGED_EVENT = 'hr-pattern-changed'

const PBKDF2_ITERATIONS = 150_000

const storeKey = (userId: string) => `hr_pattern_v1_${userId}`
const failKey = (userId: string) => `hr_pattern_fail_v1_${userId}`
const unlockKey = (userId: string) => `hr_pattern_unlocked_v1_${userId}`

interface StoredPattern {
  v: 1
  salt: string
  hash: string
  iterations: number
}

export type VerifyResult = 'ok' | 'wrong' | 'locked_out'

/** Used when sessionStorage is blocked, so the lock still works for this page load. */
const memoryUnlocked = new Set<string>()

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeLocal(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // storage unavailable
  }
}

function notifyChanged() {
  try {
    window.dispatchEvent(new Event(PATTERN_CHANGED_EVENT))
  } catch {
    // no window (tests / SSR)
  }
}

export function isPatternLockSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle?.deriveBits === 'function'
  )
}

/** A pattern is 4 to 9 different dots, numbered 0 to 8 from the top-left. */
export function isValidPattern(pattern: unknown): pattern is number[] {
  if (!Array.isArray(pattern)) return false
  if (pattern.length < MIN_PATTERN_DOTS || pattern.length > 9) return false
  if (!pattern.every((dot) => Number.isInteger(dot) && dot >= 0 && dot <= 8)) return false
  return new Set(pattern).size === pattern.length
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(Math.floor(hex.length / 2))
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return out
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return diff === 0
}

async function derive(
  userId: string,
  pattern: number[],
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<string> {
  const subtle = globalThis.crypto.subtle
  const material = new TextEncoder().encode(`${userId}:${pattern.join('')}`)
  const key = await subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return toHex(new Uint8Array(bits))
}

function readStored(userId: string): StoredPattern | null {
  const raw = readLocal(storeKey(userId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPattern>
    if (
      parsed.v === 1 &&
      typeof parsed.salt === 'string' &&
      typeof parsed.hash === 'string' &&
      typeof parsed.iterations === 'number'
    ) {
      return parsed as StoredPattern
    }
  } catch {
    // corrupted value: treat as no pattern
  }
  return null
}

function readFails(userId: string): number {
  const value = Number.parseInt(readLocal(failKey(userId)) ?? '0', 10)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function hasPattern(userId: string): boolean {
  return readStored(userId) !== null
}

export function attemptsLeft(userId: string): number {
  return Math.max(0, MAX_PATTERN_ATTEMPTS - readFails(userId))
}

export async function savePattern(userId: string, pattern: number[]): Promise<void> {
  if (!isValidPattern(pattern)) throw new Error('HR_PATTERN_INVALID')
  if (!isPatternLockSupported()) throw new Error('HR_PATTERN_UNSUPPORTED')
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(userId, pattern, salt, PBKDF2_ITERATIONS)
  const stored: StoredPattern = {
    v: 1,
    salt: toHex(salt),
    hash,
    iterations: PBKDF2_ITERATIONS,
  }
  if (!writeLocal(storeKey(userId), JSON.stringify(stored))) {
    throw new Error('HR_PATTERN_STORAGE')
  }
  removeLocal(failKey(userId))
  notifyChanged()
}

export async function verifyPattern(userId: string, pattern: number[]): Promise<VerifyResult> {
  const stored = readStored(userId)
  if (!stored) return 'wrong'

  const fails = readFails(userId)
  if (fails >= MAX_PATTERN_ATTEMPTS) return 'locked_out'

  let matches = false
  if (isValidPattern(pattern)) {
    const hash = await derive(userId, pattern, fromHex(stored.salt), stored.iterations)
    matches = safeEqual(hash, stored.hash)
  }

  if (matches) {
    removeLocal(failKey(userId))
    return 'ok'
  }

  const next = fails + 1
  writeLocal(failKey(userId), String(next))
  return next >= MAX_PATTERN_ATTEMPTS ? 'locked_out' : 'wrong'
}

export function removePattern(userId: string) {
  removeLocal(storeKey(userId))
  removeLocal(failKey(userId))
  markLocked(userId)
  notifyChanged()
}

export function isUnlocked(userId: string): boolean {
  if (memoryUnlocked.has(userId)) return true
  try {
    return window.sessionStorage.getItem(unlockKey(userId)) === '1'
  } catch {
    return false
  }
}

/** Remembers, for this tab only, that the user already proved who they are. */
export function markUnlocked(userId: string) {
  memoryUnlocked.add(userId)
  try {
    window.sessionStorage.setItem(unlockKey(userId), '1')
  } catch {
    // memory fallback above still works
  }
}

export function markLocked(userId: string) {
  memoryUnlocked.delete(userId)
  try {
    window.sessionStorage.removeItem(unlockKey(userId))
  } catch {
    // ignore
  }
}
