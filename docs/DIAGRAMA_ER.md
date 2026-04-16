# 🗺️ Diagrama Entidad-Relación — Barco Pirata

> Modelo lógico de la base de datos. Se renderiza automáticamente en GitHub / VS Code con preview Mermaid.

---

## 1. Diagrama Mermaid (renderiza en GitHub)

```mermaid
erDiagram
    AUTH_USERS ||--|| USER_PROFILES : "extiende"
    USER_PROFILES ||--o{ RESERVATIONS : "created_by"
    USER_PROFILES ||--o{ PAYMENTS : "processed_by"
    RESERVATIONS ||--o{ PAYMENTS : "tiene"
    RESERVATIONS ||--o{ AUDIT_LOG : "auditada"
    PAYMENTS ||--o{ AUDIT_LOG : "auditado"
    AUTH_USERS ||--o{ AUDIT_LOG : "ejecutada por"

    AUTH_USERS {
        uuid id PK
        text email
        text encrypted_password
        timestamptz email_confirmed_at
        timestamptz created_at
    }

    USER_PROFILES {
        uuid id PK_FK "FK auth.users"
        text email UK "único"
        text full_name
        user_role role "admin|vendedor"
        timestamptz created_at
        timestamptz updated_at
    }

    RESERVATIONS {
        uuid id PK
        text contact_name
        text contact_phone
        date date
        time time
        int number_of_people "CHECK 1-50"
        package_id package_id "CON_COMIDA|SOLO_BEBIDAS|SOLO_PASEO"
        text service_type "individual|grupal"
        numeric subtotal "≥ 0"
        numeric discount "≥ 0"
        numeric total "≥ 0"
        reservation_status status "pendiente|confirmada|pagada|cancelada"
        payment_method payment_method "efectivo|tarjeta (nullable)"
        uuid payment_id "nullable"
        text notes
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    PAYMENTS {
        uuid id PK
        uuid reservation_id FK "ON DELETE CASCADE"
        payment_method method
        numeric amount "≥ 0"
        payment_status status "pendiente|completado|fallido|reembolsado"
        text stripe_payment_intent_id "nullable"
        text receipt_url "nullable"
        timestamptz processed_at
        uuid processed_by FK
        timestamptz created_at
    }

    AUDIT_LOG {
        uuid id PK
        uuid user_id FK
        text user_email
        text action "INSERT|UPDATE|DELETE|LOGIN"
        text table_name
        uuid record_id
        jsonb old_values
        jsonb new_values
        text ip_address
        text user_agent
        timestamptz created_at
    }
```

---

## 2. Cardinalidades

| Relación | Cardinalidad | Descripción |
|----------|--------------|-------------|
| `auth.users` — `user_profiles` | **1 : 1** | Cada usuario del sistema tiene exactamente un perfil con rol. |
| `user_profiles` — `reservations` | **1 : N** *(opcional)* | Un staff puede crear muchas reservaciones. `created_by` es `NULL` para clientes anónimos. |
| `user_profiles` — `payments` | **1 : N** *(opcional)* | Un vendedor procesa muchos pagos (en efectivo principalmente). |
| `reservations` — `payments` | **1 : N** | Una reserva puede tener varios intentos de pago (fallido → exitoso). En la práctica, solo uno queda `completado`. |
| `reservations` — `audit_log` | **1 : N** | Cada modificación sobre la reserva deja un registro (INSERT + N UPDATE + opcionalmente DELETE). |
| `payments` — `audit_log` | **1 : N** | Idem para pagos. |

---

## 3. Integridad referencial

| FK | Tabla destino | `ON DELETE` | Motivo |
|----|---------------|-------------|--------|
| `user_profiles.id` → `auth.users(id)` | auth | **CASCADE** | Si se elimina el usuario de Auth, se limpia el perfil. |
| `reservations.created_by` → `auth.users(id)` | auth | **NO ACTION** (default) | Conservar histórico aunque el staff ya no exista. |
| `payments.reservation_id` → `reservations(id)` | public | **CASCADE** | Si se elimina la reserva (solo admin), se eliminan sus pagos. |
| `payments.processed_by` → `auth.users(id)` | auth | **NO ACTION** | Conservar quién cobró aunque el usuario ya no exista. |
| `audit_log.user_id` → `auth.users(id)` | auth | **NO ACTION** | El log es inmutable por auditoría. |

---

## 4. Normalización

### 4.1 Primera Forma Normal (1FN)
✅ **Cumple.**
- Todos los atributos contienen valores atómicos (no hay listas ni objetos embebidos salvo `old_values`/`new_values` en `audit_log`, donde el JSONB es semánticamente correcto para una bitácora).
- Cada fila tiene una clave primaria (UUID).

### 4.2 Segunda Forma Normal (2FN)
✅ **Cumple.**
- Todas las tablas usan **claves primarias simples** (UUID), por lo que no hay dependencias parciales.

### 4.3 Tercera Forma Normal (3FN)
✅ **Cumple.**
- En `reservations` no se almacenan datos que dependan del paquete (el precio del paquete vive en `src/constants/index.ts` y se calcula al vuelo).
- No hay dependencias transitivas: `total = subtotal - discount`, pero se almacena porque forma parte del **snapshot contable** del momento del cobro (si cambia el precio del paquete en el futuro, las reservas anteriores mantienen su total original).

### 4.4 Justificación de la denormalización intencional

| Campo | Tabla | ¿Por qué se guarda en lugar de calcularse? |
|-------|-------|--------------------------------------------|
| `subtotal`, `discount`, `total` | reservations | Snapshot fiscal. Si cambia la tarifa no deben mutar las reservas pasadas. |
| `payment_method` | reservations | Rápido filtrado para reportes diarios por método (evita `JOIN payments`). |
| `user_email` | audit_log | Queda aunque se borre el usuario. |
| `old_values`/`new_values` | audit_log | JSONB completo para reconstrucción total post-mortem. |

