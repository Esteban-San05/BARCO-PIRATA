# Plan de implementación — Pagos con Stripe + cuentas de cliente

> Plan ordenado para llevar Barco Pirata de **"pago presencial en muelle"** a **"pago 100% en línea con Stripe, multi-moneda MXN/USD, con magic link para clientes"**. Lee primero [`STRIPE_GUIDE.md`](./STRIPE_GUIDE.md) para el contexto conceptual.

---

## 0. Decisiones de producto confirmadas

| Decisión | Valor |
|---|---|
| Tipo de cuenta | **Checkout invitado** + magic link opcional post-compra |
| Monedas | **MXN + USD**, cliente elige (toggle, solo aplica a tarjeta) |
| Métodos de pago | **3 opciones, cliente elige**: ① Tarjeta (Stripe online) · ② Efectivo en muelle (admin coordina por WhatsApp) · ③ Transferencia bancaria (admin envía datos por WhatsApp) |
| Timing | **Tarjeta:** 100% al reservar (online). **Efectivo/Transferencia:** confirmación por WhatsApp, pago se recibe antes o el día del paseo. |

Implicaciones:
- El cliente que paga con tarjeta **debe completar el pago antes de ocupar un slot** (timeout de 20 min). Los que eligen efectivo/transferencia mantienen el flujo actual.
- Solo el flujo Stripe tiene webhook. Los pagos de muelle/transferencia los confirma el admin manualmente en `SalePage` (como hoy).
- Multi-moneda requiere pricing dual en `PACKAGES` **solo para Stripe**. Los pagos en muelle siguen siendo en MXN.
- El auto-cancel por timeout **solo aplica a `status='pendiente_pago'`** (Stripe abandonado). Las reservaciones `pendiente` con efectivo/transferencia NO se auto-cancelan — el admin las gestiona.
- "Cuentas de usuario" (magic link) aplica a todos los clientes sin importar el método elegido.

---

## 1. Auditoría — estado actual

### Lo que YA existe

| Pieza | Archivo | Estado |
|---|---|---|
| Stripe Edge Function (scaffold) | [supabase/functions/create-payment-intent/index.ts](../supabase/functions/create-payment-intent/index.ts) | Existe pero hardcoded a `'mxn'`, sin idempotencia, comentario dice "no se usa" |
| Llave publishable en `.env.example` | `VITE_STRIPE_PUBLISHABLE_KEY` | Documentada en [CLAUDE.md](../CLAUDE.md) |
| Tabla `payments` | [supabase/migrations/00001_initial_schema.sql:69](../supabase/migrations/00001_initial_schema.sql) | Existe con auditoría y RLS |
| Edge Function de recibos | [supabase/functions/send-receipt/index.ts](../supabase/functions/send-receipt/index.ts) | ✅ Funciona, con Resend + fallback simulado |
| Página de pago | [src/pages/public/PaymentPage.tsx](../src/pages/public/PaymentPage.tsx) | Existe pero **no está en el router** (zombie) |
| Roles de usuario admin/vendedor | [src/features/auth/hooks/useUserRole.ts](../src/features/auth/hooks/useUserRole.ts) | ✅ Funciona |
| Audit log automático | [supabase/migrations/00001_initial_schema.sql:124](../supabase/migrations/00001_initial_schema.sql) | ✅ Trigger en `payments` y `reservations` |
| Setup doc | [docs/STRIPE_SETUP.md](./STRIPE_SETUP.md) | Quickstart técnico, sirve de referencia |

### Lo que se ELIMINÓ deliberadamente (hay que revertir)

[supabase/migrations/00011_payment_method_transferencia.sql](../supabase/migrations/00011_payment_method_transferencia.sql) hizo estos cambios que ahora son problema:

1. Eliminó `'tarjeta'` del enum `payment_method`. Hoy solo acepta `('efectivo', 'transferencia')`.
2. Borró la columna `stripe_payment_intent_id` de `payments`.
3. Agregó `transferencia_reference` (esta sí se queda).

### Bugs / problemas que el plan debe arreglar

