create table if not exists public.actividades_calendario (
  club text primary key,
  actividades jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint actividades_calendario_club_check check (club in ('ROMO', 'ARENAS'))
);

alter table public.actividades_calendario enable row level security;

insert into public.actividades_calendario (club, actividades, updated_at)
values (
  'ROMO',
  '[
    {
      "id": "muestra-1",
      "club": "ROMO",
      "tipo": "sesion",
      "evento": "Sesion",
      "competicion": "Entrenamiento",
      "titulo": "ROMO - CADETE A",
      "equipo": "ROMO - CADETE A",
      "local": "",
      "visitante": "",
      "rival": "",
      "ubicacion": "GOBELA",
      "fecha": "2026-08-19",
      "hora": "17:30",
      "horaFin": "19:00",
      "jornada": 0,
      "duracion": "17:30 - 19:00"
    },
    {
      "id": "muestra-2",
      "club": "ROMO",
      "tipo": "sesion",
      "evento": "Sesion",
      "competicion": "Entrenamiento",
      "titulo": "ROMO - ITZU JUVENIL",
      "equipo": "ROMO - ITZU JUVENIL",
      "local": "",
      "visitante": "",
      "rival": "",
      "ubicacion": "GOBELA",
      "fecha": "2026-08-19",
      "hora": "18:00",
      "horaFin": "19:30",
      "jornada": 0,
      "duracion": "18:00 - 19:30"
    },
    {
      "id": "muestra-3",
      "club": "ROMO",
      "tipo": "partido",
      "evento": "Partido",
      "competicion": "Pretemporada",
      "titulo": "ROMO CADETE A - BARAKALDO",
      "equipo": "ROMO CADETE A",
      "local": "ROMO CADETE A",
      "visitante": "BARAKALDO",
      "rival": "BARAKALDO",
      "ubicacion": "GOBELA",
      "fecha": "2026-08-19",
      "hora": "19:15",
      "horaFin": "21:30",
      "jornada": 0,
      "duracion": "19:15 - 21:30"
    }
  ]'::jsonb,
  now()
)
on conflict (club)
do update set
  actividades = excluded.actividades,
  updated_at = excluded.updated_at;
