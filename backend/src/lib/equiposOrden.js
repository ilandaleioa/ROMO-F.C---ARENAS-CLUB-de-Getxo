const ORDEN_CATEGORIAS = ['JUVENIL', 'CADETE', 'INFANTIL', 'ALEVIN', 'BENJAMIN', 'PREBENJAMIN'];
const ORDEN_CATEGORIAS_DETECCION = ['PREBENJAMIN', 'BENJAMIN', 'ALEVIN', 'INFANTIL', 'CADETE', 'JUVENIL'];
const ORDEN_CLUBES = ['ROMO', 'ITZU', 'ARENAS'];
const COLLATOR = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

function limpiarTexto(valor) {
  return String(valor ?? '').trim();
}

function normalizarClave(valor) {
  return limpiarTexto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toUpperCase();
}

function encontrarClaveOrdenada(valor, orden) {
  const clave = normalizarClave(valor);
  const indice = orden.findIndex((item) => clave.includes(item));
  return indice === -1 ? orden.length : indice;
}

function detectarCategoriaEquipo(valor) {
  const clave = normalizarClave(valor);
  return ORDEN_CATEGORIAS_DETECCION.find((categoria) => clave.includes(categoria)) || '';
}

function detectarClubEquipo(valor) {
  const clave = normalizarClave(valor);
  return ORDEN_CLUBES.find((club) => clave.includes(club)) || '';
}

function clasificarEquipo(valor) {
  const texto = limpiarTexto(valor);
  return {
    texto,
    categoria: detectarCategoriaEquipo(texto),
    club: detectarClubEquipo(texto),
    categoriaOrden: encontrarClaveOrdenada(texto, ORDEN_CATEGORIAS),
    clubOrden: encontrarClaveOrdenada(texto, ORDEN_CLUBES),
  };
}

function compararEquipos(a, b) {
  const equipoA = clasificarEquipo(a);
  const equipoB = clasificarEquipo(b);

  if (equipoA.categoriaOrden !== equipoB.categoriaOrden) {
    return equipoA.categoriaOrden - equipoB.categoriaOrden;
  }
  if (equipoA.clubOrden !== equipoB.clubOrden) {
    return equipoA.clubOrden - equipoB.clubOrden;
  }

  return COLLATOR.compare(equipoA.texto, equipoB.texto);
}

function ordenarEquipos(equipos = []) {
  return [...new Set(equipos.map(limpiarTexto).filter(Boolean))].sort(compararEquipos);
}

function compararCategorias(a, b) {
  const categoriaA = encontrarClaveOrdenada(a, ORDEN_CATEGORIAS);
  const categoriaB = encontrarClaveOrdenada(b, ORDEN_CATEGORIAS);

  if (categoriaA !== categoriaB) return categoriaA - categoriaB;
  return COLLATOR.compare(limpiarTexto(a), limpiarTexto(b));
}

module.exports = {
  ORDEN_CATEGORIAS,
  ORDEN_CLUBES,
  detectarCategoriaEquipo,
  detectarClubEquipo,
  clasificarEquipo,
  compararEquipos,
  ordenarEquipos,
  compararCategorias,
};