| Problema | Archivo | Solución |
|---|---|---|
| `paymentService.recordPayment` hardcodea `amount: 0` | [src/features/payments/services/paymentService.ts:12](../src/features/payments/services/paymentService.ts) | Pasar `amount` real desde el caller |
| Ruta `/pago/:reservationId` definida en constants pero NO en el router | [src/app/router/index.tsx](../src/app/router/index.tsx) | Registrar `PaymentPage` |
| `ConfirmationPage` asume pago en muelle | [src/pages/public/ConfirmationPage.tsx:171](../src/pages/public/ConfirmationPage.tsx) | Reescribir copy + redirección post-pago |
| `ReservationPage.onSubmit` navega a `/reservar/confirmacion` directo | [src/pages/public/ReservationPage.tsx:293](../src/pages/public/ReservationPage.tsx) | Cambiar a `/pago/:id` |
| `PACKAGES` solo tiene `adultPrice` / `youthPrice` en MXN | [src/constants/index.ts](../src/constants/index.ts) | Agregar `_usd` o usar `business_settings` |
| `RESEND_API_KEY` no configurada (recibos simulados) | Supabase env | Decisión: ¿real o demo? |
| Edge Function `stripe-webhook` no existe | — | Crear |
| Edge Function `refund-payment` no existe | — | Crear |

---

## 2. Arquitectura objetivo

```
┌───────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React + Vite)                       │
│                                                                        │
│  /reservar              → captura crew + fecha + contacto              │
│       ↓ submit (crea reserva status='pendiente')                       │
│  /reservar/metodo/:id   → elige cómo pagar (NUEVA pantalla)            │
│       ├── Tarjeta ──► /pago/:id        → Stripe Elements               │
│       │                    ↓ éxito                                     │
│       │              /pago/exito/:id   → recibo + CTA magic link       │
│       │                    ↓ error                                     │
│       │              /pago/error/:id   → reintentar                    │
│       │                                                                │
│       ├── Efectivo ──► /reservar/confirmacion ──► WhatsApp admin       │
│       │                  (status='pendiente', admin confirma luego)    │
│       │                                                                │
│       └── Transfer  ──► /reservar/confirmacion ──► WhatsApp admin      │
│                          (admin envía CLABE por WhatsApp)              │
│                                                                        │
│  /mis-reservaciones     → (cliente con magic link) lista personal      │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
                                  ↕
┌───────────────────────────────────────────────────────────────────────┐
│                       SUPABASE (Postgres + RLS)                        │
│                                                                        │
│   user_profiles (roles: admin, vendedor, cliente)                      │
│   reservations  (status: pendiente_pago, pagada, cancelada)            │
│   payments      (stripe_payment_intent_id, currency, refund cols)      │
│   stripe_customers (link email ↔ stripe_customer_id)                   │
│   webhook_events_processed (idempotencia)                              │
│   audit_log                                                            │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
                                  ↕
┌───────────────────────────────────────────────────────────────────────┐
│                      EDGE FUNCTIONS (Deno)                             │
│                                                                        │
│   create-payment-intent   (existente — refactor)                       │
│   stripe-webhook          (NUEVA — firma + idempotencia)               │
│   refund-payment          (NUEVA — admin only)                         │
│   send-receipt            (existente — reutilizar)                     │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
                                  ↕
                              ┌────────┐
                              │ STRIPE │
                              └────────┘
```

---

## 3. Fases del plan

Cada fase es **mergeable y testeable independiente**. Si necesitas pausar, cualquier fase deja el sistema funcional.

### Fase 0 — Pre-vuelo (1 día) ⏱️

> Stripe primero, código después. Sin esto activado, nada del resto importa.

- [ ] **F0.1** Crear cuenta Stripe en https://dashboard.stripe.com/register (si no existe ya)
- [ ] **F0.2** Modo test: copiar `pk_test_...` y `sk_test_...`
- [ ] **F0.3** Llenar `.env.local` con `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`
- [ ] **F0.4** En Supabase Dashboard → Edge Functions → Secrets, agregar `STRIPE_SECRET_KEY=sk_test_...`
- [ ] **F0.5** Páginas legales: agregar `/terminos`, `/privacidad`, `/cancelaciones` (texto mínimo viable) — KYC las pedirá después
- [ ] **F0.6** Configurar `Statement descriptor` en Stripe → Settings → Public business info → `BARCO PIRATA PP`
- [ ] **F0.7** Aplicar `npm install @stripe/stripe-js @stripe/react-stripe-js`

