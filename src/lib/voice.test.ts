import { describe, expect, it } from 'vitest'
import { parseSpokenQuery } from './voice'

describe('parseSpokenQuery - Voice Mode Switching & Voice Search', () => {
  it('detects English mode switch commands', () => {
    expect(parseSpokenQuery('switch to owner mode')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'owner',
    })

    expect(parseSpokenQuery('owner mode')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'owner',
    })

    expect(parseSpokenQuery('switch to farmer mode')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'farmer',
    })

    expect(parseSpokenQuery('farmer mode')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'farmer',
    })

    expect(parseSpokenQuery('switch mode')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'toggle',
    })

    expect(parseSpokenQuery('change mode')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'toggle',
    })
  })

  it('detects Kannada mode switch commands', () => {
    expect(parseSpokenQuery('ಮಾಲೀಕ ಮೋಡ್')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'owner',
    })

    expect(parseSpokenQuery('ಮಾಲೀಕ ಮೋಡ್‌ಗೆ ಬದಲಿಸಿ')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'owner',
    })

    expect(parseSpokenQuery('ರೈತ ಮೋಡ್')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'farmer',
    })

    expect(parseSpokenQuery('ಮೋಡ್ ಬದಲಿಸಿ')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'toggle',
    })
  })

  it('detects Hindi mode switch commands', () => {
    expect(parseSpokenQuery('मालिक मोड')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'owner',
    })

    expect(parseSpokenQuery('किसान मोड')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'farmer',
    })

    expect(parseSpokenQuery('मोड बदलो')).toMatchObject({
      isModeSwitch: true,
      switchTarget: 'toggle',
    })
  })

  it('does not falsely trigger mode switch on normal crop and village queries', () => {
    const res = parseSpokenQuery('5 acres paddy in kogilu')
    expect(res.isModeSwitch).toBeFalsy()
    expect(res.crop).toBe('rice')
    expect(res.acreage).toBe('5')
  })
})
