import { ordenarEquipos } from '../lib/equiposOrden';

const EQUIPOS_BASE = [
  'Juvenil A',
  'Juvenil B',
  'Cadete A',
  'Cadete B',
  'Infantil 13',
  'Infantil 14',
  'Alevín 15A',
  'Alevín 15B',
  'Alevín 16A',
  'Alevín 16B',
  'Benjamín 17',
  'Benjamín 18',
];

export const EQUIPOS_POR_CLUB = Object.assign([...EQUIPOS_BASE], {
  ARENAS: [...EQUIPOS_BASE],
  ROMO: [...EQUIPOS_BASE],
});

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
  return ordenarEquipos(EQUIPOS_POR_CLUB[resolverClaveClub(club)] || []);
}
