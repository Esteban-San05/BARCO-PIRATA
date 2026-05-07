-- ═══════════════════════════════════════════════════════════════════════════
--  Barco Pirata – Cron job para sincronizar reseñas de Google cada 24h
--  Requisito: extensión pg_cron habilitada en Supabase
--  (Dashboard → Database → Extensions → pg_cron)
-- ═══════════════════════════════════════════════════════════════════════════

-- IMPORTANTE: Reemplaza 'TU_PROJECT_REF' con tu Project Reference de Supabase
-- Lo encuentras en: Dashboard → Settings → General → Reference ID
-- Ejemplo: abcdefghijklmnop

-- Eliminar cron anterior si existe
select cron.unschedule('sync-google-reviews')
where exists (
  select 1 from cron.job where jobname = 'sync-google-reviews'
);

-- Programar sincronización diaria a las 3:00 AM (hora UTC)
-- Ajusta la hora según tu zona horaria (Puerto Peñasco es UTC-7)
-- 3 AM UTC = 8 PM hora de Puerto Peñasco (hora local nocturna, tráfico bajo)
select cron.schedule(
  'sync-google-reviews',
  '0 3 * * *',
  $$
    select net.http_post(
      url     := 'https://TU_PROJECT_REF.supabase.co/functions/v1/sync-reviews',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := '{}'::jsonb
    );
  $$
);
