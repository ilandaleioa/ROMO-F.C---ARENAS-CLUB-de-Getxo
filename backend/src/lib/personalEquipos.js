const EQUIPOS_SEPARATOR = '||';

function limpiarEquipo(equipo) {
  return String(equipo || '').trim();
}

function uniqueEquipos(equipos) {
  return Array.from(new Set(equipos.map(limpiarEquipo).filter(Boolean)));
}

function parseEquiposPersonal(valor) {
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

function serializarEquiposPersonal(valor) {
  return parseEquiposPersonal(valor).join(EQUIPOS_SEPARATOR);
}

function equipoPersonalCoincide(valor, equiposFiltro) {
  if (equiposFiltro === null) return true;
  if (!Array.isArray(equiposFiltro) || equiposFiltro.length === 0) return false;

  const equiposRegistro = parseEquiposPersonal(valor);
  if (equiposRegistro.length === 0) return false;

  const setRegistro = new Set(equiposRegistro);
  return equiposFiltro.some((equipo) => setRegistro.has(limpiarEquipo(equipo)));
}

function equiposPersonalLabel(valor, { compacto = false } = {}) {
  const equipos = parseEquiposPersonal(valor);
  if (equipos.length === 0) return '-';
  if (compacto && equipos.length > 2) return `${equipos.length} equipos`;
  return equipos.join(', ');
}

module.exports = {
  EQUIPOS_SEPARATOR,
  parseEquiposPersonal,
  serializarEquiposPersonal,
  equipoPersonalCoincide,
  equiposPersonalLabel,
};
