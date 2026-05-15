-- ═══════════════════════════════════════════════════════════════════════════
--  Migración 00015: Endurecimiento de seguridad v2
--
--  Cierra hallazgos de auditoría:
--    C3 — IDOR en reservation_passengers (lectura pública de PII)
--    C2 — business_settings editable por cualquier autenticado (debe ser admin)
--    B2 — check_phone_rate_limit no normalizaba teléfonos → bypass por formato
--    B3 — getReservationByPhone traía 20 filas y filtraba en cliente
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- C3 · Cerrar IDOR en reservation_passengers
--
-- Problema: las políticas anon SELECT/INSERT/UPDATE usaban `USING (true)`,
-- permitiendo dumpear todos los pasajeros (nombre + edad de menores) a
-- cualquier visitante anónimo, sin necesidad de conocer la reservación.
--
-- Solución: revocar acceso directo a la tabla para anon y exponer únicamente
-- funciones SECURITY DEFINER que validen el UUID exacto de la reservación
-- (122 bits de entropía ≡ token). Authenticated mantiene acceso completo.
-- ───────────────────────────────────────────────────────────────────────────

-- 1. Eliminar políticas anon permisivas
drop policy if exists "passengers_anon_select" on public.reservation_passengers;
drop policy if exists "passengers_anon_insert" on public.reservation_passengers;
drop policy if exists "passengers_anon_update" on public.reservation_passengers;
drop policy if exists "passengers_auth_delete" on public.reservation_passengers;
drop policy if exists "passengers_auth_all"    on public.reservation_passengers;

-- 2. Política única para staff autenticado (admin/vendedor): acceso completo
create policy "passengers_auth_all" on public.reservation_passengers
  for all to authenticated
  using (true) with check (true);

-- (Sin policies para anon → RLS bloquea TODO acceso directo)

-- 3. Función SECURITY DEFINER: leer pasajeros por UUID de reserva
create or replace function public.get_passengers_by_reservation(p_reservation_id uuid)
returns setof public.reservation_passengers
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select * from public.reservation_passengers
  where reservation_id = p_reservation_id
  order by position;
$$;

revoke all on function public.get_passengers_by_reservation(uuid) from public;
grant execute on function public.get_passengers_by_reservation(uuid) to anon, authenticated;

-- 4. Función SECURITY DEFINER: estado del manifiesto por UUID de reserva
create or replace function public.get_manifest_status_by_reservation(p_reservation_id uuid)
returns table (
  reservation_id uuid,
  date           date,
  "time"         time,
  required       bigint,
  filled         bigint,
  is_complete    boolean
)
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select reservation_id, date, "time", required, filled, is_complete
  from public.reservation_manifest_status
  where reservation_id = p_reservation_id;
$$;

revoke all on function public.get_manifest_status_by_reservation(uuid) from public;
grant execute on function public.get_manifest_status_by_reservation(uuid) to anon, authenticated;

-- 5. Función SECURITY DEFINER: bulk-upsert (delete + insert) por UUID
--    Valida que la reservación exista y no esté cancelada antes de operar.
create or replace function public.upsert_passengers_for_reservation(
  p_reservation_id uuid,
  p_passengers     jsonb
)
returns setof public.reservation_passengers
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_exists boolean;
  v_max    int;
begin
  -- Validar reservación
  select exists (
    select 1 from public.reservations
    where id = p_reservation_id and status <> 'cancelada'
  ) into v_exists;

  if not v_exists then
    raise exception 'Reservación no encontrada o cancelada' using errcode = 'P0002';
  end if;

  -- Validar tamaño del payload (defensa en profundidad contra abuso)
  v_max := coalesce(jsonb_array_length(p_passengers), 0);
  if v_max > 200 then
    raise exception 'Payload demasiado grande (máx 200 pasajeros)' using errcode = '22000';
  end if;

  -- Borrar existentes
  delete from public.reservation_passengers
    where reservation_id = p_reservation_id;

  -- Insertar nuevos (si hay)
  if v_max > 0 then
    insert into public.reservation_passengers
      (reservation_id, full_name, age, passenger_type, position)
    select
      p_reservation_id,
      nullif(trim(coalesce(elem->>'fullName', '')), ''),
      nullif(elem->>'age', '')::int,
      elem->>'passengerType',
      (elem->>'position')::int
    from jsonb_array_elements(p_passengers) as elem;
  end if;

  return query
    select * from public.reservation_passengers
    where reservation_id = p_reservation_id
    order by position;
end;
$$;

revoke all on function public.upsert_passengers_for_reservation(uuid, jsonb) from public;
grant execute on function public.upsert_passengers_for_reservation(uuid, jsonb) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- C2 · business_settings: restringir UPDATE solo a admin
--
-- Problema: la política `authenticated_update_business_settings` permitía a
-- cualquier authenticated (incluido `vendedor`) modificar precios, capacidad,
-- días cerrados, promociones, etc.
-- ───────────────────────────────────────────────────────────────────────────

drop policy if exists "authenticated_update_business_settings" on public.business_settings;
drop policy if exists "admin_update_business_settings"         on public.business_settings;
drop policy if exists "admin_insert_business_settings"         on public.business_settings;

create policy "admin_update_business_settings"
  on public.business_settings for update
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "admin_insert_business_settings"
  on public.business_settings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );


-- ───────────────────────────────────────────────────────────────────────────
-- B2 · Normalizar teléfono en check_phone_rate_limit
--
-- Problema: la comparación literal `contact_phone = p_phone` permite a un
-- atacante alternar formatos (+52 638..., 526380..., 638...) para multiplicar
-- el cupo y enviar más reservas por hora.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function check_phone_rate_limit(
  p_phone        text,
  p_max_per_hour int default 3
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select count(*) < p_max_per_hour
  from reservations
  where right(regexp_replace(contact_phone, '\D', '', 'g'), 10)
      = right(regexp_replace(p_phone,        '\D', '', 'g'), 10)
    and created_at > now() - interval '1 hour'
    and status <> 'cancelada';
$$;

revoke all on function check_phone_rate_limit(text, int) from public;
grant execute on function check_phone_rate_limit(text, int) to anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- B3 · find_active_reservation_by_phone(p_phone_tail)
--
-- Problema: el bot de WhatsApp traía 20 reservaciones a memoria y filtraba en
-- cliente — leak por timing y desperdicio de I/O. Movemos el filtro a SQL,
-- usando los últimos 10 dígitos como llave de búsqueda.
--
-- Solo accesible vía service_role (Edge Function), pero la definimos como
-- SECURITY DEFINER para que pueda saltar RLS sin requerir auth del cliente.
-- ───────────────────────────────────────────────────────────────────────────

-- Índice de apoyo para que el filtro por tail-10 sea barato
create index if not exists idx_reservations_phone_tail10
  on public.reservations (
    right(regexp_replace(contact_phone, '\D', '', 'g'), 10)
  );

create or replace function public.find_active_reservation_by_phone(p_phone_tail text)
returns setof public.reservations
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select *
  from public.reservations
  where right(regexp_replace(contact_phone, '\D', '', 'g'), 10) = right(p_phone_tail, 10)
    and status <> 'cancelada'
  order by created_at desc
  limit 1;
$$;

-- Esta función NO debe ser invocable por clientes (devuelve PII completa).
-- Solo el service_role (Edge Functions) tiene acceso.
revoke all on function public.find_active_reservation_by_phone(text) from public, anon, authenticated;
grant execute on function public.find_active_reservation_by_phone(text) to service_role;