**Salida esperada:** llaves test cargadas, `npm run dev` sin errores nuevos.

---

### Fase 1 — Schema y tipos (1–2 días) ⏱️

Toda la fase es **una sola migración** + actualización de tipos generados.

#### F1.1 — Crear migración `00019_stripe_payments.sql`

> ℹ️ Esta migración **agrega** `'tarjeta'` al enum sin tocar `'efectivo'` ni `'transferencia'`. Los 3 métodos coexisten.

```sql
-- 1. Agregar 'tarjeta' de vuelta al enum payment_method (efectivo y transferencia ya existen)
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'tarjeta';

-- 2. Agregar columnas Stripe a payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_charge_id         text,
  ADD COLUMN IF NOT EXISTS currency                 text NOT NULL DEFAULT 'mxn'
    CHECK (currency IN ('mxn', 'usd')),
  ADD COLUMN IF NOT EXISTS refunded_amount          numeric(10,2) NOT NULL DEFAULT 0
    CHECK (refunded_amount >= 0),
  ADD COLUMN IF NOT EXISTS refunded_at              timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason            text;

CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi
  ON public.payments(stripe_payment_intent_id);

-- 3. Agregar 'pendiente_pago' al enum reservation_status
ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'pendiente_pago';

-- 4. Tabla para vincular email ↔ Stripe Customer
CREATE TABLE IF NOT EXISTS public.stripe_customers (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email              text NOT NULL,
  stripe_customer_id text NOT NULL UNIQUE,
  user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);

ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

-- Solo staff lee, nadie inserta vía API (lo hace la Edge Function con service role)
CREATE POLICY staff_read_stripe_customers ON public.stripe_customers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin','vendedor')
    )
  );

-- 5. Idempotencia de webhooks
CREATE TABLE IF NOT EXISTS public.webhook_events_processed (
  event_id     text PRIMARY KEY,
  event_type   text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events_processed ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo se accede con service role desde el webhook.

-- 6. Extender enum user_role para 'cliente'
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cliente';

-- 7. RLS: cliente lee solo sus reservaciones (por email)
DROP POLICY IF EXISTS "public_read_own_reservation" ON public.reservations;

CREATE POLICY client_read_own_reservation_by_email
  ON public.reservations FOR SELECT
  TO authenticated
  USING (
    contact_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin','vendedor')
    )
  );
```

#### F1.2 — Regenerar tipos

```bash
npx supabase gen types typescript --project-id foaimrzqvsgiffmvyebr > src/lib/supabase/database.types.ts
```

#### F1.3 — Actualizar tipos del dominio

[src/types/index.ts](../src/types/index.ts):

```ts
export interface Payment {
  id: string
  reservationId: string
  method: PaymentMethod
  amount: number
  currency: 'mxn' | 'usd'
  status: 'pendiente' | 'completado' | 'fallido' | 'reembolsado'
  stripePaymentIntentId: string | null
  stripeChargeId: string | null
  refundedAmount: number
  refundedAt: string | null
  refundReason: string | null
  transferenciaReference: string | null
  receiptUrl: string | null
  processedAt: string | null
  createdAt: string
}

export interface User {
  id: string
  email: string
  role: 'admin' | 'vendedor' | 'cliente'
  fullName: string
  createdAt: string
}
```

#### F1.4 — Actualizar constants

[src/constants/index.ts](../src/constants/index.ts):

```ts
export const PAYMENT_METHODS = {
  TARJETA: 'tarjeta',
  EFECTIVO: 'efectivo',
  TRANSFERENCIA: 'transferencia',
} as const

export const RESERVATION_STATUS = {
  PENDIENTE: 'pendiente',
  PENDIENTE_PAGO: 'pendiente_pago',  // NUEVO
  CONFIRMADA: 'confirmada',
  PAGADA: 'pagada',
  CANCELADA: 'cancelada',
} as const

// Multi-moneda en PACKAGES (opción A: precios fijos)
export const PACKAGES = {
  CON_COMIDA: {
    id: 'con_comida',
    adultPrice_mxn: 700,
    adultPrice_usd: 39,
    youthPrice_mxn: 500,
    youthPrice_usd: 28,
    // ...resto igual
  },
  // ...
}
```

