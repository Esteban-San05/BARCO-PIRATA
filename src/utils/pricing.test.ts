import { describe, it, expect } from 'vitest'
import { calculatePrice } from './pricing'

describe('calculatePrice', () => {
  it('calcula precio base sin descuento (menos de 5 personas)', () => {
    const result = calculatePrice('CON_COMIDA', 2)
    expect(result.pricePerPerson).toBe(450)
    expect(result.subtotal).toBe(900)
    expect(result.discount).toBe(0)
    expect(result.total).toBe(900)
    expect(result.hasGroupDiscount).toBe(false)
  })

  it('aplica descuento grupal con exactamente 5 personas', () => {
    const result = calculatePrice('CON_COMIDA', 5)
    expect(result.subtotal).toBe(2250)
    expect(result.discount).toBe(225)   // 10%
    expect(result.total).toBe(2025)
    expect(result.hasGroupDiscount).toBe(true)
  })

  it('aplica descuento grupal con más de 5 personas', () => {
    const result = calculatePrice('SOLO_BEBIDAS', 10)
    expect(result.subtotal).toBe(3500)
    expect(result.discount).toBe(350)
    expect(result.total).toBe(3150)
    expect(result.hasGroupDiscount).toBe(true)
  })

  it('precio correcto para SOLO_PASEO (1 persona)', () => {
    const result = calculatePrice('SOLO_PASEO', 1)
    expect(result.pricePerPerson).toBe(250)
    expect(result.subtotal).toBe(250)
    expect(result.discount).toBe(0)
    expect(result.total).toBe(250)
  })

  it('precio correcto para SOLO_BEBIDAS sin descuento', () => {
    const result = calculatePrice('SOLO_BEBIDAS', 4)
    expect(result.pricePerPerson).toBe(350)
    expect(result.subtotal).toBe(1400)
    expect(result.discount).toBe(0)
    expect(result.total).toBe(1400)
  })

  it('capacidad máxima del barco (40 personas)', () => {
    const result = calculatePrice('SOLO_PASEO', 40)
    expect(result.subtotal).toBe(10000)
    expect(result.discount).toBe(1000)
    expect(result.total).toBe(9000)
    expect(result.hasGroupDiscount).toBe(true)
  })

  it('total = subtotal - descuento siempre', () => {
    const cases: Array<[typeof import('@constants/index').PACKAGES[keyof typeof import('@constants/index').PACKAGES]['id'] extends string ? never : 'CON_COMIDA' | 'SOLO_BEBIDAS' | 'SOLO_PASEO', number]> = [
      ['CON_COMIDA', 1], ['CON_COMIDA', 5], ['SOLO_BEBIDAS', 3],
      ['SOLO_BEBIDAS', 8], ['SOLO_PASEO', 2], ['SOLO_PASEO', 15],
    ]
    for (const [pkg, people] of cases) {
      const r = calculatePrice(pkg, people)
      expect(r.total).toBe(r.subtotal - r.discount)
    }
  })
})
