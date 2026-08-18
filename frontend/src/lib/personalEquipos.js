const EQUIPOS_SEPARATOR = '||';

function limpiarEquipo(equipo) {
  return String(equipo || '').trim();
}

function uniqueEquipos(equipos) {
  return Array.from(new Set(equipos.map(limpiarEquipo).filter(Boolean)));
}

export function parseEquiposPersonal(valor) {
  if (Array.isArray(valor)) {
    return uniqueEquipos(valor);
  }

  if (valor === null || valor === undefined) return [];

  const texto = limpiarEquipo(valor);
  if (!texto || texto === 'Todos') return [];

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
  if (equipos.length === 0) return '-';
  if (compacto && equipos.length > 2) return `${equipos.length} equipos`;
  return equipos.join(', ');
}
