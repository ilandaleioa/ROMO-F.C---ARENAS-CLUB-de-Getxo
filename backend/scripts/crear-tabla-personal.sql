create table if not exists public.personal (
  id uuid primary key default gen_random_uuid(),
  club text not null,
  nombre text not null,
  primer_apellido text not null,
  segundo_apellido text,
  cargo text not null,
  equipo text not null,
  foto_path text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint personal_club_check check (club in ('ROMO', 'ARENAS'))
);

create index if not exists personal_club_idx on public.personal (club);
create index if not exists personal_club_equipo_idx on public.personal (club, equipo);
create index if not exists personal_club_nombre_idx on public.personal (club, primer_apellido, nombre);
