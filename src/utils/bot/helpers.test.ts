import { describe, it, expect } from 'vitest'
import {
  detectLang,
  formatTime,
  normalizePhone,
  joinList,
  formatClosedDays,
  isPromotionActive,
} from './helpers'

describe('detectLang', () => {
  it('devuelve es por defecto', () => {
    expect(detectLang('hola')).toBe('es')
    expect(detectLang('quiero cancelar')).toBe('es')
    expect(detectLang('')).toBe('es')
  })

  it('detecta inglés con una sola palabra clave', () => {
    expect(detectLang('hello')).toBe('en')
    expect(detectLang('hi there')).toBe('en')
    expect(detectLang('what time')).toBe('en')
    expect(detectLang('I want to cancel')).toBe('en')
  })

  it('es case-insensitive', () => {
    expect(detectLang('HELLO')).toBe('en')
    expect(detectLang('Hello World')).toBe('en')
  })
})

describe('formatTime', () => {
  it('convierte formato 24h a 12h con AM/PM', () => {
    expect(formatTime('09:00:00')).toBe('9:00 AM')
    expect(formatTime('12:00:00')).toBe('12:00 PM')
    expect(formatTime('13:00:00')).toBe('1:00 PM')
    expect(formatTime('17:00:00')).toBe('5:00 PM')
    expect(formatTime('00:00:00')).toBe('12:00 AM')
  })

  it('acepta formato corto HH:MM', () => {
    expect(formatTime('09:00')).toBe('9:00 AM')
    expect(formatTime('15:30')).toBe('3:30 PM')
  })
})

describe('normalizePhone', () => {
  it('mantiene número mexicano con 52', () => {
    expect(normalizePhone('526381234567')).toBe('526381234567')
  })

  it('quita el 1 de 521xxxxxxxxxx', () => {
    expect(normalizePhone('5216381234567')).toBe('526381234567')
  })

  it('agrega 52 a número de 10 dígitos', () => {
    expect(normalizePhone('6381234567')).toBe('526381234567')
  })

  it('ignora caracteres no numéricos', () => {
    expect(normalizePhone('+52 638 123 4567')).toBe('526381234567')
    expect(normalizePhone('(638) 123-4567')).toBe('526381234567')
  })
})

describe('joinList', () => {
  it('lista vacía devuelve cadena vacía', () => {
    expect(joinList([], 'es')).toBe('')
  })

  it('un elemento devuelve el elemento solo', () => {
    expect(joinList(['lunes'], 'es')).toBe('lunes')
  })

  it('dos elementos se unen con "y" / "and"', () => {
    expect(joinList(['lunes', 'martes'], 'es')).toBe('lunes y martes')
    expect(joinList(['Monday', 'Tuesday'], 'en')).toBe('Monday and Tuesday')
  })

  it('tres o más elementos usan coma y conjunción al final', () => {
    expect(joinList(['lunes', 'miércoles', 'viernes'], 'es')).toBe('lunes, miércoles y viernes')
    expect(joinList(['Mon', 'Wed', 'Fri'], 'en')).toBe('Mon, Wed and Fri')
  })
})

describe('formatClosedDays', () => {
  it('sin días cerrados indica operación todos los días', () => {
    expect(formatClosedDays([], 'es')).toBe('Operamos *todos los días*.')
    expect(formatClosedDays([], 'en')).toBe('We operate *every day*.')
  })

  it('un día cerrado (lunes = 1)', () => {
    expect(formatClosedDays([1], 'es')).toBe('Cerrado los *lunes*.')
    expect(formatClosedDays([1], 'en')).toBe('Closed on *Mondays*.')
  })

  it('múltiples días cerrados, ordenados', () => {
    expect(formatClosedDays([1, 3], 'es')).toBe('Cerrado los *lunes y miércoles*.')
    expect(formatClosedDays([3, 1], 'es')).toBe('Cerrado los *lunes y miércoles*.')
  })
})

describe('isPromotionActive', () => {
  const base = { active: true, startDate: null, endDate: null }

  it('promoción sin fechas y activa → true', () => {
    expect(isPromotionActive(base, '2026-06-01')).toBe(true)
  })

  it('promoción inactiva → false', () => {
    expect(isPromotionActive({ ...base, active: false }, '2026-06-01')).toBe(false)
  })

  it('antes de startDate → false', () => {
    expect(isPromotionActive({ ...base, startDate: '2026-07-01' }, '2026-06-01')).toBe(false)
  })

  it('después de endDate → false', () => {
    expect(isPromotionActive({ ...base, endDate: '2026-05-31' }, '2026-06-01')).toBe(false)
  })

  it('dentro del rango → true', () => {
    expect(isPromotionActive({ ...base, startDate: '2026-05-01', endDate: '2026-06-30' }, '2026-06-01')).toBe(true)
  })
})
