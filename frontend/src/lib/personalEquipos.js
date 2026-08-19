import { ordenarEquipos } from './equiposOrden';

const EQUIPOS_SEPARATOR = '||';
export const TODOS_EQUIPOS = 'TODOS';
export const NINGUNO_EQUIPOS = 'NINGUNO';
const EQUIPOS_PERSONAL_POR_CLUB = {
  ARENAS: [
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
  ],
  ROMO: [
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
  ],
};

function limpiarEquipo(equipo) {
  return String(equipo || '').trim();
}

function uniqueEquipos(equipos) {
  return Array.from(new Set(equipos.map(limpiarEquipo).filter(Boolean)));
}

function normalizarEspecialEquipo(valor) {
  return limpiarEquipo(valor).toUpperCase();
}

function normalizarClaveClub(valor) {
  return limpiarEquipo(valor)
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

export function obtenerEquiposPersonalPorClub(club) {
  return ordenarEquipos(EQUIPOS_PERSONAL_POR_CLUB[resolverClaveClub(club)] || []);
}

export function parseEquiposPersonal(valor) {
  if (Array.isArray(valor)) {
    return uniqueEquipos(
      valor.filter((equipo) => {
        const especial = normalizarEspecialEquipo(equipo);
        return especial !== TODOS_EQUIPOS && especial !== NINGUNO_EQUIPOS;
      })
    );
  }

  if (valor === null || valor === undefined) return [];

  const texto = limpiarEquipo(valor);
  const especial = normalizarEspecialEquipo(texto);
  if (!texto || especial === TODOS_EQUIPOS || especial === NINGUNO_EQUIPOS) return [];

  if (texto.startsWith('[')) {
    try {
      const parsed = JSON.parse(texto);
      if (Array.isArray(parsed)) return parseEquiposPersonal(parsed);
    } catch (_) {
      // Valor antiguo de un unico equipo.
    }
  }

  const equipos = texto.includes(EQUIPOS_SEPARATOR) ? texto.split(EQUIPOS_SEPARATOR) : [texto];
  return uniqueEquipos(equipos);
}

export function equiposPersonalLabel(valor, { compacto = false } = {}) {
  const equipos = ordenarEquipos(parseEquiposPersonal(valor));
  if (equipos.length === 0) return NINGUNO_EQUIPOS;
  if (compacto && equipos.length > 2) return `${equipos.length} equipos`;
  return equipos.join(', ');
}
