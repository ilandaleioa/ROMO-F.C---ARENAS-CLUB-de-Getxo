-- Ejecutar en el SQL Editor de Supabase.
-- Añade la lista de equipos rivales de la competición (para pintar una
-- clasificación propia dentro de la app, sin depender de incrustar la web
-- federativa).

alter table public.competiciones
  add column if not exists rivales jsonb not null default '[]'::jsonb;
