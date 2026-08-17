-- Ejecutar en el SQL Editor de Supabase.
-- Cada informe apunta a un registro de la tabla de captacion mediante jugador_id.

create table if not exists public.captacion_informes (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  observador text not null,
  jugador_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint captacion_informes_jugador_fk
    foreign key (jugador_id)
    references public."Captación_ Base de datos" (id)
    on update cascade
    on delete restrict
);

create index if not exists captacion_informes_fecha_idx
  on public.captacion_informes (fecha desc);

create index if not exists captacion_informes_jugador_idx
  on public.captacion_informes (jugador_id);

