-- Ejecutar en el SQL Editor de Supabase.
-- Añade los enlaces de los apartados (calendario, tabla cruzada, goleadores, porteros)
-- a la tabla public.competiciones. El campo "url" existente se sigue usando para la clasificación.

alter table public.competiciones
  add column if not exists url_calendario text not null default '',
  add column if not exists url_tabla_cruzada text not null default '',
  add column if not exists url_goleadores text not null default '',
  add column if not exists url_porteros text not null default '';
