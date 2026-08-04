export const TODOS_EQUIPOS = 'Todos';
const EQUIPOS_SEPARATOR = '||';

function limpiarEquipo(equipo) {
  return String(equipo || '').trim();
}

function uniqueEquipos(equipos) {
  return Array.from(new Set(equipos.map(limpiarEquipo).filter(Boolean)));
}

export function parseEquiposAsignados(valor) {
  if (Array.isArray(valor)) {
    const equipos = uniqueEquipos(valor);
    return equipos.length === 0 || equipos.includes(TODOS_EQUIPOS) ? [TODOS_EQUIPOS] : equipos;
  }

  if (valor === null || valor === undefined) return [TODOS_EQUIPOS];

  const texto = limpiarEquipo(valor);
  if (!texto || texto === TODOS_EQUIPOS) return [TODOS_EQUIPOS];

  if (texto.startsWith('[')) {
    try {
      const parsed = JSON.parse(texto);
      if (Array.isArray(parsed)) return parseEquiposAsignados(parsed);
    } catch (_) {
      // Valor antiguo de un unico equipo.
    }
  }

  const equipos = texto.includes(EQUIPOS_SEPARATOR) ? texto.split(EQUIPOS_SEPARATOR) : [texto];
  const equiposUnicos = uniqueEquipos(equipos);
  return equiposUnicos.includes(TODOS_EQUIPOS) ? [TODOS_EQUIPOS] : equiposUnicos;
}

export function equiposAsignadosLabel(valor, { compacto = false } = {}) {
  const equipos = parseEquiposAsignados(valor);
  if (equipos.includes(TODOS_EQUIPOS)) return 'Todos';
  if (compacto && equipos.length > 2) return `${equipos.length} equipos`;
  return equipos.join(', ');
}

export function usuarioLimitadoAUnEquipo(user) {
  const equipos = parseEquiposAsignados(user?.equipo_asignado);
  return equipos.length === 1 && equipos[0] !== TODOS_EQUIPOS;
}
