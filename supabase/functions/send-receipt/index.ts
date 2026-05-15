// ════════════════════════════════════════════════════════════════════════
//   Edge Function: send-receipt
//
//   Envía por correo el comprobante de pago / reservación de un cliente.
//
//   Variables de entorno requeridas (en el proyecto Supabase):
//     SUPABASE_URL              — provista automáticamente
//     SUPABASE_ANON_KEY         — provista automáticamente
//     RESEND_API_KEY            — clave API de https://resend.com
//     RECEIPT_FROM              — "Barco Pirata <noreply@tu-dominio.com>"
//                                 (si usas resend.dev en dev: "onboarding@resend.dev")
//
//   Si RESEND_API_KEY no está configurada, la función responde con
//   { sent: false, simulated: true } — útil para que el front muestre el
//   flujo completo mientras se termina de configurar el proveedor real.
//
//   Deploy:
//     supabase functions deploy send-receipt --no-verify-jwt
//     (--no-verify-jwt es necesario para que clientes anónimos reciban su
//      propio recibo sin sesión activa. La autorización se hace a nivel de
//      aplicación: se valida que el email destino coincida con el registrado
//      en la reserva, o que el llamante sea staff autenticado.)
// ════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CORS: restringido a orígenes permitidos vía ALLOWED_ORIGINS env ────────
// Ejemplo: ALLOWED_ORIGINS="https://barco-pirata.com,http://localhost:3000"
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

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin), 'Content-Type': 'application/json' },
  })
}

