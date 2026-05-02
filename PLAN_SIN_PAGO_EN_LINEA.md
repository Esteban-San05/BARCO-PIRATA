# Plan: Flujo sin pago en línea — Reserva + Notificación + Pago en oficina

**Fecha:** 2026-04-25  
**Estado:** Pendiente de implementación  
**Decisión:** Reunión con cliente confirmó que el barco no zarpa con menos de 30 personas.  
Para evitar reembolsos constantes se elimina el pago en línea (Stripe) del flujo público.  
Todo el cobro se hace presencialmente. El cliente se presenta 2 horas antes del paseo.

---

## Flujo nuevo (resumido)

```
Cliente reserva en /reservar
        ↓
Sistema guarda la reserva (status = "pendiente")
        ↓
┌────────────────────────────────────┐
│ Notificaciones automáticas         │
│  • Email de confirmación al cliente│
│  • WhatsApp/email a la admin       │
└────────────────────────────────────┘
        ↓
Cliente ve /reservar/confirmacion
"Tu reserva fue recibida. Preséntate
 2 h antes en la oficina para pagar."
        ↓
Admin monitorea el dashboard por slot
"Slot 15:00 — 22/30 personas"
        ↓
Cuando llegan ≥ 30 personas: admin confirma el viaje
        ↓
Clientes llegan, pagan en oficina
Admin cambia status a "pagada" desde /admin/venta/:id
```

---

## Cambios por área

---

### 1. Constantes

**Archivo:** `src/constants/index.ts`

Agregar la constante de mínimo de personas para zarpar:

```typescript
// Antes solo existía:
export const BOAT_CAPACITY = 40

// Agregar:
export const MIN_SAILING_CAPACITY = 30
```

---

### 2. Base de datos

**Archivo nuevo:** `supabase/migrations/00011_add_min_capacity.sql`

Agregar `minimum_capacity` a la tabla `business_settings` para que la admin
pueda modificarlo desde el panel de ajustes sin tocar código:

```sql
alter table public.business_settings
  add column if not exists minimum_capacity integer not null default 30
    check (minimum_capacity > 0 and minimum_capacity <= boat_capacity);
```

**Archivo:** `src/types/index.ts`  
Agregar el campo al tipo `BusinessSettings`:

```typescript
// Agregar dentro de BusinessSettings:
minimumCapacity: number
```

**Archivo:** `src/features/settings/services/settingsService.ts`  
Mapear el nuevo campo al leer y guardar ajustes.

---

### 3. Flujo público — eliminar pago en línea

#### 3a. ReservationPage (`src/pages/public/ReservationPage.tsx`)

- **Línea 14:** eliminar el import de `receiptService` (ya no se llama al enviar el form)
- **Líneas 98–101:** reemplazar la llamada a `receiptService.send()` por la nueva Edge Function  
  `notify-new-reservation` que hace dos cosas a la vez: email al cliente + WhatsApp a la admin
- **Línea 103:** la navegación a `/reservar/confirmacion` se mantiene igual

El formulario en sí **no cambia**: mismos pasos, mismos campos, mismo botón de envío.  
El precio estimado sigue mostrándose (sirve de referencia para el cliente).

#### 3b. ConfirmationPage (`src/pages/public/ConfirmationPage.tsx`)

Esta página actualmente es un resumen previo al pago. Cambia completamente su propósito:

- **Eliminar:** botón "Continuar al pago" y cualquier referencia a Stripe
- **Mostrar:**
  - Resumen de la reserva (fecha, hora, paquete, personas, total estimado)
  - Mensaje claro: _"Tu reserva fue recibida. Para confirmar tu lugar, preséntate 2 horas antes del paseo en nuestra oficina en el Recinto Portuario para pagar."_
  - Número de teléfono de la empresa para dudas
  - Botón "Guardar en calendario" (opcional, genera un .ics)
  - Botón "Compartir por WhatsApp" (abre `wa.me` con los detalles, para que el cliente los comparta con su grupo)

#### 3c. PaymentPage (`src/pages/public/PaymentPage.tsx`)

