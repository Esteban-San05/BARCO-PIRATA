import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mockear i18n antes de importar el validador (usa i18n.t en buildReservationSchema)
vi.mock('@lib/i18n', () => ({
  default: { t: (key: string) => key },
}))

import { getReservationSchema } from './reservation'

const today = new Date()
const todayISO = today.toISOString().split('T')[0]
const futureISO = new Date(Date.now() + 10 * 86400_000).toISOString().split('T')[0]
const pastISO   = new Date(Date.now() - 1  * 86400_000).toISOString().split('T')[0]

const valid = {
  contactName:   'Juan Perez',
  contactPhone:  '6380001234',
  contactEmail:  'juan@example.com',
  date:          futureISO,
  time:          '09:00' as const,
  numberOfPeople: 2,
  packageId:     'SOLO_PASEO' as const,
  serviceType:   'individual' as const,
}

describe('getReservationSchema – datos válidos', () => {
  it('acepta una reserva completa correcta', () => {
    const result = getReservationSchema().safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('acepta con formato de teléfono +52', () => {
    const result = getReservationSchema().safeParse({ ...valid, contactPhone: '+526380001234' })
    expect(result.success).toBe(true)
  })

  it('acepta notes vacío (campo opcional)', () => {
    const result = getReservationSchema().safeParse({ ...valid, notes: undefined })
    expect(result.success).toBe(true)
  })

  it('acepta reserva grupal (5+ personas)', () => {
    const result = getReservationSchema().safeParse({ ...valid, numberOfPeople: 5, serviceType: 'grupal' })
    expect(result.success).toBe(true)
  })
})

describe('getReservationSchema – datos inválidos', () => {
  it('rechaza nombre demasiado corto', () => {
    const r = getReservationSchema().safeParse({ ...valid, contactName: 'AB' })
    expect(r.success).toBe(false)
  })

  it('rechaza nombre con números', () => {
    const r = getReservationSchema().safeParse({ ...valid, contactName: 'Juan123' })
    expect(r.success).toBe(false)
  })

  it('rechaza teléfono inválido', () => {
    const r = getReservationSchema().safeParse({ ...valid, contactPhone: '12345' })
    expect(r.success).toBe(false)
  })

  it('rechaza email malformado', () => {
    const r = getReservationSchema().safeParse({ ...valid, contactEmail: 'no-es-un-email' })
    expect(r.success).toBe(false)
  })

  it('rechaza email vacío', () => {
    const r = getReservationSchema().safeParse({ ...valid, contactEmail: '' })
    expect(r.success).toBe(false)
  })

  it('rechaza fecha pasada', () => {
    const r = getReservationSchema().safeParse({ ...valid, date: pastISO })
    expect(r.success).toBe(false)
  })

  it('rechaza horario no permitido', () => {
    const r = getReservationSchema().safeParse({ ...valid, time: '10:00' })
    expect(r.success).toBe(false)
  })

  it('rechaza 0 personas', () => {
    const r = getReservationSchema().safeParse({ ...valid, numberOfPeople: 0 })
    expect(r.success).toBe(false)
  })

  it('rechaza más de 40 personas', () => {
    const r = getReservationSchema().safeParse({ ...valid, numberOfPeople: 41 })
    expect(r.success).toBe(false)
  })

  it('rechaza paquete desconocido', () => {
    const r = getReservationSchema().safeParse({ ...valid, packageId: 'PAQUETE_INEXISTENTE' })
    expect(r.success).toBe(false)
  })
})
