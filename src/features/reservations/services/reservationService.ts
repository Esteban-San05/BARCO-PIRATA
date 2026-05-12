import { supabase } from '@lib/supabase'
import type { Reservation, CreateReservationDto, PackageBreakdownItem, PaginatedResponse } from '@app-types/index'
import { sanitizeObject, sanitizePhone } from '@utils/security'
import { PACKAGES, CHILDREN_PRICE } from '@constants/index'
import type { PackageId, PaymentMethod } from '@constants/index'

/** Mapa de columnas snake_case → camelCase */
const mapRow = (row: Record<string, unknown>): Reservation => ({
  id: row.id as string,
  contactName: row.contact_name as string,
  contactPhone: row.contact_phone as string,
  contactEmail: (row.contact_email as string | null) ?? null,
  date: row.date as string,
  time: row.time as string,
  numberOfPeople: row.number_of_people as number,
  adults:       (row.adults       as number) ?? 0,
  youth:        (row.youth        as number) ?? 0,
  children:     (row.children     as number) ?? 0,
  babies:       (row.babies       as number) ?? 0,
  totalPassengers: (row.total_passengers as number) ?? ((row.adults as number ?? 0) + (row.youth as number ?? 0) + (row.children as number ?? 0) + (row.babies as number ?? 0)),
  adultsCost:   (row.adults_cost   as number) ?? 0,
  youthCost:    (row.youth_cost    as number) ?? 0,
  childrenCost: (row.children_cost as number) ?? 0,
  packageId: row.package_id as PackageId,
  packageBreakdown: (row.package_breakdown as PackageBreakdownItem[] | null) ?? null,
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

    const adultsCost   = clean.adultsCost   ?? 0
    const youthCost    = clean.youthCost    ?? 0
    const childrenCost = clean.childrenCost ?? 0
    const subtotal     = adultsCost + youthCost + childrenCost

    const { data, error } = await supabase
      .from('reservations')
      .insert({
        contact_name:      clean.contactName,
        contact_phone:     sanitizePhone(clean.contactPhone),
        contact_email:     clean.contactEmail?.trim().toLowerCase() ?? null,
        date:              clean.date,
        time:              clean.time,
        number_of_people:  clean.numberOfPeople,
        adults:            clean.adults   ?? clean.numberOfPeople,
        youth:             clean.youth    ?? 0,
        children:          clean.children ?? 0,
        babies:            clean.babies   ?? 0,
        adults_cost:       adultsCost,
        youth_cost:        youthCost,
        children_cost:     childrenCost,
        package_id:        clean.packageId,
        package_breakdown: clean.packageBreakdown?.length ? clean.packageBreakdown : null,
        service_type:      clean.numberOfPeople >= 10 ? 'grupal' : 'individual',
        subtotal,
        discount:          0,
        total:             subtotal,
        status:            'pendiente',
        notes:             clean.notes ?? null,
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

  /** Actualiza fecha, hora, tripulación y paquete. Recalcula totales. */
  async update(
    id: string,
    dto: {
      date: string
      time: string
      packageId: PackageId
      packageBreakdown?: PackageBreakdownItem[]
      adults: number
      youth: number
      children: number
      babies: number
      adultsCost: number
      youthCost: number
      childrenCost: number
      numberOfPeople: number
      subtotal: number
      total: number
      serviceType: 'individual' | 'grupal'
    },
  ): Promise<Reservation> {
    const { data, error } = await supabase
      .from('reservations')
      .update({
        date:              dto.date,
        time:              dto.time,
        package_id:        dto.packageId,
        package_breakdown: dto.packageBreakdown?.length ? dto.packageBreakdown : null,
        adults:            dto.adults,
        youth:             dto.youth,
        children:          dto.children,
        babies:            dto.babies,
        adults_cost:       dto.adultsCost,
        youth_cost:        dto.youthCost,
        children_cost:     dto.childrenCost,
        number_of_people:  dto.numberOfPeople,
        subtotal:          dto.subtotal,
        discount:          0,
        total:             dto.total,
        service_type:      dto.serviceType,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  },

  /** Crea una reservación desde admin (walk-in): sin rate limit, sin fecha mínima de anticipación. */
  async adminCreate(
    dto: CreateReservationDto & {
      initialStatus?: Reservation['status']
      paymentMethod?: PaymentMethod
    },
  ): Promise<Reservation> {
    const clean = sanitizeObject(dto) as typeof dto

    const pkg          = PACKAGES[clean.packageId as PackageId]
    const adults       = clean.adults   ?? 0
    const youth        = clean.youth    ?? 0
    const children     = clean.children ?? 0
    const babies       = clean.babies   ?? 0
    const totalPax     = adults + youth + children + babies

    const adultsCost   = clean.adultsCost   ?? adults   * pkg.adultPrice
    const youthCost    = clean.youthCost    ?? youth    * pkg.youthPrice
    const childrenCost = clean.childrenCost ?? children * CHILDREN_PRICE
    const subtotal     = adultsCost + youthCost + childrenCost

    const status = clean.initialStatus ?? 'pendiente'

    const { data, error } = await supabase
      .from('reservations')
      .insert({
        contact_name:      clean.contactName,
        contact_phone:     sanitizePhone(clean.contactPhone),
        contact_email:     clean.contactEmail?.trim().toLowerCase() ?? null,
        date:              clean.date,
        time:              clean.time,
        number_of_people:  totalPax,
        adults,
        youth,
        children,
        babies,
        adults_cost:       adultsCost,
        youth_cost:        youthCost,
        children_cost:     childrenCost,
        package_id:        clean.packageId,
        package_breakdown: clean.packageBreakdown?.length ? clean.packageBreakdown : null,
        service_type:      totalPax >= 10 ? 'grupal' : 'individual',
        subtotal,
        discount:          0,
        total:             subtotal,
        status,
        payment_method:    status === 'pagada' ? (clean.paymentMethod ?? null) : null,
        notes:             clean.notes ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  },

  async cancel(id: string): Promise<Reservation> {
    const { data, error } = await supabase
      .from('reservations')
      .update({ status: 'cancelada' })
      .eq('id', id)
      .neq('status', 'cancelada') // idempotente: no actualiza si ya está cancelada
      .select()
      .maybeSingle() // devuelve null si ya estaba cancelada (0 filas), sin lanzar error

    if (error) throw new Error(error.message)

    // Si data es null, la reservación ya estaba cancelada → la devolvemos tal cual
    if (!data) {
      const { data: existing, error: fetchError } = await supabase
        .from('reservations')
        .select()
        .eq('id', id)
        .single()
      if (fetchError) throw new Error(fetchError.message)
      return mapRow(existing as Record<string, unknown>)
    }

    return mapRow(data as Record<string, unknown>)
  },
}
