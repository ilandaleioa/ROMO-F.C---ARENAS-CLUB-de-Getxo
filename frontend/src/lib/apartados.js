export const TODOS_APARTADOS = 'Todos';

export const APARTADOS_APP = [
  { key: 'inicio', label: 'Inicio', path: '/' },
  { key: 'campogramas', label: 'Campogramas', path: '/campogramas' },
  { key: 'captacion', label: 'CAPTACION', path: '/captacion' },
  { key: 'personal', label: 'PERSONAL', path: '/personal' },
  { key: 'usuarios', label: 'Usuarios', path: '/usuarios', roles: ['administrador', 'director'] },
  { key: 'listas', label: 'Listas', path: '/listas', roles: ['administrador', 'director'] },
  { key: 'clubes_maestros', label: 'CLUBES', path: '/listas/clubes', roles: ['administrador', 'director'] },
  { key: 'equipos_maestros', label: 'EQUIPOS', path: '/listas/equipos', roles: ['administrador', 'director'] },
  { key: 'hojas_calculo', label: 'Hojas de calculo', path: '/hojas-calculo' },
];

export const APARTADOS_USUARIO = APARTADOS_APP.map(({ key, label }) => ({
  value: key,
  label,
}));

function limpiarApartado(valor) {
  return String(valor || '').trim().toLowerCase();
}

function uniqueApartados(apartados) {
  return Array.from(new Set(apartados.map(limpiarApartado).filter(Boolean)));
}

export function parseApartadosVisibles(valor) {
  if (Array.isArray(valor)) {
    const apartados = uniqueApartados(valor);
    return apartados.length === 0 || apartados.includes(TODOS_APARTADOS.toLowerCase())
      ? [TODOS_APARTADOS]
      : apartados;
  }

  if (valor === null || valor === undefined) return [TODOS_APARTADOS];

  const texto = limpiarApartado(valor);
  if (!texto || texto === TODOS_APARTADOS.toLowerCase()) return [TODOS_APARTADOS];

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
  return apartadosUnicos.includes(TODOS_APARTADOS.toLowerCase()) ? [TODOS_APARTADOS] : apartadosUnicos;
}

export function serializarApartadosVisibles(valor) {
  const apartados = parseApartadosVisibles(valor);
  return apartados.includes(TODOS_APARTADOS) ? TODOS_APARTADOS : apartados.join('||');
}

export function apartadosVisiblesLabel(valor, { compacto = false } = {}) {
  const apartados = parseApartadosVisibles(valor);
  if (apartados.includes(TODOS_APARTADOS)) return 'Todos';

  const labels = apartados
    .map((apartado) => APARTADOS_APP.find((item) => item.key === apartado)?.label || apartado)
    .filter(Boolean);

  if (compacto && labels.length > 2) return `${labels.length} apartados`;
  return labels.join(', ');
}

export function usuarioPuedeVerApartado(user, apartado) {
  const apartados = parseApartadosVisibles(user?.apartados_visibles);
  if (apartados.includes(TODOS_APARTADOS)) return true;
  return apartados.includes(limpiarApartado(apartado));
}

export function usuarioPuedeVerItem(user, item) {
  if (item.roles && !item.roles.includes(user?.rol)) return false;
  return usuarioPuedeVerApartado(user, item.key);
}

export function getRutaPorDefecto(user) {
  const visible = APARTADOS_APP.find((item) => usuarioPuedeVerItem(user, item));
  return visible?.path || '/login';
}
