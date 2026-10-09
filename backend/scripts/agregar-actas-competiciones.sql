-- Ejecutar en el SQL Editor de Supabase.
-- Añade el enlace de actas a la tabla public.competiciones.

alter table public.competiciones
  add column if not exists url_actas text not null default '';
