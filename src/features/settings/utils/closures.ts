import type { CapacityFullSlot } from '@app-types/index'

/** Verifica si un slot (fecha+hora) está marcado como cupo lleno por admin. */
export function isSlotMarkedFull(
  slots: CapacityFullSlot[] | undefined,
  date: string,
  time: string,
): boolean {
  if (!slots?.length) return false
  return slots.some((s) => s.date === date && s.time === time)
}

/** Devuelve los slots llenos para una fecha específica. */
export function fullSlotsForDate(
  slots: CapacityFullSlot[] | undefined,
  date: string,
): string[] {
  if (!slots?.length) return []
  return slots.filter((s) => s.date === date).map((s) => s.time)
}

/** Elimina slots cuyo date sea anterior a `today` (limpieza opcional). */
export function pruneOldFullSlots(
  slots: CapacityFullSlot[],
  today: string,
): CapacityFullSlot[] {
  return slots.filter((s) => s.date >= today)
}