**Salida esperada:** `npm run type-check` y `npm run build` pasan sin warnings.

---

### Fase 2 — Edge Functions (3 días) ⏱️

#### F2.1 — Refactor `create-payment-intent`

Cambios sobre [supabase/functions/create-payment-intent/index.ts](../supabase/functions/create-payment-intent/index.ts):

1. **Aceptar `currency`** en el body: `{ reservationId, currency: 'mxn' | 'usd' }`
2. **Calcular monto en la moneda correcta** del lado servidor, NO confiar en el cliente
3. **Idempotency key** = `reservationId` (Stripe garantiza que el mismo key produce el mismo intent)
4. **Crear/recuperar Stripe Customer** por email (insertar en tabla `stripe_customers`)
5. **No requerir JWT** — el cliente está en checkout invitado (`--no-verify-jwt` en deploy)
6. **Validar contra inyección**: `reservationId` debe ser UUID válido, `currency` debe estar en whitelist

Pseudo-código clave:

```ts
const { reservationId, currency } = await req.json()
if (!isUuid(reservationId) || !['mxn','usd'].includes(currency)) {
  return json({ error: 'Bad request' }, 400)
}

// Service role para leer y crear customer
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const { data: reservation } = await supabase
  .from('reservations')
  .select('id, total_mxn, total_usd, contact_name, contact_email, status, package_breakdown')
  .eq('id', reservationId).single()

if (reservation.status === 'pagada')
  return json({ error: 'Ya está pagada' }, 400)

const amount = currency === 'mxn' ? reservation.total_mxn : reservation.total_usd

// Customer
let customerId = await getOrCreateStripeCustomer(supabase, stripe, reservation.contact_email, reservation.contact_name)

const intent = await stripe.paymentIntents.create({
  amount: Math.round(amount * 100),
  currency,
  customer: customerId,
  automatic_payment_methods: { enabled: true },
  receipt_email: reservation.contact_email,
  metadata: {
    reservationId: reservation.id,
    contactName: reservation.contact_name,
  },
}, {
  idempotencyKey: reservationId,  // ⚠️ clave
})

return json({ clientSecret: intent.client_secret })
```

#### F2.2 — NUEVA `stripe-webhook`

Crear [supabase/functions/stripe-webhook/index.ts](../supabase/functions/stripe-webhook/index.ts):

```ts
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})
const WHSEC = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('No signature', { status: 400 })

  const rawBody = await req.text()  // ⚠️ raw, antes de cualquier parse

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, WHSEC)
  } catch {
    return new Response('Bad signature', { status: 400 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Idempotencia
  const { error: dupErr } = await supabase
    .from('webhook_events_processed')
    .insert({ event_id: event.id, event_type: event.type })
  if (dupErr?.code === '23505') return new Response('Already processed', { status: 200 })

  switch (event.type) {
    case 'payment_intent.succeeded':       await handleSuccess(supabase, event); break
    case 'payment_intent.payment_failed':  await handleFailed(supabase, event);  break
    case 'charge.refunded':                await handleRefund(supabase, event);  break
    case 'charge.dispute.created':         await handleDispute(supabase, event); break
  }

  return new Response('ok', { status: 200 })
})
```

Deploy: `supabase functions deploy stripe-webhook --no-verify-jwt`

