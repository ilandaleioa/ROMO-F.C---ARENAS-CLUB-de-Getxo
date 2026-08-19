-- Ejecutar en el SQL Editor de Supabase.
-- Crea el catalogo maestro de equipos internos para sesiones y partidos.
-- La tabla guarda el nombre completo del equipo y su abreviatura.

create extension if not exists pgcrypto;

create table if not exists public.ms_equipos (
  id uuid primary key default gen_random_uuid(),
  club text not null default '',
  nombre text not null default '',
  abreviatura text,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ms_equipos_club_check check (club in ('ROMO', 'ARENAS'))
);

alter table public.ms_equipos
  add column if not exists club text,
  add column if not exists nombre text,
  add column if not exists abreviatura text,
  add column if not exists orden integer,
  add column if not exists activo boolean,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.ms_equipos
  alter column id set default gen_random_uuid(),
  alter column club set default '',
  alter column nombre set default '',
  alter column orden set default 0,
  alter column activo set default true,
  alter column created_at set default now(),
  alter column updated_at set default now();

create unique index if not exists ms_equipos_club_nombre_key
  on public.ms_equipos (club, nombre);

create unique index if not exists ms_equipos_abreviatura_key
  on public.ms_equipos (abreviatura);

update public.ms_equipos
set nombre = 'JUVENIL A',
    updated_at = now()
where club = 'ROMO'
  and nombre = 'JUVENIL';

update public.ms_equipos
set nombre = 'CADETE A',
    updated_at = now()
where club = 'ROMO'
  and nombre = 'CADETE';

insert into public.ms_equipos (club, nombre, abreviatura, orden, activo)
values
  ('ROMO', 'JUVENIL A', 'RJ', 1, true),
  ('ROMO', 'ITZU JUVENIL', 'IJ', 2, true),
  ('ROMO', 'CADETE A', 'RC', 3, true),
  ('ROMO', 'ITZU CADETE', 'IC', 4, true),
  ('ROMO', 'INFANTIL 2013', 'R13', 5, true),
  ('ROMO', 'INFANTIL 2014', 'R14', 6, true),
  ('ROMO', 'ALEVÍN 2015 GOBELA', 'R15G', 7, true),
  ('ROMO', 'ALEVÍN 2015 IBAIONDO', 'R15I', 8, true),
  ('ROMO', 'ALEVÍN 2016', 'R16', 9, true),
  ('ROMO', 'BENJAMÍN 2017 GOBELA', 'R17G', 10, true),
  ('ROMO', 'BENJAMÍN 2017 IBAIONDO', 'R17I', 11, true),
  ('ROMO', 'BENJAMÍN 2018', 'R18', 12, true),
  ('ROMO', 'PREBENJAMÍN 2019', 'R19', 13, true),
  ('ROMO', 'PREBENJAMÍN 2020', 'R20', 14, true),
  ('ARENAS', 'JUVENIL A', 'AJA', 1, true),
  ('ARENAS', 'JUVENIL B', 'AJB', 2, true),
  ('ARENAS', 'CADETE A', 'ACA', 3, true),
  ('ARENAS', 'CADETE B', 'ACB', 4, true),
  ('ARENAS', 'INFANTIL 13', 'A13', 5, true),
  ('ARENAS', 'INFANTIL 14', 'A14', 6, true),
  ('ARENAS', 'ALEVÍN 15A', 'A15A', 7, true),
  ('ARENAS', 'ALEVÍN 15B', 'A15B', 8, true),
  ('ARENAS', 'ALEVÍN 16A', 'A16A', 9, true),
  ('ARENAS', 'ALEVÍN 16B', 'A16B', 10, true),
  ('ARENAS', 'BENJAMÍN 17', 'A17', 11, true)
on conflict (club, nombre) do update
set abreviatura = excluded.abreviatura,
    orden = excluded.orden,
    activo = excluded.activo,
    updated_at = now();

create or replace view public.vw_ms_equipos as
select
  id,
  club,
  nombre,
  abreviatura,
  orden,
  activo,
  created_at,
  updated_at,
  case
    when nombre ilike 'ITZU %' then nombre
    else club || ' ' || nombre
  end as nombre_completo
from public.ms_equipos;

create index if not exists ms_equipos_club_idx
  on public.ms_equipos (club);

create index if not exists ms_equipos_club_orden_idx
  on public.ms_equipos (club, orden);

alter table public.ms_equipos enable row level security;
