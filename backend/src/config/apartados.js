const TODOS_APARTADOS = 'Todos';

const APARTADOS_PERMITIDOS = [
  'inicio',
  'actividades',
  'equipos',
  'graficas',
  'campogramas',
  'captacion',
  'personal',
  'usuarios',
  'listas',
  'clubes_maestros',
  'hojas_calculo',
  'competiciones',
  'competicion',
];

function limpiarApartado(valor) {
  return String(valor || '').trim().toLowerCase();
}

function uniqueApartados(apartados) {
  return Array.from(new Set(apartados.map(limpiarApartado).filter(Boolean)));
}

function parseApartadosVisibles(valor) {
  if (Array.isArray(valor)) {
    const apartados = uniqueApartados(valor);
    return apartados.length === 0 || apartados.includes(TODOS_APARTADOS.toLowerCase()) ? [] : apartados;
  }

  if (valor === null || valor === undefined) return [];

  const texto = limpiarApartado(valor);
  if (!texto || texto === TODOS_APARTADOS.toLowerCase()) return [];

  if (texto.startsWith('[')) {
    try {
      const parsed = JSON.parse(texto);
      if (Array.isArray(parsed)) return parseApartadosVisibles(parsed);
    } catch (_) {
      // Valor antiguo serializado como texto.
    }
  }

  const apartados = texto.includes('||') ? texto.split('||') : [texto];
  const apartadosUnicos = uniqueApartados(apartados);
  return apartadosUnicos.includes(TODOS_APARTADOS.toLowerCase()) ? [] : apartadosUnicos;
}

function serializeApartadosVisibles(valor) {
  const apartados = parseApartadosVisibles(valor);
  return apartados.length > 0 ? apartados.join('||') : TODOS_APARTADOS;
}

function validarApartadosVisibles(valor) {
  const apartados = parseApartadosVisibles(valor);
  const invalidos = apartados.filter((apartado) => !APARTADOS_PERMITIDOS.includes(apartado));
  if (invalidos.length > 0) {
    return `El apartado "${invalidos[0]}" no es valido.`;
  }
  return null;
}

function usuarioPuedeVerApartado(user, apartado) {
  const apartados = parseApartadosVisibles(user?.apartados_visibles);
  if (apartados.length === 0) return true;
  return apartados.includes(limpiarApartado(apartado));
}

module.exports = {
  TODOS_APARTADOS,
  APARTADOS_PERMITIDOS,
  parseApartadosVisibles,
  serializeApartadosVisibles,
  validarApartadosVisibles,
  usuarioPuedeVerApartado,
};
