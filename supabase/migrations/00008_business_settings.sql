-- ─────────────────────────────────────────────────────────────────────────────
--  Migración 00008: Tabla de configuración del negocio
--
--  Tabla singleton (id = 1 siempre) para que el admin gestione desde el panel:
--    - Día de cierre semanal (closed_weekday)
--    - Horarios activos (active_time_slots)
--    - Capacidad del barco (boat_capacity)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS business_settings (
  id               INT PRIMARY KEY DEFAULT 1,
  closed_weekday   INT    NOT NULL DEFAULT 1,   -- 0=dom … 6=sáb; 1=lunes por defecto
  active_time_slots TEXT[] NOT NULL DEFAULT ARRAY['09:00','11:00','13:00','15:00','17:00'],
  boat_capacity    INT    NOT NULL DEFAULT 40,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_settings_singleton CHECK (id = 1),
  CONSTRAINT closed_weekday_range CHECK (closed_weekday BETWEEN 0 AND 6),
  CONSTRAINT boat_capacity_range  CHECK (boat_capacity BETWEEN 1 AND 200)
);

-- Fila única con los valores de producción actuales
INSERT INTO business_settings (id, closed_weekday, active_time_slots, boat_capacity)
VALUES (1, 1, ARRAY['09:00','11:00','13:00','15:00','17:00'], 40)
ON CONFLICT DO NOTHING;

-- RLS: cualquiera puede leer, solo autenticados (admin) pueden actualizar
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_business_settings"
  ON business_settings FOR SELECT USING (true);

CREATE POLICY "authenticated_update_business_settings"
  ON business_settings FOR UPDATE USING (auth.role() = 'authenticated');