---

## 5. Índices

```sql
-- reservations
idx_reservations_date    ON (date)
idx_reservations_status  ON (status)
idx_reservations_phone   ON (contact_phone)

-- payments
idx_payments_reservation ON (reservation_id)
idx_payments_status      ON (status)

-- audit_log
idx_audit_log_created    ON (created_at DESC)
idx_audit_log_user       ON (user_id)
idx_audit_log_table      ON (table_name)
```

**Criterios:** campos usados en filtros (`WHERE`) y ordenamientos (`ORDER BY`) de las consultas más frecuentes:
- Dashboard: `WHERE date = CURRENT_DATE AND status = 'pagada'` → usa `idx_reservations_date`.
- Búsqueda por teléfono en venta presencial → usa `idx_reservations_phone`.
- Auditoría reciente: `ORDER BY created_at DESC LIMIT 100` → usa `idx_audit_log_created`.

---

## 6. Tipos enumerados (ENUM)

```sql
reservation_status = ('pendiente', 'confirmada', 'pagada', 'cancelada')
payment_method     = ('efectivo', 'tarjeta')
payment_status     = ('pendiente', 'completado', 'fallido', 'reembolsado')
user_role          = ('admin', 'vendedor')
package_id         = ('CON_COMIDA', 'SOLO_BEBIDAS', 'SOLO_PASEO')
```

**Ventajas vs. `TEXT` + `CHECK`:**
- Ocupan menos espacio (4 bytes vs. longitud del texto).
- El motor rechaza valores inválidos a nivel de tipo (no a nivel de constraint).
- TypeScript puede generar uniones literales equivalentes vía `generate_typescript_types`.

---

## 7. Restricciones CHECK

| Tabla | Columna(s) | Restricción |
|-------|-----------|-------------|
| reservations | `number_of_people` | `BETWEEN 1 AND 50` |
| reservations | `service_type` | `IN ('individual','grupal')` |
| reservations | `subtotal`, `discount`, `total` | `>= 0` |
| payments | `amount` | `>= 0` |

---

## 8. Vista textual (diagrama ASCII)

Para cuando Mermaid no esté disponible (ej. impresiones a papel):

```
┌────────────────────────────┐           ┌─────────────────────────┐
│       auth.users           │  1     1  │     user_profiles       │
│────────────────────────────│◄──────────│─────────────────────────│
│ id (UUID) PK               │           │ id (UUID) PK, FK        │
│ email                      │           │ email UK                │
│ encrypted_password         │           │ full_name               │
│ email_confirmed_at         │           │ role (ENUM user_role)   │
│ ...                        │           │ created_at · updated_at │
└────────────────────────────┘           └─────────────────────────┘
          │                                        │
          │ 1..N created_by                        │ 1..N processed_by
          ▼                                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                         reservations                              │
│──────────────────────────────────────────────────────────────────│
│  id                  UUID PK                                      │
│  contact_name        text NOT NULL                                │
│  contact_phone       text NOT NULL                                │
│  date · time         DATE · TIME                                  │
│  number_of_people    INT CHECK 1-50                               │
│  package_id          ENUM package_id                              │
│  service_type        'individual' | 'grupal'                      │
│  subtotal · discount · total  NUMERIC(10,2) CHECK ≥ 0             │
│  status              ENUM reservation_status                      │
│  payment_method      ENUM payment_method (nullable)               │
│  payment_id          UUID nullable                                │
│  notes               text                                         │
│  created_by          UUID FK → auth.users                         │
│  created_at · updated_at   timestamptz                            │
└──────────────────────────────────────────────────────────────────┘
          │
          │ 1..N reservation_id
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                            payments                               │
│──────────────────────────────────────────────────────────────────│
│  id                     UUID PK                                   │
│  reservation_id         UUID FK CASCADE → reservations            │
│  method                 ENUM payment_method                       │
│  amount                 NUMERIC(10,2) CHECK ≥ 0                   │
│  status                 ENUM payment_status                       │
│  stripe_payment_intent_id  text nullable                          │
│  receipt_url            text nullable                             │
│  processed_at           timestamptz nullable                      │
│  processed_by           UUID FK → auth.users                      │
│  created_at             timestamptz                               │
└──────────────────────────────────────────────────────────────────┘

               ┌──────────────────────────────────────────┐
   Triggers    │   INSERT / UPDATE / DELETE  ────────►    │
   automáticos │   sobre reservations y payments          │
               └─────────────────┬────────────────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │      audit_log         │
                    │────────────────────────│
                    │ id UUID PK             │
                    │ user_id FK             │
                    │ user_email             │
                    │ action                 │
                    │ table_name             │
                    │ record_id              │
                    │ old_values JSONB       │
                    │ new_values JSONB       │
                    │ ip_address             │
                    │ user_agent             │
                    │ created_at             │
                    └────────────────────────┘
```

---

## 9. Métricas del modelo

| Métrica | Valor |
|---------|-------|
| Tablas en `public` | 4 |
| Tablas en `auth` (Supabase) | 10+ (gestionadas) |
| Enums personalizados | 5 |
| Triggers | 5 (2 updated_at + 2 audit + base) |
| Funciones PL/pgSQL | 5 (`set_updated_at`, `audit_trigger`, `daily_report`, `is_staff`, `is_admin`) |
| Políticas RLS | 13 |
| Índices secundarios | 8 |
| CHECK constraints | 6 |

---

*Fuente: migraciones 00001 a 00004. Última actualización: abril 2026.*
