-- Ejecutar en el SQL Editor de Supabase.
-- Crea la tabla principal usada por /api/personal.
-- Si la tabla ya existia, este script tambien repara columnas faltantes
-- sin borrar datos existentes.

create extension if not exists pgcrypto;

create table if not exists public.personal (
  id uuid primary key default gen_random_uuid(),
  club text not null default '',
  nombre text not null default '',
  primer_apellido text not null default '',
  segundo_apellido text,
  telefono text,
  email text,
  cargo text not null default '',
  equipo text not null default '',
  foto_path text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint personal_club_check check (club in ('ROMO', 'ARENAS'))
);

alter table public.personal
  add column if not exists club text,
  add column if not exists nombre text,
  add column if not exists primer_apellido text,
  add column if not exists segundo_apellido text,
  add column if not exists telefono text,
  add column if not exists email text,
  add column if not exists cargo text,
  add column if not exists equipo text,
  add column if not exists foto_path text,
  add column if not exists creado_en timestamptz,
  add column if not exists actualizado_en timestamptz;

alter table public.personal
  alter column id set default gen_random_uuid(),
  alter column club set default '',
  alter column nombre set default '',
  alter column primer_apellido set default '',
  alter column cargo set default '',
  alter column equipo set default '',
  alter column creado_en set default now(),
  alter column actualizado_en set default now();

create index if not exists personal_club_idx on public.personal (club);
create index if not exists personal_club_equipo_idx on public.personal (club, equipo);
create index if not exists personal_club_nombre_idx on public.personal (club, primer_apellido, nombre);