Después: en Stripe Dashboard → Webhooks → Add endpoint:
- URL: `https://foaimrzqvsgiffmvyebr.supabase.co/functions/v1/stripe-webhook`
- Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`
- Copiar el `whsec_...` → Supabase secret `STRIPE_WEBHOOK_SECRET`

#### F2.3 — NUEVA `refund-payment`

[supabase/functions/refund-payment/index.ts](../supabase/functions/refund-payment/index.ts):

- Requiere JWT autenticado (`verify_jwt = true`)
- Verifica que el usuario tenga `role = 'admin'` (vendedor NO puede reembolsar)
- Acepta `{ paymentId, amount?, reason? }` — sin `amount` reembolsa todo
- Llama `stripe.refunds.create({ payment_intent: ..., amount, reason })`
- NO actualiza la DB directamente — deja que el webhook `charge.refunded` lo haga (single source of truth)
- Inserta entrada en `audit_log` con el admin que ejecutó

**Salida esperada:** Las 3 Edge Functions desplegadas. Probar con la tarjeta `4242 4242 4242 4242` → ver pago en dashboard test → ver reserva marcada `pagada` por el webhook.

---

### Fase 3 — Frontend de pago (3 días) ⏱️

#### F3.0 — Pantalla de elección de método (NUEVA)

[src/pages/public/PaymentMethodPage.tsx](../src/pages/public/PaymentMethodPage.tsx) — ruta `/reservar/metodo/:reservationId`:

```tsx
export default function PaymentMethodPage() {
  const { reservationId } = useParams()
  const navigate = useNavigate()
  const { data: reservation } = useReservation(reservationId!)
  const updateStatus = useUpdateReservationStatus()

  if (!reservation) return <LoadingSpinner />

  const onChoose = async (method: 'tarjeta' | 'efectivo' | 'transferencia') => {
    if (method === 'tarjeta') {
      // Cambia el status para que el cron de limpieza pueda recuperar el slot si no completa
      await updateStatus.mutateAsync({ id: reservationId!, status: 'pendiente_pago' })
      navigate(`/pago/${reservationId}`)
    } else {
      // Cash / transfer: la reserva queda 'pendiente', admin la confirma luego
      await updateStatus.mutateAsync({
        id: reservationId!,
        status: 'pendiente',
        paymentMethod: method,
      })
      navigate('/reservar/confirmacion')
    }
  }

  return (
    <div className="container-app py-8 max-w-lg">
      <h1 className="font-display text-2xl mb-2">¿Cómo prefieres pagar?</h1>
      <p className="text-navy-500 mb-6">
        Total: <strong>{formatCurrency(reservation.total)}</strong>
      </p>

      <div className="space-y-3">
        <MethodCard
          icon="💳"
          title="Tarjeta de crédito / débito"
          description="Visa, MasterCard, Amex. Pago en línea inmediato. Recibo automático por correo."
          badge="Recomendado"
          onClick={() => onChoose('tarjeta')}
        />
        <MethodCard
          icon="💵"
          title="Efectivo en muelle"
          description="Confirmas por WhatsApp y pagas el día del paseo al llegar."
          onClick={() => onChoose('efectivo')}
        />
        <MethodCard
          icon="🏦"
          title="Transferencia bancaria"
          description="Te enviamos los datos bancarios por WhatsApp. Envías el comprobante."
          onClick={() => onChoose('transferencia')}
        />
      </div>
    </div>
  )
}
```

Diseño: 3 cards verticales, cada una grande y clickeable. La de tarjeta destacada con badge "Recomendado".

#### F3.1 — Hook `useStripePaymentIntent`

[src/features/payments/hooks/useStripePaymentIntent.ts](../src/features/payments/hooks/useStripePaymentIntent.ts) (NUEVO):

```ts
export function useStripePaymentIntent(reservationId: string, currency: 'mxn' | 'usd') {
  return useQuery({
    queryKey: ['stripe-intent', reservationId, currency],
    enabled: !!reservationId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: { reservationId, currency },
      })
      if (error) throw error
      return data.clientSecret as string
    },
  })
}
```

#### F3.2 — Reescribir `PaymentPage`

Esqueleto:

```tsx
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export default function PaymentPage() {
  const { reservationId } = useParams()
  const [currency, setCurrency] = useState<'mxn' | 'usd'>('mxn')
  const { data: reservation } = useReservation(reservationId!)
  const { data: clientSecret, isLoading } = useStripePaymentIntent(reservationId!, currency)

  if (!reservation || isLoading) return <LoadingSpinner />

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <PaymentForm reservation={reservation} currency={currency} onCurrencyChange={setCurrency} />
    </Elements>
  )
}

function PaymentForm({ reservation, currency, onCurrencyChange }) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pago/exito/${reservation.id}`,
      },
    })

    if (error) {
      navigate(`/pago/error/${reservation.id}?msg=${encodeURIComponent(error.message ?? '')}`)
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <CurrencyToggle value={currency} onChange={onCurrencyChange} />
      <ReservationSummary reservation={reservation} currency={currency} />
      <PaymentElement />
      <Button type="submit" disabled={!stripe || submitting}>
        Pagar {formatAmount(reservation, currency)}
      </Button>
    </form>
  )
}
```

