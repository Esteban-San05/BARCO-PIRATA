-- ══════════════════════════════════════════════════════════════════════════
-- 00010_closed_weekdays_array.sql
--
-- Cambia el día de cierre semanal de un valor único (INT) a un arreglo (INT[])
-- para permitir que el negocio cierre varios días a la semana.
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1. Nueva columna: días de cierre como arreglo ──────────────────────
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS closed_weekdays INT[] NOT NULL DEFAULT ARRAY[1];

-- ─── 2. Migrar el valor existente (closed_weekday → closed_weekdays) ────
UPDATE business_settings
  SET closed_weekdays = ARRAY[closed_weekday]
  WHERE id = 1;

-- ─── 3. Eliminar columna y constraint anteriores ────────────────────────
ALTER TABLE business_settings DROP CONSTRAINT IF EXISTS closed_weekday_range;
ALTER TABLE business_settings DROP COLUMN IF EXISTS closed_weekday;
