// Edge Function: create-payment-intent
// Deploy: supabase functions deploy create-payment-intent
//
// Esta función se ejecuta en el servidor (Deno runtime) con la secret key de
// Stripe. El frontend NUNCA debe tener acceso a la secret key.
//
// NOTA: el negocio actualmente cobra solo en el muelle (efectivo/transferencia).
// Esta función queda como hook para reactivar pagos en línea cuando se decida.
// Mientras no se use, considera eliminar el deploy.

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

// ── CORS restringido ──────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? ''
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin), 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(origin) })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado' }, 401, origin)

    // Cliente Supabase autenticado con el JWT del usuario
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { reservationId } = await req.json()
    if (!reservationId || typeof reservationId !== 'string') {
      return json({ error: 'reservationId es requerido' }, 400, origin)
    }

    // Busca la reservación y valida monto desde el servidor (nunca confiar en el cliente)
    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('id, total, status, contact_name')
      .eq('id', reservationId)
      .single()

    if (error || !reservation) return json({ error: 'Reservación no encontrada' }, 404, origin)
    if (reservation.status === 'pagada') return json({ error: 'Ya está pagada' }, 400, origin)

    const totalNumber = Number(reservation.total)
    if (!Number.isFinite(totalNumber) || totalNumber <= 0) {
      return json({ error: 'Monto inválido' }, 400, origin)
    }

    // Crea el PaymentIntent (monto en centavos)
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(totalNumber * 100),
      currency: 'mxn',
      automatic_payment_methods: { enabled: true },
      metadata: {
        reservationId: reservation.id,
        customerName: reservation.contact_name,
      },
    })

    return json({ clientSecret: intent.client_secret }, 200, origin)
  } catch (err) {
    console.error('[create-payment-intent]', err)
    return json({ error: 'Error interno del servidor' }, 500, origin)
  }
})
