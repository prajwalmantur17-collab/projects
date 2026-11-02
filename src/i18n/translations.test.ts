import { describe, expect, it } from 'vitest'
import { en } from './en'
import { hi } from './hi'
import { kn } from './kn'
import { ta } from './ta'
import { translate } from './index'

describe('translations', () => {
  it('has the same keys in every language', () => {
    const english = Object.keys(en).sort()
    expect(Object.keys(kn).sort()).toEqual(english)
    expect(Object.keys(hi).sort()).toEqual(english)
    expect(Object.keys(ta).sort()).toEqual(english)
  })

  it('has no empty strings', () => {
    for (const dictionary of [en, kn, hi, ta]) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(value.trim(), key).not.toBe('')
      }
    }
  })

  it('interpolates parameters and leaves unknown placeholders intact', () => {
    expect(translate('en', 'farmer.resultsFor', { village: 'Hubballi' })).toBe(
      'Machines in Hubballi',
    )
    expect(translate('en', 'farmer.greeting', { name: 'Lakshmi' })).toBe('Namaste, Lakshmi')
    expect(translate('en', 'farmer.greeting', {})).toBe('Namaste, {name}')
  })

  it('translates into Kannada, Hindi, and Tamil', () => {
    expect(translate('kn', 'nav.bookings')).not.toBe(en['nav.bookings'])
    expect(translate('hi', 'nav.bookings')).not.toBe(en['nav.bookings'])
    expect(translate('ta', 'nav.bookings')).not.toBe(en['nav.bookings'])
  })
})
