const TODOS_EQUIPOS = 'Todos';
const EQUIPOS_SEPARATOR = '||';

function limpiarEquipo(equipo) {
  return String(equipo || '').trim();
}

function uniqueEquipos(equipos) {
  return Array.from(new Set(equipos.map(limpiarEquipo).filter(Boolean)));
}

function parseEquiposAsignados(valor) {
  if (Array.isArray(valor)) {
    const equipos = uniqueEquipos(valor);
    return equipos.includes(TODOS_EQUIPOS) ? [] : equipos;
  }

  if (valor === null || valor === undefined) return [];

  const texto = limpiarEquipo(valor);
  if (!texto || texto === TODOS_EQUIPOS) return [];

  if (texto.startsWith('[')) {
    try {
      const parsed = JSON.parse(texto);
      if (Array.isArray(parsed)) return parseEquiposAsignados(parsed);
    } catch (_) {
      // Si no es JSON valido, se trata como valor antiguo de un unico equipo.
    }
  }

  const equipos = texto.includes(EQUIPOS_SEPARATOR)
    ? texto.split(EQUIPOS_SEPARATOR)
    : [texto];
  const equiposUnicos = uniqueEquipos(equipos);
  return equiposUnicos.includes(TODOS_EQUIPOS) ? [] : equiposUnicos;
}

function serializeEquiposAsignados(valor) {
  const equipos = parseEquiposAsignados(valor);
  return equipos.length > 0 ? equipos.join(EQUIPOS_SEPARATOR) : TODOS_EQUIPOS;
}

function usuarioTieneEquiposLimitados(user) {
  return parseEquiposAsignados(user?.equipo_asignado).length > 0;
}

function filtrarEquiposPermitidos(equipos, user) {
  const permitidos = parseEquiposAsignados(user?.equipo_asignado);
  const equiposLimpios = uniqueEquipos(equipos);
  if (permitidos.length === 0) return equiposLimpios;

  const permitidosSet = new Set(permitidos);
  return equiposLimpios.filter((equipo) => permitidosSet.has(equipo));
}

function puedeVerEquipo(user, equipo) {
  const permitidos = parseEquiposAsignados(user?.equipo_asignado);
  if (permitidos.length === 0) return true;
  return permitidos.includes(limpiarEquipo(equipo));
}

module.exports = {
  TODOS_EQUIPOS,
  parseEquiposAsignados,
  serializeEquiposAsignados,
  usuarioTieneEquiposLimitados,
  filtrarEquiposPermitidos,
  puedeVerEquipo,
};
