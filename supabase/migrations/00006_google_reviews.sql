-- ═══════════════════════════════════════════════════════════════════════════
--  Barco Pirata – Reseñas de Google Maps (caché local)
--  Motor: PostgreSQL (Supabase)
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilitar extensiones necesarias para el cron job
create extension if not exists "pg_net";
create extension if not exists "pg_cron";

-- ─── Tabla: google_reviews ────────────────────────────────────────────────
create table if not exists public.google_reviews (
  id              uuid primary key default uuid_generate_v4(),
  author_name     text not null,
  author_photo    text,                          -- URL foto de perfil de Google
  rating          int not null check (rating between 1 and 5),
  text            text,
  time            bigint,                        -- Unix timestamp de la reseña
  relative_time   text,                          -- Ej: "hace 2 semanas"
  fetched_at      timestamptz not null default now()
);

-- Índice para ordenar por rating o fecha
create index if not exists idx_google_reviews_rating on public.google_reviews(rating desc);
create index if not exists idx_google_reviews_time   on public.google_reviews(time desc);

-- ─── Tabla: google_place_info (rating general del negocio) ────────────────
create table if not exists public.google_place_info (
  id              uuid primary key default uuid_generate_v4(),
  rating          numeric(2,1),                  -- Ej: 4.8
  total_reviews   int,                           -- Total de reseñas en Google
  fetched_at      timestamptz not null default now()
);

-- ─── RLS: reseñas son públicas (cualquiera puede leerlas) ─────────────────
alter table public.google_reviews    enable row level security;
alter table public.google_place_info enable row level security;

drop policy if exists "public_read_reviews" on public.google_reviews;
create policy "public_read_reviews"
  on public.google_reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "public_read_place_info" on public.google_place_info;
create policy "public_read_place_info"
  on public.google_place_info for select
  to anon, authenticated
  using (true);

-- Solo service_role puede insertar/actualizar (la Edge Function usa service_role)
drop policy if exists "service_write_reviews" on public.google_reviews;
create policy "service_write_reviews"
  on public.google_reviews for all
  to service_role
  using (true) with check (true);

drop policy if exists "service_write_place_info" on public.google_place_info;
create policy "service_write_place_info"
  on public.google_place_info for all
  to service_role
  using (true) with check (true);
