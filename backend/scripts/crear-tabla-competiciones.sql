-- Ejecutar en el SQL Editor de Supabase.
-- Crea la tabla de competiciones utilizada por /api/competiciones.

create extension if not exists pgcrypto;

create table if not exists public.competiciones (
  id uuid primary key default gen_random_uuid(),
  club text not null default 'ROMO',
  nombre text not null default '',
  tipo text not null default 'liga',
  partes integer not null default 2,
  minutos_por_parte integer not null default 45,
  total_minutos integer not null default 90,
  equipo_interno text not null default '',
  equipos_anadidos integer not null default 0,
  equipo_fed text not null default '',
  etapa text not null default '',
  categoria text not null default '',
  url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competiciones_club_check check (club in ('ROMO', 'ARENAS'))
);

alter table public.competiciones
  add column if not exists club text,
  add column if not exists nombre text,
  add column if not exists tipo text,
  add column if not exists partes integer,
  add column if not exists minutos_por_parte integer,
  add column if not exists total_minutos integer,
  add column if not exists equipo_interno text,
  add column if not exists equipos_anadidos integer,
  add column if not exists equipo_fed text,
  add column if not exists etapa text,
  add column if not exists categoria text,
  add column if not exists url text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.competiciones
  alter column club set default 'ROMO',
  alter column nombre set default '',
  alter column tipo set default 'liga',
  alter column partes set default 2,
  alter column minutos_por_parte set default 45,
  alter column total_minutos set default 90,
  alter column equipo_interno set default '',
  alter column equipos_anadidos set default 0,
  alter column equipo_fed set default '',
  alter column etapa set default '',
  alter column categoria set default '',
  alter column url set default '',
  alter column created_at set default now(),
  alter column updated_at set default now();

create index if not exists competiciones_club_idx
  on public.competiciones (club);

create index if not exists competiciones_club_equipo_idx
  on public.competiciones (club, equipo_interno);

update public.competiciones
set total_minutos = partes * minutos_por_parte
where partes is not null and minutos_por_parte is not null;

alter table public.competiciones enable row level security;
