import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_PATTERN_ATTEMPTS,
  attemptsLeft,
  hasPattern,
  isPatternLockSupported,
  isValidPattern,
  isUnlocked,
  markLocked,
  markUnlocked,
  removePattern,
  savePattern,
  verifyPattern,
} from './patternLock'

const USER = 'user-1'

describe('isValidPattern', () => {
  it('needs 4 to 9 different dots between 0 and 8', () => {
    expect(isValidPattern([0, 1, 2, 5])).toBe(true)
    expect(isValidPattern([0, 1, 2])).toBe(false)
    expect(isValidPattern([0, 1, 1, 2])).toBe(false)
    expect(isValidPattern([0, 1, 2, 9])).toBe(false)
    expect(isValidPattern('1234')).toBe(false)
  })
})

describe('unlock flag', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    markLocked(USER)
  })

  it('remembers unlock until locked again', () => {
    expect(isUnlocked(USER)).toBe(false)
    markUnlocked(USER)
    expect(isUnlocked(USER)).toBe(true)
    markLocked(USER)
    expect(isUnlocked(USER)).toBe(false)
  })
})

// Needs Web Crypto (available in Node 20+ and every modern browser).
describe.skipIf(!isPatternLockSupported())('pattern save and verify', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('accepts the right pattern and rejects a wrong one', async () => {
    await savePattern(USER, [0, 1, 2, 5])
    expect(hasPattern(USER)).toBe(true)
    expect(await verifyPattern(USER, [0, 1, 2, 5])).toBe('ok')
    expect(await verifyPattern(USER, [5, 2, 1, 0])).toBe('wrong')
  })

  it('does not store the pattern in plain text', async () => {
    await savePattern(USER, [3, 4, 5, 8])
    const stored = window.localStorage.getItem(`hr_pattern_v1_${USER}`) ?? ''
    expect(stored).not.toContain('3458')
    expect(stored).not.toContain('[3,4,5,8]')
  })

  it('locks out after too many wrong tries', async () => {
    await savePattern(USER, [0, 1, 2, 5])
    for (let attempt = 1; attempt < MAX_PATTERN_ATTEMPTS; attempt += 1) {
      expect(await verifyPattern(USER, [8, 7, 6, 3])).toBe('wrong')
    }
    expect(attemptsLeft(USER)).toBe(1)
    expect(await verifyPattern(USER, [8, 7, 6, 3])).toBe('locked_out')
    // Even the right pattern is refused once locked out.
    expect(await verifyPattern(USER, [0, 1, 2, 5])).toBe('locked_out')
  })

  it('resets the wrong-try counter after a correct pattern', async () => {
    await savePattern(USER, [0, 1, 2, 5])
    await verifyPattern(USER, [8, 7, 6, 3])
    expect(attemptsLeft(USER)).toBe(MAX_PATTERN_ATTEMPTS - 1)
    expect(await verifyPattern(USER, [0, 1, 2, 5])).toBe('ok')
    expect(attemptsLeft(USER)).toBe(MAX_PATTERN_ATTEMPTS)
  })

  it('refuses a pattern that is too short', async () => {
    await expect(savePattern(USER, [0, 1])).rejects.toThrow()
    expect(hasPattern(USER)).toBe(false)
  })

  it('removes the pattern', async () => {
    await savePattern(USER, [0, 1, 2, 5])
    removePattern(USER)
    expect(hasPattern(USER)).toBe(false)
  })
})
