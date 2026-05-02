import { supabase } from '@lib/supabase'
import type { Reservation, CreateReservationDto, PaginatedResponse } from '@app-types/index'
import { sanitizeObject } from '@utils/security'
import { calculatePrice } from '@utils/pricing'
import type { PackageId } from '@constants/index'

/** Mapa de columnas snake_case → camelCase */
const mapRow = (row: Record<string, unknown>): Reservation => ({
  id: row.id as string,
  contactName: row.contact_name as string,
  contactPhone: row.contact_phone as string,
  contactEmail: (row.contact_email as string | null) ?? null,
  date: row.date as string,
  time: row.time as string,
  numberOfPeople: row.number_of_people as number,
  packageId: row.package_id as PackageId,
  serviceType: row.service_type as 'individual' | 'grupal',
  subtotal: row.subtotal as number,
  discount: row.discount as number,
  total: row.total as number,
  status: row.status as Reservation['status'],
  paymentMethod: row.payment_method as Reservation['paymentMethod'],
  paymentId: row.payment_id as string | null,
  notes: row.notes as string | null,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
})

export const reservationService = {
  async create(dto: CreateReservationDto): Promise<Reservation> {
    const clean = sanitizeObject(dto)

    // Rate limiting: máximo 3 reservaciones por teléfono en la última hora
    const { data: allowed, error: rlError } = await supabase
      .rpc('check_phone_rate_limit', { p_phone: clean.contactPhone })
    if (rlError) console.warn('[reservationService] rate limit check failed:', rlError.message)
    if (allowed === false) {
      throw new Error('Has excedido el límite de reservaciones. Intenta de nuevo en una hora.')
    }

    const pricing = calculatePrice(clean.packageId as PackageId, clean.numberOfPeople)

    const { data, error } = await supabase
      .from('reservations')
      .insert({
        contact_name:     clean.contactName,
        contact_phone:    clean.contactPhone,
        contact_email:    clean.contactEmail?.trim().toLowerCase() ?? null,
        date:             clean.date,
        time:             clean.time,
        number_of_people: clean.numberOfPeople,
        package_id:       clean.packageId,
        service_type:     clean.numberOfPeople >= 5 ? 'grupal' : 'individual',
        subtotal:         pricing.subtotal,
        discount:         pricing.discount,
        total:            pricing.total,
        status:           'pendiente',
        notes:            clean.notes ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  },

  async getById(id: string): Promise<Reservation> {
    const { data, error } = await supabase
      .rpc('get_reservation_by_id', { p_id: id })
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  },

  async listByDate(date: string, page = 1, pageSize = 20): Promise<PaginatedResponse<Reservation>> {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from('reservations')
      .select('*', { count: 'exact' })
      .eq('date', date)
      .order('time', { ascending: true })
      .range(from, to)

    if (error) throw new Error(error.message)
    return {
      data: (data as Record<string, unknown>[]).map(mapRow),
      total: count ?? 0,
      page,
      pageSize,
    }
  },

  /** Guarda el correo del cliente en la reservación (se captura al pagar). */
  async updateEmail(id: string, email: string): Promise<Reservation> {
    const { data, error } = await supabase
      .from('reservations')
      .update({ contact_email: email.trim().toLowerCase() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  },

  async updateStatus(
    id: string,
    status: Reservation['status'],
    paymentMethod?: Reservation['paymentMethod'],
    paymentId?: string
  ): Promise<Reservation> {
    const { data, error } = await supabase
      .from('reservations')
      .update({
        status,
        ...(paymentMethod && { payment_method: paymentMethod }),
        ...(paymentId && { payment_id: paymentId }),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  },
}
