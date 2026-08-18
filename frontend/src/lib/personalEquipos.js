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
    'Alevin 15A',
    'Alevin 15B',
    'Alevin 16A',
    'Alevin 16B',
    'Benjamin 17',
    'Benjamin 18',
  ],
  ROMO: [
    'ROMO JUVENIL',
    'ITZU JUVENIL',
    'ROMO CADETE',
    'ITZU CADETE',
    'ROMO INFANTIL 2013',
    'ROMO INFANTIL 2014',
    'ROMO ALEVIN 2015 Gobela',
    'ROMO ALEVIN 2015 Ibaiondo',
    'ROMO ALEVIN 2016',
    'ROMO BENJAMIN 2017 Gobela',
    'ROMO BENJAMIN 2017 Ibaiondo',
    'ROMO BENJAMIN 2018',
    'ROMO PREBENJAMIN 2019',
    'ROMO PREBENJAMIN 2020',
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

export function obtenerEquiposPersonalPorClub(club) {
  return [...(EQUIPOS_PERSONAL_POR_CLUB[club] || [])];
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
  const equipos = parseEquiposPersonal(valor);
  if (equipos.length === 0) return NINGUNO_EQUIPOS;
  if (compacto && equipos.length > 2) return `${equipos.length} equipos`;
  return equipos.join(', ');
}
