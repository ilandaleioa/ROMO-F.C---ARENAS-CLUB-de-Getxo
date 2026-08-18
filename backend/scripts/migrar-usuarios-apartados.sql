-- Ejecutar una vez en Supabase para habilitar la configuracion de apartados
-- visibles por usuario en instalaciones creadas con el esquema antiguo.
alter table public.usuarios
  add column if not exists apartados_visibles text not null default 'Todos';

update public.usuarios
set apartados_visibles = 'Todos'
where apartados_visibles is null;
