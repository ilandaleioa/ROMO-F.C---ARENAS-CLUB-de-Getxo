-- Ejecutar en el SQL Editor de Supabase.
-- Añade el enlace de resultados a la tabla public.competiciones.

alter table public.competiciones
  add column if not exists url_resultados text not null default '';
