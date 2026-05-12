# Bloque 15 — Manifiesto de Pasajeros (Capitanía)

## Objetivo
Capturar nombre + edad de cada pasajero por reservación (requerido por Capitanía de Puerto).
Permitir blancos, alertar al admin cuando el manifiesto esté incompleto el día del viaje,
y exportar lista consolidada del día a Excel.

## Reglas de negocio
- Filas = adults + youth + children + babies (bebés incluidos)
- **Completo** = full_name no vacío Y age no null (ambos requeridos)
- Alerta solo cuando reservation.date === hoy local
- Blancos permitidos (no bloqueante para confirmar/guardar)
- Captura disponible tanto en flujo público (ConfirmationPage) como en admin (SalePage)
- Excel: una hoja por día, lista plana de todos los pasajeros sin agrupar por reserva
  Columnas: # | Nombre | Edad | Tipo (adulto/adolescente/niño/bebé) | Horario

---

## Pasos de implementación

### ✅ PASO 1 — Migración + Vista + Tipos + Servicio + Hook
Archivo: `supabase/migrations/00014_passenger_manifest.sql`

```sql
CREATE TABLE reservation_passengers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  full_name      text,
  age            int,
  passenger_type text NOT NULL, -- 'adult' | 'youth' | 'child' | 'baby'
  position       int NOT NULL,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_passengers_reservation ON reservation_passengers(reservation_id);

-- Vista para saber si un manifiesto está completo sin N+1
CREATE VIEW reservation_manifest_status AS
SELECT
  r.id AS reservation_id,
  r.date,
  (r.adults + r.youth + r.children + r.babies) AS required,
  COUNT(p.id) FILTER (
    WHERE p.full_name IS NOT NULL AND p.full_name <> '' AND p.age IS NOT NULL
  ) AS filled,
  (r.adults + r.youth + r.children + r.babies) =
  COUNT(p.id) FILTER (
    WHERE p.full_name IS NOT NULL AND p.full_name <> '' AND p.age IS NOT NULL
  ) AS is_complete
FROM reservations r
LEFT JOIN reservation_passengers p ON p.reservation_id = r.id
GROUP BY r.id;

-- RLS
ALTER TABLE reservation_passengers ENABLE ROW LEVEL SECURITY;
-- público puede insertar/actualizar sus propios pasajeros (via reservation_id que ya poseen)
CREATE POLICY "passengers_insert_public" ON reservation_passengers
  FOR INSERT WITH CHECK (true);
CREATE POLICY "passengers_select_public" ON reservation_passengers
  FOR SELECT USING (true);
CREATE POLICY "passengers_update_public" ON reservation_passengers
  FOR UPDATE USING (true);
-- admin puede todo
CREATE POLICY "passengers_all_admin" ON reservation_passengers
  FOR ALL USING (auth.role() = 'authenticated');
```

Tipos en `src/types/index.ts`:
```ts
export type PassengerType = 'adult' | 'youth' | 'child' | 'baby';

export interface Passenger {
  id: string;
  reservationId: string;
  fullName: string | null;
  age: number | null;
  passengerType: PassengerType;
  position: number;
}

export interface ManifestStatus {
  reservationId: string;
  required: number;
  filled: number;
  isComplete: boolean;
}
```

Servicio: `src/services/passengerService.ts`
- `listByReservation(reservationId)` → `Passenger[]`
- `bulkUpsert(reservationId, rows: Omit<Passenger, 'id'>[])` → reemplaza lista completa (delete + insert)
- `getManifestStatusByDate(date: string)` → `ManifestStatus[]`

Hook: `src/hooks/usePassengers.ts`
- `usePassengers(reservationId)` — React Query, clave `['passengers', reservationId]`
- `useManifestStatusByDate(date)` — para DashboardPage y ReservationsPage

---

### ✅ PASO 2 — Componente reutilizable `PassengerListEditor`
Archivo: `src/components/admin/PassengerListEditor.tsx`

- Props: `reservationId`, `counts: { adults, youth, children, babies }`, `readOnly?`
- Renderiza N filas (N = suma de counts), una por pasajero
- Cada fila: Tipo (badge), Nombre (input text), Edad (input number 0-120)
- Botón "Guardar manifiesto" → llama `bulkUpsert`
- Indicador de progreso: "X / N pasajeros completos"
- Color verde si 100% completo, amarillo si parcial, rojo si 0%
- Usa clases admin CSS existentes (no Tailwind público)

---

### ✅ PASO 3 — Integrar en flujo público y admin

**`src/pages/public/ConfirmationPage.tsx`**
- Después del mensaje de confirmación, nueva sección "Lista de pasajeros (Capitanía)"
- Texto: "Puedes dejar en blanco lo que no sepas; el personal del muelle te pedirá completarlos."
- Usa `PassengerListEditor` con `readOnly=false`
- Solo mostrar si `reservationId` disponible en store

**`src/pages/admin/SalePage.tsx`**
- Nueva tarjeta "Manifiesto de pasajeros" debajo de la info principal
- Usa `PassengerListEditor`
- Visible siempre (no solo el día del viaje)

