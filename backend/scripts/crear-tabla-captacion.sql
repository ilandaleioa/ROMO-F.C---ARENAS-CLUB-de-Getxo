-- Ejecutar en el SQL Editor de Supabase.
-- Crea la tabla principal usada por /api/captacion.
-- La tabla se llama con acento y espacio porque el backend ya apunta a ese nombre exacto.

create table if not exists public."Captación_ Base de datos" (
  id uuid primary key default gen_random_uuid(),
  id_jugador uuid not null unique default gen_random_uuid(),
  fecha_alta text not null default '',
  quien_da_alta text not null default '',
  club text not null default '',
  equipo text not null default '',
  etapa text not null default '',
  categoria text not null default '',
  grupo text not null default '',
  enlace text not null default '',
  nombre text not null default '',
  primer_apellido text not null default '',
  segundo_apellido text not null default '',
  dorsal text not null default '',
  altura text not null default '',
  lateralidad text not null default '',
  foto_jugador text not null default '',
  fecha_nacimiento text not null default '',
  anio_nacimiento text not null default '',
  edad text not null default '',
  demarcacion text not null default '',
  otra_demarcacion text not null default '',
  demarcacion_concreta text not null default '',
  valoracion_general text not null default '',
  descripcion_jugador text not null default '',
  observaciones text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists captacion_fecha_alta_idx
  on public."Captación_ Base de datos" (fecha_alta desc);

create index if not exists captacion_club_idx
  on public."Captación_ Base de datos" (club);

create index if not exists captacion_equipo_idx
  on public."Captación_ Base de datos" (equipo);

create index if not exists captacion_apellido_nombre_idx
  on public."Captación_ Base de datos" (primer_apellido, nombre);
