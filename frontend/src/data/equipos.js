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

const EQUIPOS_ROMO_ARENAS = [
  'Juvenil A',
  'Juvenil B',
  'Cadete A',
  'Cadete B',
  'Infantil 13',
  'Infantil 14',
  'AlevÃ­n 15A',
  'AlevÃ­n 15B',
  'AlevÃ­n 16A',
  'AlevÃ­n 16B',
  'BenjamÃ­n 17',
  'BenjamÃ­n 18',
];

export const EQUIPOS_POR_CLUB = {
  DEFAULT: [...EQUIPOS_BASE_CLUB],
  ARENAS: [...EQUIPOS_ROMO_ARENAS],
  ROMO: [...EQUIPOS_ROMO_ARENAS],
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
