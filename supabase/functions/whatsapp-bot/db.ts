// ─── db.ts ────────────────────────────────────────────────────────────────────
// Helpers para acceso directo a Supabase desde la Edge Function del chatbot.
// Usa service_role key para poder actualizar sin restricciones de RLS.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Tipos locales ────────────────────────────────────────────────────────────
export interface Reservation {
  id: string
  contact_name: string
  contact_phone: string
  date: string          // YYYY-MM-DD
  time: string          // HH:MM:SS
  number_of_people: number
  package_id: string    // 'con_comida' | 'solo_bebidas' | 'solo_paseo'
  service_type: string
  subtotal: number
  discount: number
  total: number
  status: ReservationStatus
  notes: string | null
  created_at: string
}

export type ReservationStatus = 'pendiente' | 'confirmada' | 'pagada' | 'cancelada'

export interface BusinessSettings {
  closed_weekdays: number[]
  active_time_slots: string[]
  boat_capacity: number
  closed_dates: string[]
}

// ─── Estado de sesión persistido en Supabase ──────────────────────────────────
export interface BotSession {
  phone: string
  lang: 'es' | 'en'
  awaiting_cancel_confirm: boolean
  message_count: number
  window_start: string    // ISO timestamp
  last_seen: string
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
const RATE_LIMIT_MAX      = 20   // mensajes máximos por ventana
const RATE_LIMIT_WINDOW_S = 60   // ventana en segundos

// ─── Cliente (service_role) ───────────────────────────────────────────────────
function getAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

// ─── Normalizar teléfono ──────────────────────────────────────────────────────
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('521')) return `52${digits.slice(3)}`
  if (digits.startsWith('52')) return digits
  if (digits.length === 10) return `52${digits}`
  return digits
}

// ─── Sesiones ─────────────────────────────────────────────────────────────────

/** Lee la sesión del cliente. Si no existe la crea con valores por defecto. */
export async function getSession(phone: string): Promise<BotSession> {
  const supabase = getAdminClient()
  const normalized = normalizePhone(phone)

  const { data } = await supabase
    .from('bot_sessions')
    .select('*')
    .eq('phone', normalized)
    .maybeSingle()

  if (data) return data as BotSession

  // Primera vez — crear sesión
  const newSession: BotSession = {
    phone: normalized,
    lang: 'es',
    awaiting_cancel_confirm: false,
    message_count: 0,
    window_start: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  }

  await supabase.from('bot_sessions').insert(newSession)
  return newSession
}

/** Actualiza campos de la sesión. */
export async function updateSession(
  phone: string,
  patch: Partial<Omit<BotSession, 'phone'>>,
): Promise<void> {
  const supabase = getAdminClient()
  await supabase
    .from('bot_sessions')
    .update({ ...patch, last_seen: new Date().toISOString() })
    .eq('phone', normalizePhone(phone))
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

/**
 * Comprueba si el número ha superado el límite de mensajes.
 * Actualiza el contador automáticamente.
 * @returns true si se debe bloquear el mensaje (rate limit alcanzado)
 */
export async function isRateLimited(phone: string): Promise<boolean> {
  const session = await getSession(phone)
  const now = Date.now()
  const windowStart = new Date(session.window_start).getTime()
  const elapsed = (now - windowStart) / 1000

  if (elapsed > RATE_LIMIT_WINDOW_S) {
    // Ventana expirada — resetear contador
    await updateSession(phone, {
      message_count: 1,
      window_start: new Date().toISOString(),
    })
    return false
  }

  const newCount = session.message_count + 1

  if (newCount > RATE_LIMIT_MAX) {
    // Actualizar last_seen pero no incrementar más el contador
    await updateSession(phone, {})

    // Registrar alerta en audit_log para que el admin lo vea en el panel
    // Solo lo registramos la primera vez que se supera (newCount === RATE_LIMIT_MAX + 1)
    if (newCount === RATE_LIMIT_MAX + 1) {
      await logRateLimitAlert(normalizePhone(phone))
    }

    return true
  }

  await updateSession(phone, { message_count: newCount })
  return false
}

/** Inserta un evento RATE_LIMIT en audit_log para notificar al admin. */
async function logRateLimitAlert(phone: string): Promise<void> {
  const supabase = getAdminClient()
  await supabase.from('audit_log').insert({
    action:     'RATE_LIMIT',
    table_name: 'bot_sessions',
    user_email: null,
    // Guardamos el número en ip_address (campo genérico disponible en audit_log)
    ip_address: phone,
    new_values: {
      phone,
      limit:   RATE_LIMIT_MAX,
      window_s: RATE_LIMIT_WINDOW_S,
      blocked_at: new Date().toISOString(),
    },
  }).then(({ error }) => {
    if (error) console.error('[whatsapp-bot] Error al registrar RATE_LIMIT en audit_log:', error)
  })
}

// ─── Buscar reservación activa por teléfono ───────────────────────────────────
export async function getReservationByPhone(phone: string): Promise<Reservation | null> {
  const supabase = getAdminClient()
  const digits = normalizePhone(phone).slice(-10) // últimos 10 dígitos

  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .neq('status', 'cancelada')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !data) return null

  const match = data.find((r: Reservation) => {
    const stored = r.contact_phone.replace(/\D/g, '').slice(-10)
    return stored === digits
  })

  return match ?? null
}

// ─── Actualizar estado de reservación ────────────────────────────────────────
export async function updateReservationStatus(
  reservationId: string,
  status: ReservationStatus,
  notes?: string,
): Promise<boolean> {
  const supabase = getAdminClient()

  const payload: Partial<Reservation> & { updated_at?: string } = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (notes !== undefined) payload.notes = notes

  const { error } = await supabase
    .from('reservations')
    .update(payload)
    .eq('id', reservationId)

  return !error
}

export async function confirmReservation(reservationId: string): Promise<boolean> {
  return updateReservationStatus(reservationId, 'confirmada')
}

/** Registra solicitud de cancelación. El admin decide si procede. */
export async function requestCancellation(
  reservationId: string,
  reason: string,
): Promise<boolean> {
  // Sanitizar: solo texto plano, máx 300 chars, sin saltos de línea dobles
  const safeReason = reason
    .replace(/[<>]/g, '')           // quitar < > por si acaso
    .replace(/\n{2,}/g, '\n')       // colapsar saltos múltiples
    .trim()
    .slice(0, 300)

  return updateReservationStatus(
    reservationId,
    'pendiente',
    `[CANCELACIÓN SOLICITADA VÍA WHATSAPP] ${safeReason}`,
  )
}

export async function getBusinessSettings(): Promise<BusinessSettings | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .order('id', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return null
  return data as BusinessSettings
}
