-- Ejecutar en el SQL Editor de Supabase.
-- Añade la columna de anotaciones (texto libre) a la tabla public.usuarios.

alter table public.usuarios
  add column if not exists texto text not null default '';
