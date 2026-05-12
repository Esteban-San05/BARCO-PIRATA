import { supabase } from '@lib/supabase'
import type { Payment, ProcessPaymentDto } from '@app-types/index'

export const paymentService = {
  /**
   * Registra un pago completado (efectivo o transferencia confirmada por admin).
   */
  async recordPayment(dto: ProcessPaymentDto): Promise<Payment> {
    const payload = {
      reservation_id: dto.reservationId,
      method: dto.method,
      amount: 0,
      status: dto.adminConfirm ? 'completado' : 'pendiente',
      transferencia_reference: dto.transferenciaReference ?? null,
    }

    // Intentar INSERT con SELECT inline
    const { data, error } = await supabase
      .from('payments')
      .insert(payload)
      .select()
      .single()

    if (error && error.code !== 'PGRST116') throw new Error(error.message)

    // Si el SELECT inline falló por RLS, recuperar el registro recién creado por separado
    const row: Record<string, unknown> = data
      ?? await (async () => {
        const { data: fetched, error: fetchError } = await supabase
          .from('payments')
          .select('*')
          .eq('reservation_id', dto.reservationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (fetchError) throw new Error(fetchError.message)
        return fetched as Record<string, unknown>
      })()

    if (!row?.id || typeof row.id !== 'string') throw new Error('No se pudo recuperar el registro del pago')

    return {
      id: row.id,
      reservationId: row.reservation_id as string,
      method: row.method as Payment['method'],
      amount: (row.amount as number) ?? 0,
      status: row.status as Payment['status'],
      transferenciaReference: (row.transferencia_reference as string | null) ?? null,
      receiptUrl: (row.receipt_url as string | null) ?? null,
      processedAt: (row.processed_at as string | null) ?? null,
      createdAt: row.created_at as string,
    }
  },

  async getByReservation(reservationId: string): Promise<Payment | null> {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('reservation_id', reservationId)
      .maybeSingle()

    if (!data) return null

    const row = data as Record<string, unknown>
    return {
      id: row.id as string,
      reservationId: row.reservation_id as string,
      method: row.method as Payment['method'],
      amount: row.amount as number,
      status: row.status as Payment['status'],
      transferenciaReference: (row.transferencia_reference as string | null) ?? null,
      receiptUrl: row.receipt_url as string | null,
      processedAt: row.processed_at as string | null,
      createdAt: row.created_at as string,
    }
  },
}