#### F3.3 — Nuevas páginas

- `/pago/exito/:id` — Muestra recibo, ofrece "Quiero ver mis futuras reservas" → magic link
- `/pago/error/:id` — Mensaje de error, botón "Volver a intentar"

#### F3.4 — Cambiar flujo de `ReservationPage`

[src/pages/public/ReservationPage.tsx:293](../src/pages/public/ReservationPage.tsx) — cambiar:

```ts
// Antes:
navigate('/reservar/confirmacion')

// Después: ir a la pantalla de elección, no directo a pago
navigate(`/reservar/metodo/${reservation.id}`)
```

Status inicial de la reservación **sigue siendo `'pendiente'`** — cambia a `'pendiente_pago'` solo si el cliente elige tarjeta (lo hace `PaymentMethodPage`).

#### F3.5 — Actualizar `ConfirmationPage`

Mantiene su rol actual (post-elección para efectivo/transferencia con CTA de WhatsApp), pero también la reutilizamos para post-pago Stripe — lee el `payment_method` y muestra el copy adecuado:

```tsx
// Heurística simple:
const isPaidWithCard = reservation.paymentMethod === 'tarjeta' && reservation.status === 'pagada'
const isPendingCash = reservation.paymentMethod === 'efectivo' && reservation.status !== 'pagada'
const isPendingTransfer = reservation.paymentMethod === 'transferencia' && reservation.status !== 'pagada'

{isPaidWithCard && <p>✅ Pago recibido. Gracias.</p>}
{isPendingCash && <p>Confirma por WhatsApp y paga el día del paseo al llegar.</p>}
{isPendingTransfer && <p>Te enviaremos los datos bancarios por WhatsApp.</p>}
```

> Alternativa más limpia (opcional): crear `PaymentSuccessPage` aparte para Stripe en `/pago/exito/:id`, y dejar `/reservar/confirmacion` solo para efectivo/transferencia. Decisión de UI — ambas opciones funcionan.

#### F3.6 — Registrar rutas

[src/app/router/index.tsx](../src/app/router/index.tsx):

```tsx
{ path: '/reservar/metodo/:reservationId', element: withSuspense(<PaymentMethodPage />) },
{ path: '/pago/:reservationId',            element: withSuspense(<PaymentPage />) },
{ path: '/pago/exito/:reservationId',      element: withSuspense(<PaymentSuccessPage />) },
{ path: '/pago/error/:reservationId',      element: withSuspense(<PaymentErrorPage />) },
```

**Salida esperada:** Reservar → elegir método → si tarjeta: pagar con `4242...` y ver éxito; si efectivo/transferencia: confirmación con CTA WhatsApp idéntica a hoy.

---

### Fase 4 — Cuentas de cliente (magic link) (2 días) ⏱️

> Esta fase implementa **lo que pediste cuando dijiste "tendremos que tener cuentas para cada usuario"** — usando magic link OTP (sin contraseña) para minimizar fricción.

#### F4.1 — Habilitar magic link en Supabase Auth

Dashboard → Authentication → Providers → Email → habilitar **"Enable magic link"**. Deshabilitar "Confirm email" si quieres flujo sin verificación previa.

#### F4.2 — Componente `RequestMagicLinkCard`

En `/pago/exito/:id`:

```tsx
<button onClick={async () => {
  await supabase.auth.signInWithOtp({
    email: reservation.contact_email,
    options: { emailRedirectTo: `${window.location.origin}/mis-reservaciones` },
  })
  toast.success('Revisa tu correo para entrar')
}}>
  Quiero ver mis futuras reservas
</button>
```

#### F4.3 — Trigger: crear `user_profiles` cuando cliente entra primera vez

```sql
CREATE OR REPLACE FUNCTION public.handle_new_client_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'cliente'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client_signup();
```

⚠️ Importante: la lógica de creación de admins manuales ([memoria: project_create_admin_user_pattern.md](../../C:/Users/bemud/.claude/projects/D--barco-BARCO-PIRATA-1/memory/project_create_admin_user_pattern.md)) sigue funcionando porque hace `ON CONFLICT DO NOTHING` — si ya insertaste el perfil con role `admin` manualmente, el trigger no lo sobreescribe.

