import { PACKAGES } from '@constants/index'
import type { PackageId } from '@constants/index'

export interface PricingResult {
  subtotal: number
  discount: number
  total: number
  pricePerPerson: number
  hasGroupDiscount: boolean
}

export const calculatePrice = (
  packageId: PackageId,
  numberOfPeople: number
): PricingResult => {
  const pkg = PACKAGES[packageId]
  const pricePerPerson = pkg.pricePerPerson
  const subtotal = pricePerPerson * numberOfPeople
  // Descuentos grupales eliminados
  const discount = 0
  const total = subtotal

  return { subtotal, discount, total, pricePerPerson, hasGroupDiscount: false }
}
