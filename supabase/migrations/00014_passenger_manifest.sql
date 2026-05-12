-- ─── Tabla de pasajeros por reservación (Capitanía) ─────────────────────────
CREATE TABLE IF NOT EXISTS reservation_passengers (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid        NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  full_name      text,                    -- nullable: se permite dejar vacío
  age            int,                     -- nullable: requerido para considerar completo
  passenger_type text        NOT NULL,    -- 'adult' | 'youth' | 'child' | 'baby'
  position       int         NOT NULL,    -- orden 1..N dentro de la reserva
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_passenger_type CHECK (passenger_type IN ('adult', 'youth', 'child', 'baby')),
  CONSTRAINT chk_age_range       CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
  CONSTRAINT uq_reservation_position UNIQUE (reservation_id, position)
);

CREATE INDEX IF NOT EXISTS idx_passengers_reservation
  ON reservation_passengers(reservation_id);

CREATE INDEX IF NOT EXISTS idx_passengers_date
  ON reservation_passengers(reservation_id)
  INCLUDE (full_name, age);

-- ─── Vista: estado del manifiesto por reservación ────────────────────────────
-- Permite saber si un manifiesto está completo sin queries N+1
CREATE OR REPLACE VIEW reservation_manifest_status AS
SELECT
  r.id                                              AS reservation_id,
  r.date,
  r.time,
  (r.adults + r.youth + r.children + r.babies)      AS required,
  COUNT(p.id) FILTER (
    WHERE p.full_name IS NOT NULL
      AND p.full_name <> ''
      AND p.age IS NOT NULL
  )                                                 AS filled,
  (r.adults + r.youth + r.children + r.babies) =
    COUNT(p.id) FILTER (
      WHERE p.full_name IS NOT NULL
        AND p.full_name <> ''
        AND p.age IS NOT NULL
    )                                               AS is_complete
FROM reservations r
LEFT JOIN reservation_passengers p ON p.reservation_id = r.id
GROUP BY r.id, r.date, r.time, r.adults, r.youth, r.children, r.babies;

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE reservation_passengers ENABLE ROW LEVEL SECURITY;

-- Público (anon): puede insertar, leer y actualizar pasajeros
-- (los clientes solo conocen su reservation_id, datos de baja sensibilidad)
CREATE POLICY "passengers_anon_select" ON reservation_passengers
  FOR SELECT USING (true);

CREATE POLICY "passengers_anon_insert" ON reservation_passengers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "passengers_anon_update" ON reservation_passengers
  FOR UPDATE USING (true);

-- Solo admin autenticado puede eliminar (el bulkUpsert del servicio usa DELETE)
CREATE POLICY "passengers_auth_delete" ON reservation_passengers
  FOR DELETE USING (auth.role() = 'authenticated');

-- Admin autenticado puede hacer todo
CREATE POLICY "passengers_auth_all" ON reservation_passengers
  FOR ALL USING (auth.role() = 'authenticated');
