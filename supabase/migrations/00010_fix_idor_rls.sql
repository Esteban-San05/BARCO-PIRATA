-- ═══════════════════════════════════════════════════════════════════════════
--  Fix IDOR: restringir lectura anónima de reservaciones
--
--  Problema: la política "anon_select_recent_reservation" permite a cualquier
--  usuario anónimo listar TODAS las reservaciones de los últimos 30 días,
--  exponiendo nombres, teléfonos y emails de clientes.
--
--  Solución: eliminar esa política y reemplazarla por una función
--  SECURITY DEFINER que solo devuelve UNA reservación dado su UUID exacto.
--  Como el UUID tiene 122 bits de entropía, conocerlo equivale a tener permiso.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Eliminar la política permisiva ─────────────────────────────────────────
drop policy if exists "anon_select_recent_reservation" on public.reservations;
drop policy if exists "anon_select_own_reservation"    on public.reservations;

-- 2. Función segura para leer una reservación por ID ────────────────────────
--    Solo devuelve filas; si el UUID no existe, devuelve vacío.
--    SECURITY DEFINER: se ejecuta con permisos del owner (postgres),
--    ignorando las políticas RLS del llamante anónimo.
create or replace function public.get_reservation_by_id(p_id uuid)
returns setof public.reservations
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select * from public.reservations where id = p_id;
$$;

-- 3. Permisos: solo anon y authenticated pueden llamar la función ────────────
revoke all on function public.get_reservation_by_id(uuid) from public;
grant execute on function public.get_reservation_by_id(uuid) to anon, authenticated;
