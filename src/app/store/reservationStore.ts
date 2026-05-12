import { create } from 'zustand'

const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
import type { Reservation } from '@app-types/index'
import type { PackageId } from '@constants/index'

export interface PkgBreakdownItem {
  packageId: PackageId
  label: string
  icon: string
  adults: number
  adultPrice: number
  youth: number
  youthPrice: number
  total: number
}

export interface PkgBreakdown {
  packages: PkgBreakdownItem[]
  children: number
  childrenCost: number
  babies: number
}

interface ReservationStore {
  /** Reservación recién creada (para flujo de confirmación) */
  pendingReservation: Reservation | null
  setPendingReservation: (r: Reservation | null) => void

  /** Desglose por paquete para mostrar en la confirmación (session-only, no se persiste) */
  pkgBreakdown: PkgBreakdown | null
  setPkgBreakdown: (b: PkgBreakdown | null) => void

  /** Fecha seleccionada en el filtro del dashboard */
  selectedDate: string
  setSelectedDate: (date: string) => void
}

export const useReservationStore = create<ReservationStore>((set) => ({
  pendingReservation: null,
  setPendingReservation: (r) => set({ pendingReservation: r }),

  pkgBreakdown: null,
  setPkgBreakdown: (b) => set({ pkgBreakdown: b }),

  selectedDate: localDateStr(new Date()),
  setSelectedDate: (date) => set({ selectedDate: date }),
}))
