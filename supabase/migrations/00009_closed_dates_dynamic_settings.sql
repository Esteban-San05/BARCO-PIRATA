-- ══════════════════════════════════════════════════════════════════════════
-- 00009_closed_dates_dynamic_settings.sql
--
-- 1. Agrega columna closed_dates para días específicos cerrados.
-- 2. Actualiza boat_capacity() y valid_time_slots() para leer de
--    business_settings en vez de valores hardcodeados — así los cambios
--    del admin se reflejan en vivo sin necesidad de re-deploy.
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1. Nueva columna: días específicos cerrados ────────────────────────
ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS closed_dates date[] NOT NULL DEFAULT '{}';

-- ─── 2. boat_capacity() — ahora lee de business_settings ───────────────
CREATE OR REPLACE FUNCTION public.boat_capacity()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT boat_capacity FROM business_settings WHERE id = 1
$$;

-- ─── 3. valid_time_slots() — ahora lee active_time_slots de la tabla ───
CREATE OR REPLACE FUNCTION public.valid_time_slots()
RETURNS time[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT array(
    SELECT s::time
    FROM unnest((SELECT active_time_slots FROM business_settings WHERE id = 1)) s
  )
$$;

-- ─── 4. get_daily_availability — usa las funciones dinámicas ───────────
-- (ya llama a boat_capacity() y valid_time_slots(), así que con
--  actualizarlas es suficiente. Solo recreamos para claridad.)
CREATE OR REPLACE FUNCTION public.get_daily_availability(p_date date)
RETURNS TABLE (
  slot_time time,
  occupied  int,
  available int,
  is_full   boolean
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH slots AS (
    SELECT unnest(public.valid_time_slots()) AS t
  )
  SELECT
    s.t                                                           AS slot_time,
    COALESCE(SUM(r.number_of_people), 0)::int                    AS occupied,
    (public.boat_capacity() - COALESCE(SUM(r.number_of_people), 0))::int AS available,
    COALESCE(SUM(r.number_of_people), 0) >= public.boat_capacity() AS is_full
  FROM slots s
  LEFT JOIN public.reservations r
    ON  r.date   = p_date
    AND r.time   = s.t
    AND r.status IN ('pendiente','confirmada','pagada')
  GROUP BY s.t
  ORDER BY s.t;
$$;

-- ─── 5. Trigger check_capacity — usa funciones dinámicas ───────────────
CREATE OR REPLACE FUNCTION public.check_capacity_before_write()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_occupied     int;
  v_available    int;
  v_total        int;
  v_time_changed boolean;
BEGIN
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  v_time_changed := (TG_OP = 'INSERT') OR (NEW.time IS DISTINCT FROM OLD.time);

  IF v_time_changed AND NOT (NEW.time = ANY(public.valid_time_slots())) THEN
    RAISE EXCEPTION
      'Horario % no disponible. Horarios permitidos: %',
      NEW.time::text,
      array_to_string(public.valid_time_slots()::text[], ', ')
      USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.date IS DISTINCT FROM OLD.date
     OR NEW.time IS DISTINCT FROM OLD.time
     OR NEW.number_of_people IS DISTINCT FROM OLD.number_of_people
     OR (OLD.status = 'cancelada' AND NEW.status <> 'cancelada')
  THEN
    SELECT COALESCE(SUM(number_of_people), 0) INTO v_occupied
    FROM public.reservations
    WHERE date   = NEW.date
      AND time   = NEW.time
      AND status IN ('pendiente','confirmada','pagada')
      AND id IS DISTINCT FROM NEW.id;

    v_available := public.boat_capacity() - v_occupied;
    v_total     := v_occupied + NEW.number_of_people;

    IF v_total > public.boat_capacity() THEN
      RAISE EXCEPTION
        'Capacidad excedida para % a las %: solo quedan % lugares disponibles (solicitaste %).',
        NEW.date::text,
        TO_CHAR(NEW.time, 'HH24:MI'),
        v_available,
        NEW.number_of_people
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.boat_capacity()              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.valid_time_slots()           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_availability(date) TO anon, authenticated;
