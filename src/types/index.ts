import type { PackageId, PaymentMethod, ReservationStatus } from '@constants/index'

// Re-exports para que los consumidores solo importen desde @app-types/index
export type { PackageId, PaymentMethod, ReservationStatus }

// ─── Desglose por paquete ─────────────────────────────────────────────────

export interface PackageBreakdownItem {
  packageId: PackageId
  adults: number
  adultPrice: number
  youth: number
  youthPrice: number
  /** Solo se usa cuando packageId === 'NINOS' */
  children?: number
  childrenPrice?: number
  total: number
}

// ─── Entidades de dominio ─────────────────────────────────────────────────

export interface Reservation {
  id: string
  contactName: string
  contactPhone: string
  contactEmail: string | null
  date: string           // ISO date string "YYYY-MM-DD"
  time: string           // "HH:mm"
  numberOfPeople: number
  // Desglose por grupo de edad
  adults: number
  youth: number          // 13-17 años (75%)
  children: number       // 3-12 años (50%)
  babies: number         // 1-3 años (gratis)
  totalPassengers: number // adults + youth + children + babies (tripulación real, calculado en DB)
  adultsCost: number
  youthCost: number
  childrenCost: number
  packageId: PackageId
  packageBreakdown: PackageBreakdownItem[] | null
  serviceType: 'individual' | 'grupal'
  subtotal: number
  discount: number
  total: number
  status: ReservationStatus
  paymentMethod: PaymentMethod | null
  paymentId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  reservationId: string
  method: PaymentMethod
  amount: number
  status: 'pendiente' | 'completado' | 'fallido' | 'reembolsado'
  transferenciaReference: string | null
  receiptUrl: string | null
  processedAt: string | null
  createdAt: string
}

export interface User {
  id: string
  email: string
  role: 'admin' | 'vendedor'
  fullName: string
  createdAt: string
}

// ─── DTOs / Forms ─────────────────────────────────────────────────────────

export interface CreateReservationDto {
  contactName: string
  contactPhone: string
  contactEmail?: string
  date: string
  time: string
  numberOfPeople: number
  // Desglose por grupo de edad
  adults: number
  youth: number
  children: number
  babies: number
  adultsCost: number
  youthCost: number
  childrenCost: number
  packageId: PackageId
  packageBreakdown?: PackageBreakdownItem[]
  serviceType: 'individual' | 'grupal'
  notes?: string
}

export interface BusinessSettings {
  closedWeekday: number      // 0=dom … 6=sáb
  activeTimeSlots: string[]  // e.g. ['09:00','11:00','13:00','15:00','17:00']
  boatCapacity: number
  closedDates: string[]      // fechas específicas cerradas 'yyyy-MM-dd'
}

export interface ProcessPaymentDto {
  reservationId: string
  method: PaymentMethod
  /** Número de referencia bancaria, requerido cuando method === 'transferencia' */
  transferenciaReference?: string
  /** Indica que el admin está confirmando la recepción del pago */
  adminConfirm?: boolean
}

// ─── Respuestas API ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ─── Reportes ─────────────────────────────────────────────────────────────

export interface DailyReport {
  date: string
  totalReservations: number
  totalPeople: number
  totalRevenue: number
  byPackage: Record<PackageId, { count: number; revenue: number }>
  byPaymentMethod: Record<string, { count: number; revenue: number }>
  reservations: Reservation[]
}

// ─── UI helpers ──────────────────────────────────────────────────────────

export type Status = 'idle' | 'loading' | 'success' | 'error'

export interface SelectOption<T = string> {
  value: T
  label: string
  disabled?: boolean
}
