import { describe, expect, it } from 'vitest'
import { normalizePlaceName } from './geocode'

describe('normalizePlaceName', () => {
  it('normalizes Kannada place names to English when target language is en', () => {
    expect(normalizePlaceName('ಕೋಗಿಲು', 'en')).toBe('Kogilu')
    expect(normalizePlaceName('ಬೆಂಗಳೂರು ನಗರ', 'en')).toBe('Bengaluru Urban')
    expect(normalizePlaceName('ಬೆಂಗಳೂರು', 'en')).toBe('Bengaluru')
    expect(normalizePlaceName('ವಿಜಯಪುರ', 'en')).toBe('Vijayapura')
    expect(normalizePlaceName('ಮಂಡ್ಯ', 'en')).toBe('Mandya')
  })

  it('translates English place names to Kannada when target language is kn', () => {
    expect(normalizePlaceName('Kogilu', 'kn')).toBe('ಕೋಗಿಲು')
    expect(normalizePlaceName('Bengaluru Urban', 'kn')).toBe('ಬೆಂಗಳೂರು ನಗರ')
    expect(normalizePlaceName('Vijayapura', 'kn')).toBe('ವಿಜಯಪುರ')
    expect(normalizePlaceName('Mandya', 'kn')).toBe('ಮಂಡ್ಯ')
  })

  it('translates place names to Hindi when target language is hi', () => {
    expect(normalizePlaceName('Kogilu', 'hi')).toBe('कोगिलु')
    expect(normalizePlaceName('Bengaluru Urban', 'hi')).toBe('बेंगलुरु शहरी')
    expect(normalizePlaceName('Vijayapura', 'hi')).toBe('विजयपुर')
    expect(normalizePlaceName('Mandya', 'hi')).toBe('मांड्या')
  })

  it('preserves English names when target language is en', () => {
    expect(normalizePlaceName('Kogilu', 'en')).toBe('Kogilu')
    expect(normalizePlaceName('Mandya', 'en')).toBe('Mandya')
    expect(normalizePlaceName('Vijayapura', 'en')).toBe('Vijayapura')
  })
})
