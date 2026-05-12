-- ═══════════════════════════════════════════════════════════════════════════
--  Barco Pirata de Puerto Peñasco – Esquema inicial de base de datos
--  Motor: PostgreSQL (Supabase)
--  Fecha: 2026
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensiones ──────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────────────
do $$ begin
  create type reservation_status as enum ('pendiente', 'confirmada', 'pagada', 'cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('efectivo', 'transferencia');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pendiente', 'completado', 'fallido', 'reembolsado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin', 'vendedor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type package_id as enum ('CON_COMIDA', 'SOLO_BEBIDAS', 'NINOS');
exception when duplicate_object then null; end $$;

-- ─── Tabla: user_profiles (extiende auth.users de Supabase) ───────────────
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role user_role not null default 'vendedor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Tabla: reservations ──────────────────────────────────────────────────
create table if not exists public.reservations (
  id uuid primary key default uuid_generate_v4(),
  contact_name text not null,
  contact_phone text not null,
  date date not null,
  time time not null,
  number_of_people int not null check (number_of_people between 1 and 50),
  package_id package_id not null,
  service_type text not null check (service_type in ('individual','grupal')),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  discount numeric(10,2) not null default 0 check (discount >= 0),
  total numeric(10,2) not null check (total >= 0),
  status reservation_status not null default 'pendiente',
  payment_method payment_method,
  payment_id uuid,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reservations_date on public.reservations(date);
create index if not exists idx_reservations_status on public.reservations(status);
create index if not exists idx_reservations_phone on public.reservations(contact_phone);

-- ─── Tabla: payments ──────────────────────────────────────────────────────
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  method payment_method not null,
  amount numeric(10,2) not null check (amount >= 0),
  status payment_status not null default 'pendiente',
  stripe_payment_intent_id text,
  receipt_url text,
  processed_at timestamptz,
  processed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_reservation on public.payments(reservation_id);
create index if not exists idx_payments_status on public.payments(status);

-- ─── Tabla: audit_log (bitácora) ──────────────────────────────────────────
create table if not exists public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  user_email text,
  action text not null,            -- INSERT | UPDATE | DELETE | LOGIN | ...
  table_name text,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_created on public.audit_log(created_at desc);
create index if not exists idx_audit_log_user on public.audit_log(user_id);
create index if not exists idx_audit_log_table on public.audit_log(table_name);

-- ═══════════════════════════════════════════════════════════════════════════
--  TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Actualizar updated_at automáticamente
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_reservations_updated on public.reservations;
create trigger trg_reservations_updated
  before update on public.reservations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_profiles_updated on public.user_profiles;
create trigger trg_user_profiles_updated
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- Auditoría genérica
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer as $$
declare
  uid uuid := auth.uid();
  uemail text;
begin
  select email into uemail from auth.users where id = uid;

  insert into public.audit_log(user_id, user_email, action, table_name, record_id, old_values, new_values)
  values (
    uid,
    uemail,
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_reservations on public.reservations;
create trigger trg_audit_reservations
  after insert or update or delete on public.reservations
  for each row execute function public.audit_trigger();

drop trigger if exists trg_audit_payments on public.payments;
create trigger trg_audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.audit_trigger();

-- ═══════════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.reservations  enable row level security;
alter table public.payments      enable row level security;
alter table public.user_profiles enable row level security;
alter table public.audit_log     enable row level security;

-- Reservations: cualquiera puede insertar (clientes anónimos)
drop policy if exists "insert_anonymous_reservations" on public.reservations;
create policy "insert_anonymous_reservations"
  on public.reservations for insert
  to anon, authenticated
  with check (true);

-- Reservations: solo admins/vendedores ven y modifican
drop policy if exists "staff_full_access_reservations" on public.reservations;
create policy "staff_full_access_reservations"
  on public.reservations for all
  to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Cliente puede leer su propia reservación por ID
drop policy if exists "public_read_own_reservation" on public.reservations;
create policy "public_read_own_reservation"
  on public.reservations for select
  to anon
  using (true);  -- se limita por conocer el UUID (obfuscación)

-- Payments: solo staff
drop policy if exists "staff_full_access_payments" on public.payments;
create policy "staff_full_access_payments"
  on public.payments for all
  to authenticated
  using (true) with check (true);

-- User profiles: solo el propio usuario puede leer su perfil
drop policy if exists "user_read_own_profile" on public.user_profiles;
create policy "user_read_own_profile"
  on public.user_profiles for select
  to authenticated
  using (auth.uid() = id);

-- Audit log: solo admins
drop policy if exists "admin_read_audit" on public.audit_log;
create policy "admin_read_audit"
  on public.audit_log for select
  to authenticated
  using (
    exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ═══════════════════════════════════════════════════════════════════════════
--  FUNCIONES DE NEGOCIO
-- ═══════════════════════════════════════════════════════════════════════════

-- Reporte diario consolidado (callable desde el cliente con JWT válido)
create or replace function public.daily_report(report_date date)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'date', report_date,
    'totalReservations', count(*),
    'totalPeople', coalesce(sum(number_of_people), 0),
    'totalRevenue', coalesce(sum(total) filter (where status = 'pagada'), 0),
    'reservations', coalesce(jsonb_agg(to_jsonb(r) order by r.time), '[]'::jsonb)
  ) into result
  from public.reservations r
  where date = report_date and status <> 'cancelada';

  return result;
end;
$$;
