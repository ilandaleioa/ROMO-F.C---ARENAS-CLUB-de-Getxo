-- Ejecutar en el SQL Editor de Supabase.
-- Añade el enlace de estadísticas a la tabla public.competiciones.

alter table public.competiciones
  add column if not exists url_estadisticas text not null default '';