- **No se elimina el archivo** — se mantiene oculto del flujo público
- La ruta `/pago/:id` queda disponible solo para uso interno si en el futuro se reactiva
- Se elimina del `router/index.tsx` el enlace desde ConfirmationPage

#### 3d. ReceiptPage (`src/pages/public/ReceiptPage.tsx`)

- Renombrar conceptualmente a "Comprobante de reserva"
- Eliminar sección de método de pago y estado de pago del HTML generado
- Puede seguir usándose desde el panel admin cuando el admin quiere imprimir el recibo final

---

### 4. Notificaciones automáticas

#### 4a. Nueva Edge Function: `notify-new-reservation`

**Archivo nuevo:** `supabase/functions/notify-new-reservation/index.ts`

Se dispara desde el frontend justo después de crear la reserva.  
Hace dos cosas en paralelo:

**A) Email de confirmación al cliente**  
Usa la misma infraestructura de Resend que ya tiene `send-receipt`.  
Contenido del email:
- Encabezado: "¡Tu reserva en Barco Pirata fue recibida!"
- Tabla con: fecha, hora, paquete, personas, total estimado
- Instrucción destacada: "Llega 2 horas antes a nuestra oficina para confirmar y pagar"
- Dirección y teléfono de la empresa
- Folio (UUID de la reserva)

**B) Notificación a la admin (WhatsApp o email)**  
Dos opciones en orden de prioridad:

*Opción 1 — WhatsApp vía Twilio (si `TWILIO_ACCOUNT_SID` está configurado):*
```
🚢 Nueva reserva en Barco Pirata

👤 Pedro Ramírez
📞 6381234567
📅 Sábado 2 de mayo · 15:00
👥 6 personas
📦 Con Comida
💰 Total estimado: $2,430

Ver en el panel: https://barco-pirata.com/admin
```

*Opción 2 — Email a la admin (si no hay Twilio configurado):*  
Usa Resend, mismo diseño que el email al cliente pero con el mensaje orientado a la admin.

**Variables de entorno necesarias:**
```
ADMIN_WHATSAPP_NUMBER   = "521638XXXXXXX"   ← número de la admin con código de país
TWILIO_ACCOUNT_SID      = "ACxxxxxx"        ← opcional
TWILIO_AUTH_TOKEN       = "xxxxxxx"         ← opcional
TWILIO_WHATSAPP_FROM    = "whatsapp:+14155238886"  ← sandbox Twilio o número aprobado
ADMIN_EMAIL             = "admin@barcopirata.com"   ← fallback si no hay Twilio
```

**Flujo interno de la función:**
```
1. Recibe { reservationId }
2. Lee la reserva con service_role_key
3. En paralelo:
   a. Envía email al cliente (contact_email)
   b. Si TWILIO_ACCOUNT_SID existe → envía WhatsApp a ADMIN_WHATSAPP_NUMBER
      Si no → envía email a ADMIN_EMAIL
4. Retorna { clientEmailSent, adminNotified }
```

#### 4b. Nuevo servicio en frontend

**Archivo nuevo:** `src/features/reservations/services/notificationService.ts`

```typescript
export const notificationService = {
  async notifyNewReservation(reservationId: string): Promise<void> {
    await supabase.functions.invoke('notify-new-reservation', {
      body: { reservationId },
    })
  }
}
```

---

### 5. Panel admin — indicador de mínimo por slot

**Archivo:** `src/pages/admin/DashboardPage.tsx`

El dashboard actualmente muestra KPIs del día completo (líneas 22–29).  
Se agrega una sección de **progreso por slot** debajo de los KPIs.

**Diseño propuesto:**

```
SALIDAS DEL DÍA
┌─────────────────────────────────────────────────┐
│ 09:00   ████████░░░░░░░░  18/30  ⚠ Falta cupo  │
│ 11:00   ████████████████  32/30  ✓ Listo        │
│ 13:00   ██░░░░░░░░░░░░░░   8/30  ✗ Pocas person │
│ 15:00   ─────────────────   0/30  Sin reservas   │
└─────────────────────────────────────────────────┘
```

Lógica de colores:
- `< 30 personas` → amarillo / advertencia
- `>= 30 personas` → verde / listo para zarpar
- `0 personas` → gris / sin actividad

