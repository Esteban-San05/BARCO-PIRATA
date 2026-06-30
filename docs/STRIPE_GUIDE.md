# Stripe — Manual operativo para Barco Pirata

> Esta guía cubre **cómo opera Stripe en el día a día** del negocio: qué hacer ante un reembolso, cómo se verifica tu cuenta bancaria, qué significa un pago "pendiente", comisiones reales en México, y cómo leer el dashboard sin confundirte. Para el setup inicial (crear cuenta, llaves API, primera prueba) lee primero **[STRIPE_SETUP.md](./STRIPE_SETUP.md)**.

---

## Tabla de contenido

1. [Conceptos esenciales](#1-conceptos-esenciales)
2. [Activación de la cuenta (KYC)](#2-activación-de-la-cuenta-kyc)
3. [Cuenta bancaria y payouts](#3-cuenta-bancaria-y-payouts)
4. [Modo test vs Live](#4-modo-test-vs-live)
5. [Comisiones reales en México](#5-comisiones-reales-en-méxico)
6. [El flujo de un pago, paso a paso](#6-el-flujo-de-un-pago-paso-a-paso)
7. [Estados de un PaymentIntent](#7-estados-de-un-paymentintent)
8. [Reembolsos](#8-reembolsos)
9. [Pagos "sin verificar" o pendientes](#9-pagos-sin-verificar-o-pendientes)
10. [Disputas y chargebacks](#10-disputas-y-chargebacks)
11. [3D Secure / SCA](#11-3d-secure--sca)
12. [El dashboard día a día](#12-el-dashboard-día-a-día)
13. [Multi-moneda MXN + USD](#13-multi-moneda-mxn--usd)
14. [Webhooks: por qué importan](#14-webhooks-por-qué-importan)
15. [Tarjetas de prueba útiles](#15-tarjetas-de-prueba-útiles)
16. [Cuándo recibes el dinero (payouts)](#16-cuándo-recibes-el-dinero-payouts)
17. [Bloqueo de cuenta / fraude](#17-bloqueo-de-cuenta--fraude)
18. [Glosario](#18-glosario)

---

## 1. Conceptos esenciales

Stripe tiene **5 objetos** que aparecen una y otra vez. Si entiendes estos, entiendes Stripe:

| Objeto | Qué es | Ejemplo en Barco Pirata |
|---|---|---|
| **Customer** | Identidad del comprador en Stripe (email + métodos de pago guardados). | Juan Pérez (`juan@gmail.com`), reservó 3 paseos en el año. |
| **PaymentIntent** | La "intención" de cobrar X cantidad. Pasa por varios estados hasta `succeeded` o `failed`. Es el objeto central. | "Cobrar $2,800 MXN por la reserva 8f7a-...". |
| **Charge** | El cargo en sí. Lo crea Stripe automáticamente cuando un PaymentIntent llega a `succeeded`. | El cobro real de $2,800 a la tarjeta `**** 4242`. |
| **PaymentMethod** | Una tarjeta, OXXO voucher, etc. asociada (o no) a un Customer. | Visa terminada en `4242`. |
| **Refund** | Devolución total o parcial de un Charge. | Cancelaron y devolvimos $1,400 (50%). |

**Webhook** = mensaje que Stripe envía a tu servidor cuando algo pasa (pago exitoso, reembolso emitido, etc.). Sin webhooks, tu app **no se entera** si el cliente cierra la pestaña antes de que se confirme el pago.

---

## 2. Activación de la cuenta (KYC)

KYC = "Know Your Customer". Es el proceso por el que Stripe verifica que tu negocio es legítimo antes de soltarte dinero real. **Sin KYC completo no recibes payouts.**

### Lo que Stripe te va a pedir en México

| Documento | Detalle |
|---|---|
| **RFC de la persona o moral** | Persona física o moral. Si vas a operar como Barco Pirata SA de CV, usa el RFC de la sociedad. |
| **CURP** del representante legal | Si eres persona física. |
| **Acta constitutiva** (PDF) | Solo si eres persona moral. |
| **Comprobante de domicilio** | Recibo de luz / agua / teléfono < 3 meses. |
| **Identificación oficial** | INE por ambos lados o pasaporte. |
| **CLABE interbancaria** | 18 dígitos. Es la cuenta donde Stripe te depositará. Debe estar a nombre del titular del RFC. |
| **Descripción del negocio** | "Paseos turísticos en barco — Puerto Peñasco, Sonora." Lo van a leer humanos. |
| **URL del sitio** | https://(tu dominio) — debe estar funcionando, con términos de servicio y política de privacidad visibles. |

### Términos y privacidad — obligatorios

Stripe rechaza activaciones si tu sitio **no tiene**:
- Página de Términos y Condiciones
- Política de Privacidad
- Política de Cancelación / Reembolsos (¡crítico para turismo!)
- Información de contacto visible

Si todavía no las tienes, agrégalas antes de pedir activación. Te las pedirán y bloquearán la cuenta hasta verlas.

### Cuánto tarda

- **Persona física:** 1–3 días hábiles si todo está limpio.
- **Persona moral:** 3–10 días hábiles. A veces piden documentos extra.
- **Si te rechazan:** Stripe dice exactamente qué falta. Corrígelo y vuelves a enviar. No hay penalización por re-intentar.

---

## 3. Cuenta bancaria y payouts

### ¿Cómo verifica Stripe la cuenta bancaria?

**En México** Stripe usa CLABE (no microdepósitos como en EE.UU.). El flujo es:

1. Capturas la CLABE en el dashboard (**Settings → Payouts → Bank accounts**).
2. Stripe valida que la CLABE exista y esté activa (lo hace contra el sistema SPEI).
3. Stripe valida que el **nombre del titular** coincida con el RFC registrado en la cuenta.
4. Si todo OK, el banco queda como "Verified" y los payouts arrancan.

> ⚠️ Si el nombre del titular de la CLABE NO coincide con el RFC de tu cuenta Stripe, **no se verifica**. Esto pasa mucho cuando la CLABE está a nombre del dueño pero la cuenta Stripe se registró a nombre de la sociedad.

### Cambiar la cuenta bancaria

- **Settings → Payouts → Bank accounts → Add bank account.**
- Puedes tener varias CLABEs y marcar una como "default".
- Al agregar una nueva: Stripe la verifica otra vez. Mientras tanto los payouts siguen yendo a la anterior.
- Para eliminar la vieja, primero marca la nueva como default.

### Múltiples monedas — cuentas separadas

Si cobras en USD y MXN, **necesitas dos cuentas bancarias**:
- Una **CLABE MXN** para recibir los payouts en pesos.
- Una **cuenta USD** (en BBVA / Santander / Monex tipicamente) para recibir los dólares. Stripe también acepta cuentas USD en bancos de EE.UU.

Si solo tienes CLABE MXN y cobras en USD, Stripe convertirá USD → MXN antes de depositarte, **a su tipo de cambio + 2% de fee**. Casi siempre te conviene tener cuenta USD directa.

---

## 4. Modo test vs Live

Stripe tiene **dos modos completamente aislados**:

| | Test mode | Live mode |
|---|---|---|
| Llaves | `pk_test_...`, `sk_test_...` | `pk_live_...`, `sk_live_...` |
| Dinero | Falso (no se mueve nada real) | Real |
| Tarjetas | Solo las de prueba (4242...) funcionan | Tarjetas reales |
| Customers | Aislados | Aislados |
| Webhooks | Endpoint separado | Endpoint separado |
| Payouts | No hay | Sí |

**El toggle "Modo test"** está arriba a la derecha del dashboard. Verifica en qué modo estás antes de tocar cualquier cosa.

> 🛑 **Mezclar llaves test y live** es el bug #1 de principiantes. Si ves el error `No such payment_intent`, casi siempre es eso. Las claves del frontend y del backend tienen que ser del mismo modo.

---

## 5. Comisiones reales en México

> Lo que Stripe cobra **por transacción exitosa** en MX. Actualizadas a 2026. Verifica en [stripe.com/mx/pricing](https://stripe.com/mx/pricing) por si cambiaron.

| Método | Comisión |
|---|---|
| **Tarjeta MX (nacional)** | **3.6% + $3 MXN** |
| **Tarjeta internacional** (cuando un turista gringo paga en MXN) | **3.6% + 2% extra + $3 MXN** = 5.6% + $3 |
| **Reembolso** | Stripe **NO te devuelve la comisión** del cargo original. Pierdes ese 3.6% + $3. |
| **Disputa / chargeback** | Stripe cobra **$15 USD adicionales** por procesar la disputa (lo pierdes ganes o no la disputa). |
| **Conversión de moneda (USD→MXN)** | **+2%** sobre el tipo de cambio. |

### Ejemplo numérico

Cliente paga **$2,800 MXN** (4 personas × $700 paquete Con Comida) con Visa nacional:

```
Cargo bruto:        $2,800.00
Comisión Stripe:   -  $103.80   (3.6% + $3)
Te queda:           $2,696.20
```

Si el mismo cliente reserva y luego cancela 100%:
```
Devuelves al cliente:  $2,800.00  (Stripe lo cobra a tu balance)
Te quedaste sin:       $   103.80  (la comisión NO se reembolsa)
Pérdida neta:          $   103.80
```

Esto es importante para tu **política de cancelación**: si reembolsas 100% pierdes la comisión. Mucho turismo cobra 5–10% por cancelación tardía justamente por eso.

---

## 6. El flujo de un pago, paso a paso

Esto es lo que pasa cuando un cliente paga en Barco Pirata:

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. Cliente llena el formulario de reserva → click "Pagar"          │
│                                                                       │
│  2. Frontend (React) llama Edge Function `create-payment-intent`     │
│     enviando { reservationId }                                       │
│                                                                       │
│  3. Edge Function (Deno + secret key):                               │
│     a. Lee la reserva desde Supabase (valida monto, no confiar       │
│        en el cliente jamás)                                          │
│     b. Crea un PaymentIntent en Stripe con monto, currency, metadata │
│     c. Devuelve el `client_secret` al frontend                       │
│                                                                       │
│  4. Frontend monta <PaymentElement /> de Stripe con ese client       │
│     secret. El cliente captura datos de tarjeta — la tarjeta NUNCA   │
│     toca tu servidor.                                                │
│                                                                       │
│  5. Cliente click "Confirmar pago". Stripe.js manda los datos a      │
│     stripe.com directamente. Si requiere 3D Secure, Stripe abre el   │
│     reto y lo maneja.                                                │
│                                                                       │
│  6. Stripe responde al frontend con el resultado: succeeded /        │
│     requires_action / failed.                                        │
│                                                                       │
│  7. Frontend redirige a `/pago/exito/:reservationId` o muestra error.│
│                                                                       │
│  8. EN PARALELO: Stripe envía un webhook a `stripe-webhook` Edge     │
│     Function con el evento `payment_intent.succeeded`.               │
│                                                                       │
│  9. Webhook (después de verificar la firma):                         │
│     a. Marca la reserva como 'pagada' en Supabase                    │
│     b. Crea un registro en la tabla `payments`                       │
│     c. Dispara `send-receipt` para mandar el correo                  │
│                                                                       │
│  Listo. El paso 8 es crítico: si el cliente cierra el navegador      │
│  antes del paso 7, el webhook hace el trabajo igual.                 │
└──────────────────────────────────────────────────────────────────────┘
```

**Regla de oro:** El frontend dice "se intentó pagar". **El webhook dice "se cobró".** Confía solo en el webhook para marcar `pagada`.

---

## 7. Estados de un PaymentIntent

Cada PaymentIntent pasa por estos estados:

| Estado | Significado | ¿Qué hacer? |
|---|---|---|
| `requires_payment_method` | Acabamos de crear el intent. El cliente todavía no captura tarjeta. | Esperar. La reserva queda "pendiente_pago". |
| `requires_confirmation` | Cliente capturó tarjeta pero no apretó "Confirmar". | Esperar. Stripe.js usualmente confirma automático. |
| `requires_action` | Banco pide 3D Secure (el cliente debe meter código OTP). | Stripe.js abre el modal automático. Esperar. |
| `processing` | Stripe está procesando el cargo con el banco. Tarda segundos. | Esperar. NO marcar como pagada todavía. |
| `succeeded` | ✅ El cargo fue exitoso. **Aquí marcas pagada.** | El webhook lo recibe y actualiza la DB. |
| `requires_capture` | (Solo si usas captura manual — no es nuestro caso). | N/A |
| `canceled` | El cliente o tú cancelaron antes de cobrar. | Marcar reserva como cancelada. |
| `requires_action` (después de fallo) | El banco rechazó y pidió otra acción. | Mostrar al cliente que reintente. |

### "Cargos pendientes" en el dashboard

A veces verás un cargo que dice **"Pending"** (gris). Es uno de estos casos:
1. `processing` — el banco aún no confirma.
2. Pago con OXXO/SPEI — el cliente recibió un voucher pero aún no fue a la tienda a pagar (solo si activas OXXO; **no es tu caso ahora**).
3. Pago con 3DS que el cliente abandonó.

**No le entregues el servicio** hasta que el dashboard diga **"Succeeded"** (verde).

---

## 8. Reembolsos

### Cómo se hace técnicamente

Desde el dashboard:
1. **Payments → busca por monto / nombre / reservationId.**
2. Click en el cargo → botón "**Refund**" arriba a la derecha.
3. Elige **Full** o **Partial**.
4. **Reason** (opcional pero recomendado): `requested_by_customer`, `duplicate`, `fraudulent`. Te ayuda a llevar estadísticas.
5. Confirmar.

Stripe procesa el reembolso **al instante en su sistema**, pero el dinero **tarda 5–10 días hábiles** en aparecer en la tarjeta del cliente. El cliente verá el cargo y el reembolso como dos líneas separadas en su estado de cuenta.

### Reembolso desde tu app (más profesional)

En vez de hacerlo desde el dashboard, lo correcto es tener un botón "Reembolsar" en `/admin/venta/:reservationId`. Eso llama a una Edge Function `refund-payment` que:
1. Verifica que el admin tenga rol `admin` (no `vendedor`).
2. Lee el `stripe_payment_intent_id` de la reserva.
3. Llama `stripe.refunds.create({ payment_intent: ..., amount: ... })`.
4. Actualiza la reserva: `status='cancelada'`, `payments.status='reembolsado'`, `refunded_amount`, `refunded_at`.
5. Mete un registro en `audit_log` con `old_values` / `new_values`.

> Esto está en el [plan de implementación](./STRIPE_IMPLEMENTATION_PLAN.md) como una de las primeras tareas post-MVP.

### Reembolsos parciales

Útil cuando el grupo se reduce. Ej. reservaron 6, llegaron 4:

```
Original:        $4,200 (6 × $700)
Asistieron:      $2,800 (4 × $700)
Reembolso:       $1,400 (parcial)
```

Stripe acepta múltiples reembolsos parciales sobre el mismo charge hasta llegar al 100%.

### Lo que pierdes

- **Comisión Stripe** (3.6% + $3) del cargo original: NO se recupera.
- En reembolso parcial pierdes la **comisión proporcional NO** — Stripe no devuelve nada de comisión sin importar el monto del refund.
- Si el cliente disputa el cargo después del reembolso (raro pero pasa), te cobran **$15 USD adicionales** por la disputa aunque ya hayas reembolsado.

### Ventana de tiempo para reembolsar

- Hasta **180 días** después del cargo original.
- Después de 180 días tienes que mandar el dinero por otro medio (transferencia bancaria) — el sistema de Stripe ya no acepta el refund.

---

## 9. Pagos "sin verificar" o pendientes

### Caso A: Cliente cerró la pestaña a medio pago

PaymentIntent quedó en `requires_payment_method` o `requires_action`. **No se cobró nada.** El intent expira solo en 24 horas. No tienes que hacer nada — el slot de la reserva sí se reserva mientras tanto (riesgo: alguien reserva pero no paga y el horario queda bloqueado).

**Mitigación recomendada en el plan:** un cron que cada 30 min cancele reservas con `status='pendiente_pago'` y más de 20 min sin actualizar.

### Caso B: Pago pasó por 3D Secure pero el banco no responde

Estado: `processing`. Esto se resuelve solo: el banco contesta en segundos o, máximo, en minutos. Si pasan más de 30 minutos sin respuesta, Stripe marca el pago como `failed`. **No le entregues servicio mientras dice processing.**

### Caso C: Pago dice "Succeeded" pero el cliente jura que no le llegó la confirmación

Casi siempre es el correo en spam o un email mal capturado. Verifica:
1. Dashboard Stripe → Payment → "Receipt" → "Resend".
2. En tu app: botón "Reenviar recibo" en `/admin/venta/:reservationId` que llama a `send-receipt` con el email correcto.

### Caso D: Pago "Succeeded" pero no aparece en mi balance todavía

Normal. Los fondos están **pendientes** los primeros **7 días** después de cada cargo. Esto es el "rolling reserve" estándar de Stripe MX. Después de 7 días el dinero pasa a "Available" y entra al ciclo de payouts.

### Caso E: Cliente dice "ya pagué" pero no aparece en mi dashboard

Pídele el último 4 de su tarjeta y el monto. Busca en Stripe **Payments → Search**. Si no aparece, casi seguro:
- Pagó en otro sistema (otra cuenta Stripe, otro restaurante con nombre parecido).
- O su pago quedó en `processing` y todavía no se confirma.

---

## 10. Disputas y chargebacks

Un **chargeback** = el cliente le dijo a su banco "no reconozco este cargo, devuélvame mi dinero". El banco le devuelve el dinero **al cliente inmediatamente** y abre una "disputa" para que tú demuestres que el cargo era legítimo.

### Costos

- **$15 USD** por disputa (los pierdes pase lo que pase).
- Si pierdes: pierdes el monto del cargo también.
- Si ganas: recuperas el monto pero **no** los $15 USD.

### Las 4 razones más comunes

| Razón | Qué dice el cliente | Cómo te defiendes |
|---|---|---|
| `fraudulent` | "No fui yo, robaron mi tarjeta." | Difícil de ganar. Aporta: IP del comprador, email confirmado, screenshot de la reserva, registro de asistencia al paseo. |
| `product_not_received` | "Pagué pero no me dieron el servicio." | Aporta: foto/video del cliente abordando, lista de pasajeros firmada, mensaje de WhatsApp confirmando. |
| `duplicate` | "Me cobraron dos veces lo mismo." | Aporta: los dos cargos son distintos (fechas, montos). Si fue duplicado real, reembolsa tú directamente, no esperes la disputa. |
| `subscription_canceled` | "Cancelé y siguieron cobrando." | No aplica — no usamos suscripciones. |

### Cómo responder a una disputa

1. Stripe te llega un email **"Disputa abierta"**.
2. Dashboard → **Disputes** → click en la disputa.
3. Sube evidencia (PDF, imágenes, texto):
   - Lista de pasajeros del día con la firma del cliente
   - Captura del WhatsApp confirmando la reserva
   - Foto del cliente a bordo (si la tienes)
   - Política de cancelación
4. Submit. Tienes **7–21 días** para responder dependiendo del tipo.
5. El banco del cliente decide en **30–75 días**. No hay manera de apurarlo.

### Prevenir disputas

- **Nombre del cargo claro**: configura tu "Statement descriptor" en Stripe a `BARCO PIRATA PP` para que el cliente reconozca el cargo en su estado de cuenta.
- **Recibo automático por correo**: ya lo tienes con `send-receipt`. Reduce el "no reconozco" sustancialmente.
- **Lista de pasajeros firmada** el día del paseo (incluso una foto del nombre + firma sirve).
- **Política de cancelación visible** en `/reservar`.

---

## 11. 3D Secure / SCA

**3D Secure (3DS)** es el código OTP que el banco le manda al cliente por SMS / app cuando paga. Stripe lo activa automáticamente en estos casos:

- El banco emisor lo requiere (común en tarjetas mexicanas).
- El monto es alto (>$3,000 MXN).
- El emisor sospecha fraude.

**No tienes que configurar nada** — Stripe.js maneja el modal automático. Solo asegúrate de que `automatic_payment_methods.enabled = true` en `create-payment-intent` (ya está así).

**SCA (Strong Customer Authentication)** = el nombre regulatorio europeo de lo mismo. Si tu cliente paga con tarjeta europea, también se activa.

### Por qué importa

Si el cliente pasa por 3DS y se aprueba: **la disputa por fraude (`fraudulent`) prácticamente la ganas automáticamente.** El banco emisor ya autenticó al cliente, así que la responsabilidad de cualquier fraude es del banco, no tuya. Esto se llama "liability shift".

---

## 12. El dashboard día a día

Lo que mirarías cada mañana, en orden:

| Sección | Para qué |
|---|---|
| **Home** | Total cobrado hoy / ayer / esta semana. Vistazo rápido. |
| **Payments → Succeeded** | Lista de pagos exitosos. Filtra por fecha. Concilia contra tus reservas en `/admin/reservaciones`. |
| **Payments → Failed** | Pagos que fallaron. Casi siempre tarjeta rechazada por el banco — no es problema tuyo, pero útil ver si hay un patrón (ej. todos los pagos de OXXO fallan). |
| **Disputes** | Si hay alguna disputa nueva. **Responder en menos de 7 días** o se pierde automático. |
| **Balance** | Cuánto tienes "pending" (cargos < 7 días) y "available" (listo para payout). |
| **Payouts** | Próximo depósito a tu banco. Cuándo, cuánto, qué cargos lo componen. |
| **Reports → Balance** | Para conciliación mensual con tu contador. Exportable a CSV. |

### Conciliación con tu contabilidad

Cada **payout** que llega a tu banco corresponde a **muchos cargos**. Stripe te da un CSV (`Reports → Balance → Export`) con:

- `Available on` — fecha del payout
- `Gross` — cargos brutos
- `Fees` — comisiones
- `Net` — lo que se depositó
- `Reporting Category` — refund / charge / dispute / payout

Tu contador necesita ese CSV. **No lo pierdas mensualmente.**

---

## 13. Multi-moneda MXN + USD

Tú elegiste cobrar en ambas. Esto implica:

### En `create-payment-intent`

El frontend manda `{ reservationId, currency }`. La Edge Function:
1. Lee la reserva.
2. **Calcula el monto** en la moneda correspondiente. Para esto necesitas pricing dual: tener `adultPrice_mxn` y `adultPrice_usd` en los paquetes, o un FX rate diario.
3. Pasa `currency: 'usd'` o `currency: 'mxn'` a Stripe.

### Pricing recomendado

No uses conversión automática. Define **precios independientes**:

```ts
PACKAGES.CON_COMIDA = {
  adultPrice_mxn: 700,
  adultPrice_usd: 39,   // ~equivalente con margen de FX
  ...
}
```

Razón: si el peso fluctúa, no quieres rehacer migraciones. Defines el USD pensando en un FX seguro (ej. 18 MXN/USD aunque hoy esté en 17).

### Cómo elige el cliente

Detección automática + override manual:
- Por defecto: si el idioma del navegador es `es-MX`, usa MXN. Si es `en` o `es-US`, usa USD.
- Botón toggle `MXN / USD` visible arriba del precio.
- Persistir elección en localStorage.

### Stripe Customer y moneda

**Un Customer puede tener cargos en varias monedas** — Stripe los maneja separados. No necesitas dos customers para el mismo cliente.

### Balance y payouts dual

Tu balance Stripe estará dividido:
- **Balance MXN** → se deposita a tu CLABE.
- **Balance USD** → se deposita a tu cuenta USD.

Si solo tienes CLABE MXN, Stripe convertirá el USD a MXN cobrándote +2% sobre el FX. Te conviene tener cuenta USD real.

---

## 14. Webhooks: por qué importan

Un webhook es la diferencia entre "creo que el cliente pagó" y "sé que el cliente pagó". Stripe te envía un POST HTTPS a tu endpoint con cada evento relevante.

### Eventos que escucharemos

| Evento | Cuándo ocurre | Qué hacer |
|---|---|---|
| `payment_intent.succeeded` | ✅ Cargo exitoso. | Marcar reserva como `pagada`, insertar `payment`, mandar recibo. |
| `payment_intent.payment_failed` | ❌ Cargo rechazado. | Marcar reserva como `pendiente_pago`. Quizá notificar admin. |
| `charge.refunded` | Reembolso emitido (por dashboard o por tu Edge Function). | Marcar `payments.status='reembolsado'`, reserva como `cancelada`. |
| `charge.dispute.created` | Cliente abrió disputa. | Notificación urgente al admin (email + WhatsApp). |
| `charge.dispute.closed` | Disputa cerrada. | Actualizar `payments` con resultado. |

### Verificación de firma

Stripe firma cada webhook con `STRIPE_WEBHOOK_SECRET`. **Si no verificas la firma, cualquiera puede hacerse pasar por Stripe y marcar reservas como pagadas.** Es el #1 bug de seguridad en integraciones con Stripe.

```ts
// En la Edge Function `stripe-webhook`:
const sig = req.headers.get('stripe-signature')!
const rawBody = await req.text()  // ⚠️ raw, NO req.json()
const event = await stripe.webhooks.constructEventAsync(
  rawBody,
  sig,
  Deno.env.get('STRIPE_WEBHOOK_SECRET')!
)
```

### Idempotencia

Stripe puede reintentar un webhook (red caída, timeout). Necesitas no procesar el mismo evento dos veces:

```sql
CREATE TABLE webhook_events_processed (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz DEFAULT now()
);
```

Al recibir webhook: `INSERT ... ON CONFLICT DO NOTHING`. Si ya existía, saltarlo.

---

## 15. Tarjetas de prueba útiles

Solo funcionan en **modo test**. CVC y fecha de expiración: cualquiera futura.

| Escenario | Número | Notas |
|---|---|---|
| ✅ Pago exitoso | `4242 4242 4242 4242` | Visa, sin 3DS. |
| 🔐 Pide 3D Secure | `4000 0025 0000 3155` | Visa, modal de autenticación aparece. |
| ❌ Tarjeta rechazada (genérico) | `4000 0000 0000 0002` | `card_declined`. |
| ❌ Fondos insuficientes | `4000 0000 0000 9995` | `insufficient_funds`. |
| ❌ Expirada | `4000 0000 0000 0069` | `expired_card`. |
| 🛡️ Disputa por fraude | `4000 0000 0000 0259` | Pago exitoso, luego dispara `charge.dispute.created`. Útil para probar el handler. |
| 🇲🇽 Visa México exitosa | `4000 0048 4000 8001` | Marcada como tarjeta mexicana — útil para probar regional pricing. |

Lista completa: [stripe.com/docs/testing](https://stripe.com/docs/testing).

---

## 16. Cuándo recibes el dinero (payouts)

### Calendario en México

| Día del cargo | Día que entra a tu balance | Día que se deposita en tu banco |
|---|---|---|
| Lunes | Pending hasta el siguiente lunes | Lunes + 1 día = Martes |

Resumen: **un cargo del lunes llega a tu cuenta el martes siguiente** (8 días).

Esto es porque Stripe MX tiene un "rolling reserve" de 7 días por defecto. Algunos negocios bien establecidos consiguen bajar esto a 2 días después de varios meses operando sin disputas.

### Configurar el payout

**Settings → Payouts → Schedule**. Opciones:
- **Automatic, daily** (default) — Stripe te deposita cada día lo disponible.
- **Automatic, weekly** — un día a la semana (más limpio para conciliación).
- **Manual** — tú lo disparas cuando quieras. Útil si tu contador prefiere lotes específicos.

**Recomendación para Barco Pirata:** weekly, los lunes. Así cada lunes tu contador ve un solo depósito y concilia toda la semana de un golpe.

---

## 17. Bloqueo de cuenta / fraude

Stripe puede pausar tu cuenta si detecta:
- Tasa de chargebacks > 1% (industria normal).
- Tasa de cargos rechazados > 10%.
- Volumen sospechoso (de $500/mes a $50,000/mes de un día para otro).
- Información del negocio inconsistente con el sitio web.

### Si te pausan

1. Email de Stripe explicando.
2. Te piden documentos o aclaraciones.
3. Tus payouts se detienen pero los cargos siguen procesándose.
4. Resuelves → todo vuelve normal.

### Si te cierran (raro pero pasa)

Stripe puede retener fondos hasta **120 días** para cubrir posibles disputas tardías. Si quedaste limpio, te lo devuelven todo.

**Prevenirlo:**
- Mantén el sitio actualizado (términos y privacidad visibles).
- No proceses cargos por servicios que no entregaste (ej. cobrar un paseo cancelado por mal clima — reembolsa).
- Notifica a Stripe si vas a tener un pico inusual de volumen (ej. promoción de verano).

---

## 18. Glosario

| Término | Significado |
|---|---|
| **PaymentIntent** | El objeto que representa la intención de cobrar. |
| **Charge** | El cobro real, generado cuando el intent llega a `succeeded`. |
| **Customer** | Cliente en Stripe (email + métodos de pago). |
| **PaymentMethod** | Tarjeta / OXXO voucher / etc. |
| **Webhook** | POST que Stripe envía a tu servidor con eventos. |
| **Signing secret** (`whsec_...`) | Clave para verificar la firma de los webhooks. |
| **3DS / SCA** | Autenticación adicional del cliente (OTP del banco). |
| **Idempotency key** | Identificador único para evitar duplicar requests. Usar UUID v4. |
| **MoR** (Merchant of Record) | Quien aparece como vendedor frente al fisco. Stripe NO es MoR — tú lo eres. (Lemon Squeezy o Paddle sí son MoR — útil cuando vendes a UE y no quieres lidiar con IVA por país. No es tu caso.) |
| **SCA** | Strong Customer Authentication (regulación europea, equivalente 3DS). |
| **Rolling reserve** | Período que Stripe retiene fondos antes del payout (7 días MX). |
| **Statement descriptor** | El nombre que el cliente ve en su estado de cuenta. Configúralo a algo reconocible (`BARCO PIRATA PP`). |
| **Liability shift** | Cuando una disputa por fraude la pierde el banco emisor (no tú), porque hubo 3DS. |
| **Idempotency** | Propiedad de que repetir una operación da el mismo resultado. Crítico en webhooks. |
| **Raw body** | El body de la request sin parsear. Necesario para verificar firma de webhook. |

---

## Referencias rápidas

- Dashboard: https://dashboard.stripe.com
- Test mode dashboard: https://dashboard.stripe.com/test
- API docs: https://stripe.com/docs/api
- Testing cards: https://stripe.com/docs/testing
- Pricing MX: https://stripe.com/mx/pricing
- Soporte: https://support.stripe.com (responden en horas hábiles, en español)
- Status (¿Stripe caído?): https://status.stripe.com

---

> **Próximo paso:** lee [`STRIPE_IMPLEMENTATION_PLAN.md`](./STRIPE_IMPLEMENTATION_PLAN.md) para el plan ordenado de cómo aterrizar esto en Barco Pirata desde el estado actual.
