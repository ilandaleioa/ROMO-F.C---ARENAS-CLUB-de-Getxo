-- Ejecutar en el SQL Editor de Supabase.
-- Anade una columna calculada "id_legible" con el formato
-- Nombre-PrimerApellido-Equipo, para identificar visualmente a cada
-- jugador tanto en la tabla "jugadores" como en Captacion.
-- Al ser GENERATED ALWAYS, Postgres la recalcula solo en cada insert/update,
-- sin que el backend tenga que mantenerla manualmente.

alter table public.jugadores
  add column if not exists id_legible text
  generated always as (
    coalesce(nombre, '') || '-' || coalesce(primer_apellido, '') || '-' || coalesce(equipo, '')
  ) stored;

create index if not exists jugadores_id_legible_idx
  on public.jugadores (id_legible);

alter table public."Captación_ Base de datos"
  add column if not exists id_legible text
  generated always as (
    coalesce(nombre, '') || '-' || coalesce(primer_apellido, '') || '-' || coalesce(equipo, '')
  ) stored;

create index if not exists captacion_id_legible_idx
  on public."Captación_ Base de datos" (id_legible);
