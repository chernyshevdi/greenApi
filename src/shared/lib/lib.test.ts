import { describe, expect, it } from 'vitest'
import { avatarColor, formatTime, getInitials, isValidPhone, normalizePhone, pluralize } from '.'

describe('normalizePhone', () => {
  it('strips formatting', () => {
    expect(normalizePhone('+7 (987) 654-32-10')).toBe('79876543210')
  })
  it('does not rewrite the leading digit', () => {
    expect(normalizePhone('8 987 654 32 10')).toBe('89876543210')
  })
  it('keeps other countries untouched', () => {
    expect(normalizePhone('+375 29 123-45-67')).toBe('375291234567')
  })
  it('returns empty string for garbage', () => {
    expect(normalizePhone('abc')).toBe('')
  })
})

describe('isValidPhone', () => {
  it.each([
    ['79876543210', true],
    ['1234567', false],
    ['1234567890123456', false],
    ['', false],
  ])('%s → %s', (value, expected) => {
    expect(isValidPhone(value)).toBe(expected)
  })
})

describe('getInitials', () => {
  it.each([
    ['Василиса Премудрая', 'ВП'],
    ['  иван  ', 'И'],
    ['Anna Maria Lopez', 'AM'],
    ['', '#'],
  ])('%j → %s', (name, expected) => {
    expect(getInitials(name)).toBe(expected)
  })
})

describe('avatarColor', () => {
  it('is stable for the same seed', () => {
    expect(avatarColor('10000000')).toBe(avatarColor('10000000'))
  })
  it('returns a hex color', () => {
    expect(avatarColor('x')).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('formatTime', () => {
  it('formats as HH:MM', () => {
    expect(formatTime(1763115112)).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('pluralize', () => {
  const forms: [string, string, string] = ['чат', 'чата', 'чатов']
  it.each([
    [1, 'чат'],
    [2, 'чата'],
    [4, 'чата'],
    [5, 'чатов'],
    [11, 'чатов'],
    [12, 'чатов'],
    [21, 'чат'],
    [22, 'чата'],
    [100, 'чатов'],
  ])('%i → %s', (n, expected) => {
    expect(pluralize(n, forms)).toBe(expected)
  })
})
