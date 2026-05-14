import { addDays, format } from 'date-fns'

/** ¿La fecha `iso` ('yyyy-MM-dd') cae en un día sin paseos? */
export function isDateClosed(
  iso: string,
  closedWeekdays: number[],
  closedDates: string[],
): boolean {
  const d = new Date(iso + 'T00:00:00')
  return closedWeekdays.includes(d.getDay()) || closedDates.includes(iso)
}

/**
 * Devuelve la fecha abierta más cercana a partir de `fromIso` (incluyéndola si
 * ya está abierta). Si no encuentra ninguna dentro de `maxDays`, regresa `fromIso`.
 */
export function getNearestAvailableDate(
  fromIso: string,
  closedWeekdays: number[],
  closedDates: string[],
  maxDays = 365,
): string {
  const base = new Date(fromIso + 'T00:00:00')
  for (let i = 0; i <= maxDays; i++) {
    const iso = format(addDays(base, i), 'yyyy-MM-dd')
    if (!isDateClosed(iso, closedWeekdays, closedDates)) return iso
  }
  return fromIso
}
