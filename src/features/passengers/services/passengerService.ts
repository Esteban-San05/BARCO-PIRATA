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
  async listByReservation(reservationId: string): Promise<Passenger[]> {
    const { data, error } = await supabase
      .from('reservation_passengers')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('position', { ascending: true })

    if (error) throw new Error(error.message)
    return (data as Record<string, unknown>[]).map(mapRow)
  },

  /**
   * Reemplaza la lista completa de pasajeros para una reservación.
   * Hace DELETE de las filas existentes e INSERT de las nuevas en una sola transacción.
   */
  async bulkUpsert(reservationId: string, rows: PassengerInput[]): Promise<Passenger[]> {
    // DELETE existentes (requiere rol authenticated o policy anon_delete si se añade)
    const { error: deleteError } = await supabase
      .from('reservation_passengers')
      .delete()
      .eq('reservation_id', reservationId)

    if (deleteError) throw new Error(deleteError.message)

    if (rows.length === 0) return []

    const inserts = rows.map((r) => ({
      reservation_id: reservationId,
      full_name:      r.fullName?.trim() || null,
      age:            r.age ?? null,
      passenger_type: r.passengerType,
      position:       r.position,
    }))

    const { data, error } = await supabase
      .from('reservation_passengers')
      .insert(inserts)
      .select()

    if (error) throw new Error(error.message)
    return (data as Record<string, unknown>[]).map(mapRow)
  },

  /** Estado del manifiesto para todas las reservaciones de una fecha. */
  async getManifestStatusByDate(date: string): Promise<ManifestStatus[]> {
    const { data, error } = await supabase
      .from('reservation_manifest_status')
      .select('*')
      .eq('date', date)

    if (error) throw new Error(error.message)
    return (data as Record<string, unknown>[]).map(mapStatusRow)
  },

  /** Estado del manifiesto de una reservación específica. */
  async getManifestStatus(reservationId: string): Promise<ManifestStatus | null> {
    const { data, error } = await supabase
      .from('reservation_manifest_status')
      .select('*')
      .eq('reservation_id', reservationId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return null
    return mapStatusRow(data as Record<string, unknown>)
  },

  /**
   * Lista todos los pasajeros de una fecha (para ManifiestosPage).
   * Join con reservations para obtener el horario.
   */
  async listByDate(date: string): Promise<Array<Passenger & { reservationTime: string; contactName: string }>> {
    const { data, error } = await supabase
      .from('reservation_passengers')
      .select(`
        *,
        reservations!inner(date, time, contact_name)
      `)
      .eq('reservations.date', date)
      .order('reservations.time', { ascending: true })
      .order('position',          { ascending: true })

    if (error) throw new Error(error.message)

    return (data as Record<string, unknown>[]).map((row) => {
      const res = row.reservations as Record<string, unknown>
      return {
        ...mapRow(row),
        reservationTime: res.time        as string,
        contactName:     res.contact_name as string,
      }
    })
  },
}
