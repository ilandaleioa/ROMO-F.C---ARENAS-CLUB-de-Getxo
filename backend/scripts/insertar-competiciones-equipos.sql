-- Ejecutar en el SQL Editor de Supabase.
-- Crea una competición (liga) por cada equipo que ya existe en la tabla
-- "jugadores", para ROMO y para ARENAS, evitando duplicados si el equipo
-- ya tiene una competición creada. Los datos federativos (equipo_fed,
-- etapa, categoria, url) se dejan vacíos: rellénalos después desde
-- /competiciones en la app, o con los UPDATE de ejemplo al final.

insert into public.competiciones
  (club, nombre, tipo, partes, minutos_por_parte, total_minutos, equipo_interno, equipo_fed, etapa, categoria, url)
select
  j.club,
  'Liga ' || j.equipo as nombre,
  'liga' as tipo,
  2 as partes,
  40 as minutos_por_parte,
  80 as total_minutos,
  j.equipo as equipo_interno,
  '' as equipo_fed,
  '' as etapa,
  '' as categoria,
  '' as url
from (
  select distinct club, equipo
  from public.jugadores
  where club in ('ROMO', 'ARENAS')
    and coalesce(trim(equipo), '') <> ''
) j
where not exists (
  select 1
  from public.competiciones c
  where c.club = j.club
    and c.equipo_interno = j.equipo
);

-- Comprobar el resultado:
-- select club, nombre, equipo_interno, equipo_fed, etapa, categoria, url
-- from public.competiciones
-- order by club, equipo_interno;

-- Ejemplo para rellenar los datos federativos de un equipo concreto una vez
-- creada la fila (edítalo con los datos reales y ejecútalo por cada equipo):
-- update public.competiciones
-- set equipo_fed = 'IPC LA ESCUELA',
--     etapa = 'Primera Jornada: 06/09/2026',
--     categoria = 'Alevín',
--     url = 'https://www.example-federacion.es/clasificacion/xxxx'
-- where club = 'ARENAS' and equipo_interno = 'ALEVIN A';
