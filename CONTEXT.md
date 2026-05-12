# Barco Pirata — Contexto del Proyecto

## Descripción

Sistema de reservaciones para **Barco Pirata de Puerto Peñasco**, Sonora. Permite a clientes reservar paseos en barco con selección de paquetes de comida/bebidas, y a los administradores gestionar la operación diaria, pagos y reportes.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript strict |
| Estilos | Tailwind CSS (paleta navy/gold/pirate) + globals.css |
| Estado servidor | React Query v5 |
| Estado cliente | Zustand (`src/app/store/reservationStore.ts`) |
| Formularios | React Hook Form + Zod |
| Backend / BD | Supabase (PostgreSQL + RLS + Edge Functions) |
| i18n | i18next — ES (default) / EN, solo páginas públicas |
| Reportes | jsPDF + xlsx |

---

## Modelo de datos principal

### Tabla `reservations`

```
id                uuid PK
contact_name      text
contact_phone     text
contact_email     text nullable
date              date
time              time
number_of_people  int          -- capacidad: adults + youth + children (sin bebés)
adults            int          -- 18+ años
youth             int          -- 12-17 años
children          int          -- 3-11 años (paquete NINOS fijo $300)
babies            int          -- 1-3 años, gratis, no cuentan para capacidad
total_passengers  int          -- adults + youth + children + babies (calculado en DB)
adults_cost       numeric      -- suma de adultos en todos sus paquetes
youth_cost        numeric      -- suma de adolescentes en todos sus paquetes
children_cost     numeric      -- children × $300
package_id        enum         -- paquete dominante (el de mayor cantidad de personas)
package_breakdown jsonb        -- desglose completo por paquete (ver abajo)
service_type      text         -- 'individual' | 'grupal' (grupal si >= 10 pax)
subtotal          numeric
discount          numeric
total             numeric
status            enum         -- pendiente | confirmada | pagada | cancelada
payment_method    enum         -- efectivo | transferencia
payment_id        uuid FK
notes             text nullable
```

### `package_breakdown` — estructura JSON

Almacena cuántas personas eligió cada paquete. Solo incluye paquetes con al menos un pasajero.

```jsonc
[
  {
    "packageId": "CON_COMIDA",
    "adults": 2,
    "adultPrice": 700,
    "youth": 1,
    "youthPrice": 500,
    "total": 1900
  },
  {
    "packageId": "SOLO_BEBIDAS",
    "adults": 1,
    "adultPrice": 600,
    "youth": 0,
    "youthPrice": 400,
    "total": 600
  },
  {
    "packageId": "NINOS",
    "adults": 0,
    "adultPrice": 0,
    "youth": 0,
    "youthPrice": 0,
    "children": 3,
    "childrenPrice": 300,
    "total": 900
  }
]
```

> `package_id` (columna simple) guarda el paquete dominante para compatibilidad con filtros SQL. La fuente de verdad del desglose es siempre `package_breakdown`.

---

## Paquetes y precios

| ID | Nombre | Adultos (18+) | Adolescentes (12-17) |
|---|---|---|---|
| `CON_COMIDA` | Cena y Barra Libre | $700 | $500 |
| `SOLO_BEBIDAS` | Cena o Barra Libre | $600 | $400 |
| `NINOS` | Paquete Niños (3-11) | — | — |

- **Niños (3-11):** paquete único fijo $300/persona, siempre bajo `NINOS`
- **Bebés (1-3):** gratis, no ocupan lugar de capacidad
- Una misma reservación puede mezclar paquetes (p. ej. 2 adultos en CON_COMIDA + 1 adulto en SOLO_BEBIDAS + 3 niños)

---

## Reglas de negocio

| Regla | Valor |
|---|---|
| Capacidad del barco | 40 personas (adults + youth + children) |
| Anticipación máxima | 90 días |
| Rate limiting público | 3 reservas por teléfono por hora |
| Servicio grupal | ≥ 10 personas |
| Día de cierre semanal | Configurable en `business_settings` |
| Horarios disponibles | Configurables en `business_settings` |

---

## Flujo de reservación pública

```
/reservar
  Paso I   → Selección de tripulación por paquete (tabla paquete × grupo de edad)
  Paso II  → Fecha (selector 7 días) + Horario (disponibilidad en tiempo real)
  Paso III → Datos de contacto (nombre, teléfono, email, notas)
  Submit   → crea reservación en BD con status 'pendiente'

/reservar/confirmacion
  → muestra desglose completo (lee pkgBreakdown de Zustand)
  → opciones: ir a pago, descargar comprobante, contactar por WhatsApp

/pago/:reservationId
  → efectivo: confirma y marca 'pagada'
  → transferencia: guarda referencia, queda pendiente de confirmación admin

/recibo/:reservationId
  → recibo final con resumen de la reservación
```

---

## Panel admin

| Ruta | Función |
|---|---|
| `/admin` | Dashboard: reservas del día, métricas, lista rápida |
| `/admin/reservaciones` | Lista completa por fecha, filtros, acciones |
| `/admin/venta/nueva` | Crear reservación walk-in (sin rate limit ni anticipación mínima) |
| `/admin/venta/:id` | Detalle de reservación: confirmar pago, editar, cancelar |
| `/admin/reportes` | Reportes diarios y por rango, gráficas, exportar Excel/PDF |
| `/admin/ajustes` | Configurar capacidad, horarios activos, día de cierre |
| `/admin/horarios` | Gestión de fechas cerradas |
| `/admin/bitacora` | Audit log de acciones admin |
| `/admin/respaldo` | Backup de datos |

---

## Reportes — lógica de `byPackage`

El desglose por paquete en reportes itera sobre `package_breakdown` de cada reservación (cuando existe) para acumular count y revenue por paquete de forma correcta. Para reservaciones antiguas sin `package_breakdown`, usa el `packageId` dominante como fallback.

```
byPackage[packageId].count   += 1 por cada paquete en el breakdown
byPackage[packageId].revenue += item.total (monto real del paquete)
```

---

## Migraciones aplicadas (orden)

| Archivo | Cambio |
|---|---|
| `00001_initial_schema.sql` | Esquema base: reservations, payments, audit_log |
| `00002_triggers_and_functions.sql` | Triggers updated_at, auditoría, daily_report() |
| `00003_row_level_security.sql` | Políticas RLS |
| `00004_security_hardening.sql` | Endurecimiento de seguridad |
| `00005_capacity_validation.sql` | Validación de capacidad del barco (40 pax) |
| `00006_reservation_email.sql` | Columna contact_email |
| `00007_rate_limiting.sql` | check_phone_rate_limit() — max 3/hora por teléfono |
| `00008_business_settings.sql` | Tabla business_settings (horarios, capacidad dinámica) |
| `00009_closed_dates_dynamic_settings.sql` | Fechas cerradas dinámicas |
| `00010_fix_idor_rls.sql` | Parche RLS para IDOR |
| `00011_payment_method_transferencia.sql` | Método transferencia (reemplaza tarjeta) |
| `00012_package_breakdown.sql` | Columna package_breakdown jsonb |

---

## Supabase

- **Proyecto:** `barco-pirata` (ID: `foaimrzqvsgiffmvyebr`, región `us-west-1`)
- **RLS activo** en todas las tablas públicas
- Clientes anónimos pueden insertar reservaciones y leer la propia por UUID
- Staff autenticado tiene acceso completo a reservaciones y pagos
- Solo admins leen el audit_log

---

## Variables de entorno requeridas

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENV=development
```
