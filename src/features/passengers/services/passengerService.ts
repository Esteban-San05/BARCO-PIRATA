import { supabase } from '@lib/supabase'
import type { Passenger, PassengerInput, ManifestStatus, PassengerType } from '@app-types/index'

const mapRow = (row: Record<string, unknown>): Passenger => ({
  id:             row.id             as string,
  reservationId:  row.reservation_id as string,
  fullName:       (row.full_name     as string | null) ?? null,
  age:            (row.age           as number | null) ?? null,
  passengerType:  row.passenger_type as PassengerType,
  position:       row.position       as number,
  createdAt:      row.created_at     as string,
})

const mapStatusRow = (row: Record<string, unknown>): ManifestStatus => ({
  reservationId: row.reservation_id as string,
  date:          row.date           as string,
  time:          row.time           as string,
  required:      Number(row.required),
  filled:        Number(row.filled),
  isComplete:    row.is_complete    as boolean,
})

export const passengerService = {
  /**
   * Lista pasajeros de una reservación.
   *
   * Usa la función SECURITY DEFINER `get_passengers_by_reservation` para
   * que clientes anónimos puedan leer SOLO sus pasajeros (conociendo el UUID),
   * sin que la tabla quede abierta a dumps masivos (fix IDOR — mig 00015).
   */
  async listByReservation(reservationId: string): Promise<Passenger[]> {
    const { data, error } = await supabase.rpc('get_passengers_by_reservation', {
      p_reservation_id: reservationId,
    })

    if (error) throw new Error(error.message)
    return ((data ?? []) as Record<string, unknown>[]).map(mapRow)
  },

  /**
   * Reemplaza la lista completa de pasajeros para una reservación.
   *
   * Llama a la función SECURITY DEFINER `upsert_passengers_for_reservation`,
   * que hace DELETE + INSERT atómico en el servidor, validando que la
   * reservación exista y no esté cancelada (mig 00015).
   */
  async bulkUpsert(reservationId: string, rows: PassengerInput[]): Promise<Passenger[]> {
    const payload = rows.map((r) => ({
      fullName:      r.fullName?.trim() || null,
      age:           r.age ?? null,
      passengerType: r.passengerType,
      position:      r.position,
    }))

    const { data, error } = await supabase.rpc('upsert_passengers_for_reservation', {
      p_reservation_id: reservationId,
      p_passengers:     payload,
    })

    if (error) throw new Error(error.message)
    return ((data ?? []) as Record<string, unknown>[]).map(mapRow)
  },

  /** Estado del manifiesto para todas las reservaciones de una fecha (admin). */
  async getManifestStatusByDate(date: string): Promise<ManifestStatus[]> {
    const { data, error } = await supabase
      .from('reservation_manifest_status')
      .select('*')
      .eq('date', date)

    if (error) throw new Error(error.message)
    return (data as Record<string, unknown>[]).map(mapStatusRow)
  },

  /**
   * Estado del manifiesto de una reservación específica.
   *
   * Usa la función SECURITY DEFINER `get_manifest_status_by_reservation`
   * para soportar acceso anónimo sin abrir la vista a dumps masivos.
   */
  async getManifestStatus(reservationId: string): Promise<ManifestStatus | null> {
    const { data, error } = await supabase.rpc('get_manifest_status_by_reservation', {
      p_reservation_id: reservationId,
    })

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Record<string, unknown>[]
    if (rows.length === 0) return null
    return mapStatusRow(rows[0])
  },

  /**
   * Lista todos los pasajeros de una fecha (para ManifiestosPage, ADMIN).
   * Requiere sesión authenticated — usa acceso directo gracias a RLS.
   */
  async listByDate(date: string): Promise<Array<Passenger & { reservationTime: string; contactName: string }>> {
    // 1. Reservaciones activas del día
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id, time, contact_name')
      .eq('date', date)
      .neq('status', 'cancelada')

    if (resError) throw new Error(resError.message)
    if (!reservations || reservations.length === 0) return []

    const ids = (reservations as Record<string, unknown>[]).map(r => r.id as string)
    const resMap: Record<string, { time: string; contactName: string }> = {}
    for (const r of reservations as Record<string, unknown>[]) {
      resMap[r.id as string] = { time: r.time as string, contactName: r.contact_name as string }
    }

    // 2. Pasajeros de esas reservaciones
    const { data, error } = await supabase
      .from('reservation_passengers')
      .select('*')
      .in('reservation_id', ids)
      .order('position', { ascending: true })

    if (error) throw new Error(error.message)

    return ((data ?? []) as Record<string, unknown>[])
      .map((row) => ({
        ...mapRow(row),
        reservationTime: resMap[row.reservation_id as string]?.time        ?? '',
        contactName:     resMap[row.reservation_id as string]?.contactName ?? '',
      }))
      .sort((a, b) =>
        a.reservationTime.localeCompare(b.reservationTime) || a.position - b.position,
      )
  },
}
