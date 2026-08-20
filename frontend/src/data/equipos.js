import { ordenarEquipos } from '../lib/equiposOrden';

export const EQUIPOS_BASE_CLUB = [
  'Juvenil A',
  'Juvenil B',
  'Juvenil C',
  'Juvenil D',
  'Cadete A',
  'Cadete B',
  'Cadete C',
  'Cadete D',
  'Infantil A',
  'Infantil B',
  'Infantil C',
  'Infantil D',
  'Alevín A',
  'Alevín B',
  'Alevín C',
  'Alevín D',
  'Benjamín A',
  'Benjamín B',
  'Benjamín C',
  'Benjamín D',
  'Filial',
  'Primer equipo',
];

const EQUIPOS_ROMO = [
  'ROMO JUVENIL',
  'ITZU JUVENIL',
  'ROMO CADETE',
  'ITZU CADETE',
  'ROMO INFANTIL 2013',
  'ROMO INFANTIL 2014',
  'ROMO ALEVÍN 2015 Gobela',
  'ROMO ALEVÍN 2015 Ibaiondo',
  'ROMO ALEVÍN 2016',
  'ROMO BENJAMÍN 2017 Gobela',
  'ROMO BENJAMÍN 2017 Ibaiondo',
  'ROMO BENJAMÍN 2018',
  'ROMO PREBENJAMÍN 2019',
  'ROMO PREBENJAMÍN 2020',
];

const EQUIPOS_ARENAS = [
  'ARENAS Juvenil A',
  'ARENAS Juvenil B',
  'ARENAS Cadete A',
  'ARENAS Cadete B',
  'ARENAS Infantil 13',
  'ARENAS Infantil 14',
  'ARENAS Alevín 15A',
  'ARENAS Alevín 15B',
  'ARENAS Alevín 16A',
  'ARENAS Alevín 16B',
  'ARENAS Benjamín 17',
  'ARENAS Benjamín 18',
];

export const EQUIPOS_POR_CLUB = {
  DEFAULT: [...EQUIPOS_BASE_CLUB],
  ARENAS: [...EQUIPOS_ARENAS],
  ROMO: [...EQUIPOS_ROMO],
};

function normalizarClaveClub(valor) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toUpperCase();
}

function resolverClaveClub(club) {
  const clave = normalizarClaveClub(club);
  if (clave.includes('ROMO')) return 'ROMO';
  if (clave.includes('ARENAS')) return 'ARENAS';
  return clave;
}

export function obtenerEquiposPorClub(club) {
  const clave = resolverClaveClub(club);
  return ordenarEquipos(EQUIPOS_POR_CLUB[clave] || EQUIPOS_POR_CLUB.DEFAULT);
}
