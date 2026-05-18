-- ─── 00016_cleanup_bot_sessions.sql ─────────────────────────────────────────
-- Limpieza automática de sesiones de WhatsApp inactivas.
--
-- bot_sessions crece indefinidamente; sesiones > 90 días son basura.
-- La función puede llamarse manualmente o desde pg_cron.
--
-- Para habilitar pg_cron en Supabase:
--   Dashboard → Database → Extensions → pg_cron → Enable
-- ─────────────────────────────────────────────────────────────────────────────

-- Función de limpieza (idempotente, segura correrla manualmente)
create or replace function public.cleanup_old_bot_sessions()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  deleted_count integer;
begin
  delete from public.bot_sessions
  where last_seen < now() - interval '90 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Solo service_role puede ejecutarla directamente
revoke all on function public.cleanup_old_bot_sessions() from public, anon, authenticated;
grant execute on function public.cleanup_old_bot_sessions() to service_role;

-- ─── pg_cron (opcional) ───────────────────────────────────────────────────────
-- Descomenta las líneas siguientes si pg_cron está habilitado.
-- Corre cada domingo a las 3:00 AM UTC.
--
-- select cron.schedule(
--   'cleanup-bot-sessions',
--   '0 3 * * 0',
--   $$ select public.cleanup_old_bot_sessions(); $$
-- );