**`src/pages/admin/NewReservationPage.tsx`** y **`EditReservationPage.tsx`**
- Al cambiar conteo de pasajeros: ajustar filas del manifiesto
  (preservar posiciones existentes, agregar/quitar al final)
- Nota: solo mostrar editor si la reserva ya fue creada (tiene ID)

---

### ✅ PASO 4 — Alertas en DashboardPage + Filtro en ReservationsPage

**`src/pages/admin/DashboardPage.tsx`**
- Consultar `getManifestStatusByDate(hoy)`
- Banner ⚠️ al tope si hay reservas incompletas: "X reservación(es) con manifiesto incompleto hoy"
- Badge ⚠️ naranja en cada tarjeta de reserva con manifiesto incompleto
  Texto: "Manifiesto: Z / N pasajeros" 

**`src/pages/admin/ReservationsPage.tsx`**
- Nuevo filtro segmentado (chips) encima de la lista:
  `[Todas] [Completas ✓] [Incompletas ⚠️]`
- El conteo de cada chip visible: "Incompletas (3)"
- Filtro es client-side usando `useManifestStatusByDate`

---

### ✅ PASO 5 — ManifiestosPage + Export Excel

Archivo: `src/pages/admin/ManifiestosPage.tsx`
Ruta: `/admin/manifiestos`
Entrada sidebar: icono `ClipboardList` (lucide-react), label "Manifiestos"

Layout:
- Header con filtro de fecha (default hoy) + selector de horario (opcional)
- Tabla con todos los pasajeros del día filtrado:
  `# | Nombre | Edad | Tipo | Horario | Estado (completo/incompleto)`
- Contador: "X / N pasajeros con datos completos"
- Botón "Exportar a Excel (.xlsx)"

Export Excel (usando `xlsx` ya en el stack):
```
Hoja "Manifiesto YYYY-MM-DD"
Columnas: # | Nombre | Edad | Tipo | Horario
Filas vacías (sin nombre/edad) incluidas como filas en blanco
Ordenado por: horario ASC, position ASC
```

---

### ✅ PASO 6 — Ajustes al router y sidebar

**`src/app/router/index.tsx`**
```tsx
{ path: '/admin/manifiestos', element: <ManifiestosPage /> }
```

**`src/components/layout/AdminLayout.tsx`**
- Agregar entrada "Manifiestos" con `ClipboardList` icon después de "Reportes"

---

## Archivos nuevos
| Archivo | Descripción |
|---|---|
| `supabase/migrations/00014_passenger_manifest.sql` | Tabla + vista + RLS |
| `src/services/passengerService.ts` | CRUD pasajeros |
| `src/hooks/usePassengers.ts` | React Query hooks |
| `src/components/admin/PassengerListEditor.tsx` | Editor reutilizable |
| `src/pages/admin/ManifiestosPage.tsx` | Página manifiestos + export |

## Archivos modificados
| Archivo | Cambio |
|---|---|
| `src/types/index.ts` | Tipos `Passenger`, `PassengerType`, `ManifestStatus` |
| `src/app/router/index.tsx` | Ruta `/admin/manifiestos` |
| `src/components/layout/AdminLayout.tsx` | Entrada sidebar "Manifiestos" |
| `src/pages/public/ConfirmationPage.tsx` | Sección captura post-confirmación |
| `src/pages/admin/SalePage.tsx` | Tarjeta manifiesto |
| `src/pages/admin/DashboardPage.tsx` | Banner + badges de alerta |
| `src/pages/admin/ReservationsPage.tsx` | Filtro completas/incompletas |
| `src/pages/admin/NewReservationPage.tsx` | Ajuste filas al cambiar conteo |
| `src/pages/admin/EditReservationPage.tsx` | Ajuste filas al cambiar conteo |

## Notas de implementación
- Usar `localDateStr()` (ya existe en reservationStore) para comparar fecha hoy vs reservation.date
- `bulkUpsert` = DELETE WHERE reservation_id + INSERT batch (Supabase no tiene upsert por posición)
- Los tipos de pasajero se generan al crear filas: N filas 'adult', M filas 'youth', etc. en orden
- La vista `reservation_manifest_status` requiere RLS desactivado o política SELECT pública
- Migración pendiente previa: `00013_packages_and_promotions.sql` (PaquetesPage, Bloque 14)

## Estado — BLOQUE 15 COMPLETADO (2026-05-12)

- ✅ PASO 1: migración `00014_passenger_manifest` aplicada en Supabase (`foaimrzqvsgiffmvyebr`)
- ✅ PASO 2: `PassengerListEditor` componente reutilizable
- ✅ PASO 3: `ConfirmationPage` (público) + `SalePage` (admin) integrados
- ✅ PASO 4: banner + badges en `DashboardPage`; filtro manifiesto en `ReservationsPage`
- ✅ PASO 5+6: `ManifiestosPage` + export Excel + ruta + sidebar