const PACKAGE_LABELS: Record<string, string> = {
  CON_COMIDA:   'Con Comida Incluida',
  SOLO_BEBIDAS: 'Solo Bebidas',
  SOLO_PASEO:   'Solo Paseo',
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;')
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', minimumFractionDigits: 2,
  }).format(n)
}
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function buildHtml(r: Record<string, unknown>): string {
  const total     = Number(r.total ?? 0)
  const subtotal  = Number(r.subtotal ?? 0)
  const discount  = Number(r.discount ?? 0)
  const pkgLabel  = PACKAGE_LABELS[r.package_id as string] ?? (r.package_id as string)
  const isPaid        = r.status === 'pagada'
  const isCashPending = !isPaid && r.payment_method === 'efectivo'
  const methodLbl     = r.payment_method === 'tarjeta' ? 'Tarjeta'
                      : r.payment_method === 'efectivo' ? 'Efectivo'
                      : 'Pendiente'

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Recibo Barco Pirata</title></head>
<body style="margin:0;padding:0;background:#f0f4fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4fa;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0"
        style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(13,32,64,0.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0D2040 0%,#0a1a36 100%);padding:28px 32px;text-align:center;color:#F0B429;">
          <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">Barco Pirata</div>
          <div style="font-size:22px;font-weight:800;color:#F0B429;font-family:Georgia,'Times New Roman',serif;">
            ${isPaid ? '¡Pago exitoso!' : 'Reservación confirmada'}
          </div>
          <div style="font-size:13px;color:#cbd5e1;margin-top:6px;">
            ${isPaid ? 'Guarda este comprobante como respaldo de tu reservación.'
                     : 'Presenta este comprobante el día del paseo.'}
          </div>
        </td></tr>

        <!-- Badge -->
        <tr><td style="padding:20px 32px 0 32px;text-align:center;">
          <span style="display:inline-block;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;
            ${isPaid
              ? 'background:#dcfce7;color:#166534;border:1px solid #86efac;'
              : isCashPending
                ? 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;'
                : 'background:#e0f2fe;color:#075985;border:1px solid #7dd3fc;'}">
            ${isPaid ? '✓ Pagado (' + methodLbl + ')' : isCashPending ? '💵 Por pagar en el lugar' : 'Pendiente de pago'}
          </span>
        </td></tr>

        <!-- Detalles -->
        <tr><td style="padding:24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#0D2040;">
            ${row('Cliente',    r.contact_name)}
            ${row('Teléfono',   r.contact_phone)}
            ${row('Correo',     r.contact_email ?? '—')}
            ${row('Fecha',      formatDate(String(r.date)))}
            ${row('Hora',       String(r.time).slice(0,5))}
            ${row('Personas',   String(r.number_of_people))}
            ${row('Paquete',    pkgLabel)}
          </table>
        </td></tr>

        <!-- Totales -->
        <tr><td style="padding:0 32px 24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
            style="border-top:2px dashed #cbd5e1;padding-top:16px;font-size:14px;color:#0D2040;">
            <tr><td style="color:#64748b;">Subtotal</td>
                <td align="right">${formatCurrency(subtotal)}</td></tr>
            ${discount > 0 ? `
            <tr><td style="color:#b45309;font-weight:600;">Descuento de grupo</td>
                <td align="right" style="color:#b45309;font-weight:600;">-${formatCurrency(discount)}</td></tr>` : ''}
            <tr><td style="font-weight:800;font-size:16px;padding-top:10px;">${isPaid ? 'Total pagado' : 'Total a pagar'}</td>
                <td align="right" style="font-weight:800;font-size:18px;color:#b45309;padding-top:10px;">
                  ${formatCurrency(total)}
                </td></tr>
          </table>
        </td></tr>

        <!-- Folio -->
        <tr><td style="background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:4px;">Folio</div>
          <div style="font-family:'Courier New',monospace;font-size:12px;color:#334155;word-break:break-all;">${escapeHtml(String(r.id ?? ''))}</div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 32px 24px 32px;text-align:center;font-size:12px;color:#94a3b8;">
          ¡Gracias por navegar con nosotros! ⚓<br/>
          Recinto Portuario, Puerto Peñasco, Sonora.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`
}

function row(label: string, value: unknown): string {
  return `<tr>
    <td style="padding:6px 0;color:#64748b;width:35%;">${label}</td>
    <td style="padding:6px 0;font-weight:600;color:#0D2040;" align="right">${escapeHtml(String(value ?? ''))}</td>
  </tr>`
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeadersFor(origin) })

  try {
    const { reservationId, email } = await req.json()
    if (!reservationId || typeof reservationId !== 'string') {
      return json({ error: 'reservationId es requerido' }, 400, origin)
    }
    if (!email || typeof email !== 'string' ||
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: 'email inválido' }, 400, origin)
    }

    // Cliente de servicio para leer la reserva saltando RLS.
    // SERVICE_ROLE es REQUERIDO — no aceptamos fallback a anon, porque RLS
    // bloquearía la lectura y el flujo nunca funcionaría correctamente.
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) {
      console.error('[send-receipt] SUPABASE_SERVICE_ROLE_KEY no configurada')
      return json({ error: 'Configuración del servidor incompleta' }, 500, origin)
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey,
    )

    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single()

    if (error || !reservation) {
      return json({ error: 'Reservación no encontrada' }, 404, origin)
    }

    // ── Autorización ───────────────────────────────────────────────────────
    // Staff autenticado (admin/vendedor): puede enviar a cualquier email.
    // Cliente anónimo: el email destino debe coincidir con el registrado en
    // la reserva para evitar que un tercero con el UUID spamee a quien quiera.
    const authHeader = req.headers.get('Authorization') ?? ''
    let isStaff = false

    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        isStaff = profile?.role === 'admin' || profile?.role === 'vendedor'
      }
    }

    if (!isStaff) {
      const storedEmail = (reservation.contact_email as string | null)?.trim().toLowerCase()
      if (!storedEmail || storedEmail !== email.trim().toLowerCase()) {
        return json({ error: 'No autorizado para enviar este recibo' }, 403, origin)
      }
    }

    const html    = buildHtml(reservation)
    const subject = reservation.status === 'pagada'
      ? `Recibo Barco Pirata · ${formatDate(reservation.date)}`
      : `Tu reservación Barco Pirata · ${formatDate(reservation.date)}`

    const apiKey = Deno.env.get('RESEND_API_KEY')
    const from   = Deno.env.get('RECEIPT_FROM') ?? 'Barco Pirata <onboarding@resend.dev>'

    // Modo simulado (sin proveedor configurado): útil para demos.
    if (!apiKey) {
      console.log('[send-receipt] RESEND_API_KEY no configurada — simulando envío a', email)
      return json({ sent: false, simulated: true, to: email }, 200, origin)
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from, to: email, subject, html,
      }),
    })

    if (!res.ok) {
      const txt = await res.text()
      console.error('[send-receipt] Resend error:', res.status, txt)
      // No filtramos el cuerpo de Resend al cliente (podría contener detalles del provider)
      return json({ sent: false, error: 'Error al enviar correo' }, 502, origin)
    }

    const body = await res.json()
    return json({ sent: true, id: body.id ?? null, to: email }, 200, origin)
  } catch (err) {
    console.error('[send-receipt] error:', err)
    // No filtramos detalles del error al cliente
    return json({ error: 'Error interno del servidor' }, 500, origin)
  }
})
