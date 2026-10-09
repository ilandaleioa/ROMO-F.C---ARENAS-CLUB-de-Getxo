-- Ejecutar en el SQL Editor de Supabase.
-- Vincula cada jugador con su identificador en la base de datos federativa.
-- Lo rellena scripts/match-jugadores-csv.js --aplicar.

alter table public.jugadores
  add column if not exists federacion_player_id bigint;
