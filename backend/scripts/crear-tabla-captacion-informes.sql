-- Ejecutar en el SQL Editor de Supabase.
-- Primero crea la tabla principal con backend/scripts/crear-tabla-captacion.sql.
-- Cada informe apunta a un registro de la tabla de captacion mediante jugador_id.

create table if not exists public.captacion_informes (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  observador text not null,
  jugador_id uuid not null,
  club text not null default '',
  equipo text not null default '',
  etapa text not null default '',
  categoria text not null default '',
  local text not null default '',
  visitante text not null default '',
  partido text not null default '',
  dorsal text not null default '',
  tipologia text not null default '',
  lateralidad text not null default '',
  descripcion text not null default '',
  demarcacion_concreta text not null default '',
  titularidad text not null default '',
  minutos_jugados text not null default '',
  goles text not null default '',
  goles_encajados text not null default '',
  valoracion_items jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint captacion_informes_jugador_fk
    foreign key (jugador_id)
    references public."Captación_ Base de datos" (id)
    on update cascade
    on delete restrict
);

alter table public.captacion_informes add column if not exists etapa text not null default '';
alter table public.captacion_informes add column if not exists categoria text not null default '';
alter table public.captacion_informes add column if not exists club text not null default '';
alter table public.captacion_informes add column if not exists equipo text not null default '';
alter table public.captacion_informes add column if not exists local text not null default '';
alter table public.captacion_informes add column if not exists visitante text not null default '';
alter table public.captacion_informes add column if not exists partido text not null default '';
alter table public.captacion_informes add column if not exists dorsal text not null default '';
alter table public.captacion_informes add column if not exists tipologia text not null default '';
alter table public.captacion_informes add column if not exists lateralidad text not null default '';
alter table public.captacion_informes add column if not exists descripcion text not null default '';
alter table public.captacion_informes add column if not exists demarcacion_concreta text not null default '';
alter table public.captacion_informes add column if not exists titularidad text not null default '';
alter table public.captacion_informes add column if not exists minutos_jugados text not null default '';
alter table public.captacion_informes add column if not exists goles text not null default '';
alter table public.captacion_informes add column if not exists goles_encajados text not null default '';
alter table public.captacion_informes add column if not exists valoracion_items jsonb not null default '{}'::jsonb;

-- La restriccion se creo con un nombre de tabla mal codificado en una version
-- anterior del script. La recreamos para reparar instalaciones existentes y
-- para que los informes sigan vinculados a la tabla principal correcta.
alter table public.captacion_informes
  drop constraint if exists captacion_informes_jugador_fk;

alter table public.captacion_informes
  add constraint captacion_informes_jugador_fk
  foreign key (jugador_id)
  references public."Captación_ Base de datos" (id)
  on update cascade
  on delete restrict;

create index if not exists captacion_informes_fecha_idx
  on public.captacion_informes (fecha desc);

create index if not exists captacion_informes_jugador_idx
  on public.captacion_informes (jugador_id);