#### F4.4 — Página `/mis-reservaciones`

Protegida con `ProtectedRoute` pero sin requerir `admin`. Lista reservaciones del cliente filtradas por su email (RLS ya lo limita).

#### F4.5 — Vincular Stripe Customer al user_id cuando cliente se loguea

Trigger o función que, al login de un cliente, actualice `stripe_customers.user_id` para vincular su Stripe Customer existente al nuevo user.

**Salida esperada:** Cliente paga como invitado → recibe magic link opcional → puede entrar a `/mis-reservaciones` y ver sus pagos pasados.

---

### Fase 5 — Admin: reembolsos y reconciliación (2 días) ⏱️

#### F5.1 — Botón "Reembolsar" en `SalePage`

```tsx
{payment.status === 'completado' && isAdmin && (
  <RefundDialog
    payment={payment}
    onRefund={async ({ amount, reason }) => {
      await supabase.functions.invoke('refund-payment', {
        body: { paymentId: payment.id, amount, reason },
      })
      toast.success('Reembolso emitido. Se procesará en 5–10 días.')
    }}
  />
)}
```

#### F5.2 — UI de estado de pago

En la lista de reservaciones admin, badge claro según método y status:

| Método + Status | Badge |
|---|---|
| `tarjeta` + `pagada` | 🟢 Pagada (Tarjeta) — link al dashboard Stripe |
| `tarjeta` + `pendiente_pago` | 🟡 Esperando pago en línea (timeout en X min) |
| `tarjeta` + `cancelada` | ⚪ Abandonada (timeout) |
| `efectivo` + `pendiente` / `confirmada` | 🟠 Por cobrar en muelle |
| `efectivo` + `pagada` | 🟢 Pagada (Efectivo) — admin confirmó |
| `transferencia` + `pendiente` / `confirmada` | 🔵 Esperando transferencia (referencia: ...) |
| `transferencia` + `pagada` | 🟢 Pagada (Transferencia) — admin confirmó |
| cualquiera + `reembolsado` | 🟣 Reembolsada |

#### F5.3 — Cron de limpieza (solo Stripe)

Edge Function `cleanup-pending-reservations` con cron de Supabase, cada 30 min:

```sql
-- Solo cancela reservaciones de TARJETA que el cliente abandonó a medio pago.
-- NO toca las de efectivo/transferencia (esas las gestiona el admin manualmente vía WhatsApp).
UPDATE public.reservations
SET status = 'cancelada',
    notes = COALESCE(notes,'') || ' [auto-cancelada por timeout de pago en línea]'
WHERE status = 'pendiente_pago'
  AND payment_method = 'tarjeta'
  AND created_at < now() - interval '20 minutes';
```

Esto libera slots de quien abrió la página de Stripe y no completó. **Las reservas con `payment_method IN ('efectivo','transferencia')` se quedan vivas indefinidamente** — el admin las cancela manualmente si el cliente no responde por WhatsApp.

#### F5.4 — Link al dashboard Stripe desde el admin

En `SalePage`, si `payment.stripe_payment_intent_id`:

```tsx
<a href={`https://dashboard.stripe.com/payments/${payment.stripePaymentIntentId}`} target="_blank">
  Ver en Stripe ↗
</a>
```

(Cambiar a `/test/payments/` si estás en modo test — usar `import.meta.env.VITE_APP_ENV`.)

**Salida esperada:** Admin puede ver, reembolsar, conciliar todos los pagos desde dentro de la app.

---

### Fase 6 — Go-live (1–3 días + esperar KYC) ⏱️

#### F6.1 — Páginas legales reales

Reemplazar las versiones mínimas de F0.5 con texto definitivo:
- **Términos de servicio**
- **Política de privacidad** (LFPDPPP en México)
- **Política de cancelación** ← Stripe es estricto con esto en turismo

Recomendación: usar un servicio tipo TermsFeed.com o copiar de un competidor con buenas, y un abogado lo revisa después.

#### F6.2 — Activar cuenta Stripe (KYC)

Dashboard → Activate. Llenar:
- Tipo de negocio (persona física vs moral)
- RFC, INE, CURP
- CLABE (MXN) + cuenta USD si la tienes
- Comprobante de domicilio
- URL del sitio (con páginas legales visibles)
- Descripción del negocio
- Tiempo de espera promedio antes de entrega del servicio: "1 día" (ayuda a bajar el rolling reserve)

Esperar 1–10 días.

#### F6.3 — Reemplazar llaves test por live

Una vez activado:

```env
# .env.production
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Supabase secret:
```
STRIPE_SECRET_KEY=sk_live_...
```

