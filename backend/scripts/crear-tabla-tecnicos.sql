-- Ejecutar en el SQL Editor de Supabase.
-- Crea la tabla usada por /api/tecnicos, sincronizada desde el formulario de
-- Google Sheets de tecnicos (solo lectura, importacion unidireccional).
-- Si la tabla ya existia, este script tambien repara columnas faltantes sin
-- borrar datos existentes.

create extension if not exists pgcrypto;

create table if not exists public.tecnicos (
  id uuid primary key default gen_random_uuid(),
  club text not null default '',
  marca_temporal timestamptz,
  nombre text not null default '',
  primer_apellido text not null default '',
  segundo_apellido text,
  tecnico text,
  foto_url_sheet text,
  fecha_nacimiento date,
  dni text,
  telefono text,
  email text,
  localidad text,
  temporada_incorporacion text,
  funcion_principal text,
  otra_funcion text,
  equipo_primer_entrenador text,
  equipo_segundo_entrenador text,
  titulacion_ninguna text,
  titulacion_monitor text,
  titulacion_nivel_1 text,
  titulacion_nivel_2 text,
  titulacion_nivel_3 text,
  titulacion_sin_formacion text,
  titulacion_magisterio text,
  titulacion_tafad text,
  titulacion_ivef text,
  titulacion_cafyd text,
  euskera text,
  cuenta_bancaria text,
  observaciones text,
  sheet_row_hash text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint tecnicos_club_check check (club in ('ROMO', 'ARENAS'))
);

alter table public.tecnicos
  add column if not exists club text,
  add column if not exists marca_temporal timestamptz,
  add column if not exists nombre text,
  add column if not exists primer_apellido text,
  add column if not exists segundo_apellido text,
  add column if not exists tecnico text,
  add column if not exists foto_url_sheet text,
  add column if not exists fecha_nacimiento date,
  add column if not exists dni text,
  add column if not exists telefono text,
  add column if not exists email text,
  add column if not exists localidad text,
  add column if not exists temporada_incorporacion text,
  add column if not exists funcion_principal text,
  add column if not exists otra_funcion text,
  add column if not exists equipo_primer_entrenador text,
  add column if not exists equipo_segundo_entrenador text,
  add column if not exists titulacion_ninguna text,
  add column if not exists titulacion_monitor text,
  add column if not exists titulacion_nivel_1 text,
  add column if not exists titulacion_nivel_2 text,
  add column if not exists titulacion_nivel_3 text,
  add column if not exists titulacion_sin_formacion text,
  add column if not exists titulacion_magisterio text,
  add column if not exists titulacion_tafad text,
  add column if not exists titulacion_ivef text,
  add column if not exists titulacion_cafyd text,
  add column if not exists euskera text,
  add column if not exists cuenta_bancaria text,
  add column if not exists observaciones text,
  add column if not exists sheet_row_hash text,
  add column if not exists creado_en timestamptz,
  add column if not exists actualizado_en timestamptz;

alter table public.tecnicos
  alter column id set default gen_random_uuid(),
  alter column club set default '',
  alter column nombre set default '',
  alter column primer_apellido set default '',
  alter column creado_en set default now(),
  alter column actualizado_en set default now();

create index if not exists tecnicos_club_idx on public.tecnicos (club);
create index if not exists tecnicos_club_nombre_idx on public.tecnicos (club, primer_apellido, nombre);
create unique index if not exists tecnicos_club_dni_idx on public.tecnicos (club, dni) where dni is not null and dni <> '';
