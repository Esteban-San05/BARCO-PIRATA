-- ═══════════════════════════════════════════════════════════════════════════
--  Migración 00004 — Bitácora de accesos de administrador
--  Registra cada inicio de sesión en audit_log con action = 'LOGIN'
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Función RPC segura para registrar logins ────────────────────────────
-- SECURITY DEFINER: se ejecuta con privilegios del propietario (bypass RLS),
-- de modo que no se necesita una política INSERT abierta en audit_log.
create or replace function public.log_admin_login()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  uemail text;
begin
  -- Si no hay sesión activa, no hace nada
  if uid is null then return; end if;

  select email into uemail from auth.users where id = uid;

  insert into public.audit_log (user_id, user_email, action, table_name, created_at)
  values (uid, uemail, 'LOGIN', 'auth', now());
end;
$$;

-- Solo usuarios autenticados pueden invocar la función
revoke all on function public.log_admin_login() from public;
grant execute on function public.log_admin_login() to authenticated;