#### F6.4 — Endpoint de webhook en modo live

Crear OTRO endpoint en Stripe Dashboard (modo live esta vez), copiar su nuevo `whsec_...` → actualizar `STRIPE_WEBHOOK_SECRET` en Supabase.

#### F6.5 — Transacción de prueba real

Con tu propia tarjeta, $50 MXN. Verifica:
- ✅ Cargo aparece en dashboard live
- ✅ Webhook se procesó (reserva marcada `pagada`)
- ✅ Recibo llegó a tu correo
- ✅ Reembolsa ese $50 desde la app — verifica que `charge.refunded` también dispara y la reserva queda `cancelada`

#### F6.6 — Monitoreo continuo

Configura email de Stripe a `tu-correo@dominio.com` para:
- `radar.alert` — alertas de fraude
- Cualquier `charge.dispute.created`

**Salida esperada:** Pagos reales funcionando. Primera transacción de cliente real exitosa.

---

## 4. Checklist consolidado de go-live

Antes de cambiar a llaves live:

- [ ] Páginas legales (Términos, Privacidad, Cancelación) publicadas
- [ ] Cuenta Stripe activada (KYC aprobado)
- [ ] CLABE verificada (status "Verified" en dashboard)
- [ ] Cuenta USD verificada si vas a cobrar USD
- [ ] Statement descriptor configurado: `BARCO PIRATA PP`
- [ ] Modo test: 10+ pagos exitosos probados
- [ ] Modo test: refund total probado
- [ ] Modo test: refund parcial probado
- [ ] Modo test: pago fallido probado
- [ ] Modo test: pago con 3DS probado
- [ ] Webhook en modo test: 0 firmas rechazadas en últimos 7 días
- [ ] Webhook endpoint live creado con su propio `whsec_`
- [ ] Transacción de prueba real ($50 MXN) exitosa
- [ ] Reembolso de prueba real exitoso
- [ ] Email de alertas de Stripe redirigido al admin
- [ ] Cron de limpieza de `pendiente_pago` activo
- [ ] `.gitignore` incluye `.env.local` (verificar `git status` no muestra `.env*` modificado)
- [ ] Variable `VITE_STRIPE_PUBLISHABLE_KEY` en Vercel/hosting con valor `pk_live_...`

---

## 5. Estimación de esfuerzo

| Fase | Horas | Bloqueado por |
|---|---|---|
| F0 — Pre-vuelo | 4h | — |
| F1 — Schema | 8h | F0 |
| F2 — Edge Functions | 16h | F1 |
| F3 — Frontend pago (incluye pantalla elección de método) | 24h | F2 |
| F4 — Magic link | 10h | F1 |
| F5 — Admin/refunds | 12h | F2, F3 |
| F6 — Go-live | 4h código + 1–10 días KYC | F5 |
| **Total** | **~78h de código** | + espera KYC |

Realista: **3–4 semanas calendario** para ir desde el commit cero hasta producción.

---

## 6. Cómo arrancamos

Cuando confirmes que el plan tiene sentido, ejecutamos en este orden:

1. **F0 primero, solo** — porque sin Stripe configurado el resto no se puede probar.
2. **F1 + F2 en paralelo** — son backend, no se pisan con UI.
3. **F3 después** — depende de F2.
4. **F4 y F5 en paralelo** — independientes entre sí.
5. **F6 al final**.

Cada fase es un PR separado. Eso te deja revisar y rollback granular si algo se complica.

---

## Anexos

- [STRIPE_GUIDE.md](./STRIPE_GUIDE.md) — manual operativo
- [STRIPE_SETUP.md](./STRIPE_SETUP.md) — quickstart técnico (existente)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — arquitectura general del proyecto
- Stripe testing cards: https://stripe.com/docs/testing
- Supabase Edge Functions docs: https://supabase.com/docs/guides/functions
