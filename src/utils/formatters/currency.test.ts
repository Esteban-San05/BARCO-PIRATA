import { describe, it, expect } from 'vitest'
import { formatCurrency, formatCurrencyCompact } from './currency'

describe('formatCurrency', () => {
  it('formatea enteros en MXN sin decimales', () => {
    const result = formatCurrency(250)
    expect(result).toContain('250')
    expect(result).toMatch(/\$|MXN/)
  })

  it('formatea cantidades grandes correctamente', () => {
    const result = formatCurrency(9000)
    expect(result).toContain('9')
    expect(result).toContain('000')
  })

  it('formatea cero', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0')
  })

  it('no incluye decimales para números enteros', () => {
    const result = formatCurrency(450)
    expect(result).not.toMatch(/\.\d{2}/)
  })
})

describe('formatCurrencyCompact', () => {
  it('formatea valores grandes de forma compacta', () => {
    const result = formatCurrencyCompact(10000)
    // Debe usar notación compacta (k, mil, etc.)
    expect(result.length).toBeLessThan(formatCurrency(10000).length)
  })

  it('formatea cantidades pequeñas', () => {
    const result = formatCurrencyCompact(250)
    expect(result).toContain('250')
  })
})