**Cómo obtener el dato:**  
Agrupar las reservaciones ya cargadas (`data.data`) por campo `time` y sumar `numberOfPeople`.  
No requiere nueva query — los datos ya están en `useReservationsByDate(selectedDate)`.

**KPI "Personas embarcadas"** (línea 74):  
Cambiar el hint de `"Capacidad: 40 por salida"` a `"Mínimo para zarpar: 30"`.

---

### 6. Panel admin — ajustes

**Archivo:** `src/pages/admin/AdminSettingsPage.tsx`

Agregar un campo editable para `minimum_capacity`:
- Input numérico con rango 1–40
- Label: "Mínimo de personas para zarpar"
- Se guarda en `business_settings.minimum_capacity`

Esto permite que en el futuro la admin ajuste el mínimo sin tocar código.

---

### 7. Router

**Archivo:** `src/app/router/index.tsx`

- Ruta `/reservar/confirmacion`: se mantiene, solo cambia el contenido de la página
- Ruta `/pago/:id`: se deja en el router pero se elimina cualquier navegación automática hacia ella desde el flujo público
- Ruta `/recibo/:id`: se mantiene, se usa desde el panel admin

---

### 8. Stripe

**No se elimina Stripe del proyecto.** Razones:
- El panel admin seguirá necesitando registrar pagos (en `SalePage` el admin marca la reserva como pagada)
- Podría reactivarse en el futuro
- La Edge Function `create-payment-intent` se deja en su lugar

**Sí se elimina:**
- El import de `@stripe/react-stripe-js` de `PaymentPage` no se toca (página queda dormida)
- El botón "Pagar con tarjeta" desaparece del flujo público al redibujar `ConfirmationPage`

---

## Resumen de archivos a crear o modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/constants/index.ts` | Modificar | Agregar `MIN_SAILING_CAPACITY = 30` |
| `src/types/index.ts` | Modificar | Agregar `minimumCapacity` a `BusinessSettings` |
| `supabase/migrations/00011_add_min_capacity.sql` | Crear | Columna `minimum_capacity` en `business_settings` |
| `src/features/settings/services/settingsService.ts` | Modificar | Mapear `minimum_capacity` |
| `src/pages/public/ReservationPage.tsx` | Modificar | Reemplazar `receiptService` por `notificationService` |
| `src/pages/public/ConfirmationPage.tsx` | Modificar | Eliminar flujo de pago, mostrar instrucciones de presentación |
| `src/features/reservations/services/notificationService.ts` | Crear | Llama a la Edge Function `notify-new-reservation` |
| `supabase/functions/notify-new-reservation/index.ts` | Crear | Email al cliente + WhatsApp/email a la admin |
| `src/pages/admin/DashboardPage.tsx` | Modificar | Agregar sección de progreso por slot (X/30) |
| `src/pages/admin/AdminSettingsPage.tsx` | Modificar | Agregar campo editable de mínimo de personas |

**Archivos que NO cambian:**
- `PaymentPage.tsx` — queda dormido, no se elimina
- `ReceiptPage.tsx` — queda para uso admin
- `reservationService.ts` — sin cambios
- Migraciones existentes — sin cambios
- Edge Function `create-payment-intent` — sin cambios
- Edge Function `send-receipt` — sin cambios (se sigue usando para recibos admin)

---

## Variables de entorno nuevas necesarias

Agregar al `.env.local` y configurar en Supabase Dashboard → Edge Functions → Secrets:

```env
ADMIN_EMAIL=admin@barcopirata.com
ADMIN_WHATSAPP_NUMBER=521638XXXXXXX

# Solo si se usa Twilio:
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

## Orden de implementación recomendado

1. Migración DB (`00011`) + tipos + constantes — base sin romper nada
2. Edge Function `notify-new-reservation` — se puede probar en aislado
3. `notificationService.ts` + cambio en `ReservationPage.tsx`
4. Rediseño de `ConfirmationPage.tsx`
5. Dashboard — sección de slots con progreso
6. AdminSettingsPage — campo de mínimo editable
