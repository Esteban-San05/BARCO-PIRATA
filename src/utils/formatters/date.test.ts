import { describe, it, expect } from 'vitest'
import { formatDate, formatDateShort, formatDateTime, formatTime } from './date'

describe('formatDate', () => {
  it('formatea fecha ISO en español largo', () => {
    const result = formatDate('2026-04-22')
    expect(result).toContain('22')
    expect(result).toMatch(/abril/i)
    expect(result).toContain('2026')
  })

  it('devuelve – para fecha inválida', () => {
    expect(formatDate('not-a-date')).toBe('–')
    expect(formatDate('')).toBe('–')
  })

  it('acepta un objeto Date', () => {
    const d = new Date(2026, 3, 22) // abril 22
    const result = formatDate(d)
    expect(result).toContain('22')
    expect(result).toContain('2026')
  })
})

describe('formatDateShort', () => {
  it('formatea como dd/MM/yyyy', () => {
    expect(formatDateShort('2026-04-22')).toBe('22/04/2026')
  })

  it('devuelve – para fecha inválida', () => {
    expect(formatDateShort('invalid')).toBe('–')
  })
})

describe('formatDateTime', () => {
  it('incluye la fecha y la hora', () => {
    const result = formatDateTime('2026-04-22T09:30:00')
    expect(result).toContain('22/04/2026')
    expect(result).toMatch(/09:30/)
  })
})

describe('formatTime', () => {
  it('convierte 09:00 a 9:00 AM', () => {
    expect(formatTime('09:00')).toBe('9:00 AM')
  })

  it('convierte 13:00 a 1:00 PM', () => {
    expect(formatTime('13:00')).toBe('1:00 PM')
  })

  it('convierte 17:00 a 5:00 PM', () => {
    expect(formatTime('17:00')).toBe('5:00 PM')
  })

  it('convierte 00:00 a 12:00 AM', () => {
    expect(formatTime('00:00')).toBe('12:00 AM')
  })

  it('convierte 12:00 a 12:00 PM', () => {
    expect(formatTime('12:00')).toBe('12:00 PM')
  })
})
