// Catalogo de sistemas tacticos disponibles para los campogramas.
// Cada posicion tiene coordenadas relativas a un campo horizontal (0-100):
// x=0 porteria propia (izquierda), x=100 porteria rival (derecha),
// y=0 banda superior, y=100 banda inferior.
const SISTEMAS = [
  {
    id: '1-4-4-2',
    label: '1-4-4-2',
    positions: [
      { id: 'por', label: 'Portero', x: 6, y: 50 },
      { id: 'lat_izq', label: 'Lateral izquierdo', x: 25, y: 12 },
      { id: 'cen_izq', label: 'Central izquierdo', x: 22, y: 38 },
      { id: 'cen_der', label: 'Central derecho', x: 22, y: 62 },
      { id: 'lat_der', label: 'Lateral derecho', x: 25, y: 88 },
      { id: 'med_izq', label: 'Medio izquierdo', x: 55, y: 12 },
      { id: 'med_cen_izq', label: 'Medio centro izquierdo', x: 52, y: 38 },
      { id: 'med_cen_der', label: 'Medio centro derecho', x: 52, y: 62 },
      { id: 'med_der', label: 'Medio derecho', x: 55, y: 88 },
      { id: 'del_izq', label: 'Delantero izquierdo', x: 85, y: 35 },
      { id: 'del_der', label: 'Delantero derecho', x: 85, y: 65 },
    ],
  },
  {
    id: '1-4-3-3',
    label: '1-4-3-3',
    positions: [
      { id: 'por', label: 'Portero', x: 6, y: 50 },
      { id: 'lat_izq', label: 'Lateral izquierdo', x: 25, y: 12 },
      { id: 'cen_izq', label: 'Central izquierdo', x: 22, y: 38 },
      { id: 'cen_der', label: 'Central derecho', x: 22, y: 62 },
      { id: 'lat_der', label: 'Lateral derecho', x: 25, y: 88 },
      { id: 'med_izq', label: 'Medio izquierdo', x: 52, y: 25 },
      { id: 'med_cen', label: 'Medio centro', x: 48, y: 50 },
      { id: 'med_der', label: 'Medio derecho', x: 52, y: 75 },
      { id: 'ext_izq', label: 'Extremo izquierdo', x: 85, y: 15 },
      { id: 'del_cen', label: 'Delantero centro', x: 88, y: 50 },
      { id: 'ext_der', label: 'Extremo derecho', x: 85, y: 85 },
    ],
  },
  {
    id: '1-4-2-3-1',
    label: '1-4-2-3-1',
    positions: [
      { id: 'por', label: 'Portero', x: 6, y: 50 },
      { id: 'lat_izq', label: 'Lateral izquierdo', x: 25, y: 12 },
      { id: 'cen_izq', label: 'Central izquierdo', x: 22, y: 38 },
      { id: 'cen_der', label: 'Central derecho', x: 22, y: 62 },
      { id: 'lat_der', label: 'Lateral derecho', x: 25, y: 88 },
      { id: 'piv_izq', label: 'Pivote izquierdo', x: 45, y: 35 },
      { id: 'piv_der', label: 'Pivote derecho', x: 45, y: 65 },
      { id: 'med_pta_izq', label: 'Media punta izquierda', x: 68, y: 15 },
      { id: 'med_pta_cen', label: 'Media punta centro', x: 65, y: 50 },
      { id: 'med_pta_der', label: 'Media punta derecha', x: 68, y: 85 },
      { id: 'del_cen', label: 'Delantero centro', x: 88, y: 50 },
    ],
  },
  {
    id: '1-2-3-1',
    label: '1-2-3-1 (futbol 7)',
    positions: [
      { id: 'por', label: 'Portero', x: 8, y: 50 },
      { id: 'def_izq', label: 'Defensa izquierdo', x: 30, y: 30 },
      { id: 'def_der', label: 'Defensa derecho', x: 30, y: 70 },
      { id: 'med_izq', label: 'Medio izquierdo', x: 55, y: 15 },
      { id: 'med_cen', label: 'Medio centro', x: 50, y: 50 },
      { id: 'med_der', label: 'Medio derecho', x: 55, y: 85 },
      { id: 'del_cen', label: 'Delantero centro', x: 85, y: 50 },
    ],
  },
  {
    id: '1-3-3',
    label: '1-3-3 (futbol 7)',
    positions: [
      { id: 'por', label: 'Portero', x: 8, y: 50 },
      { id: 'def_izq', label: 'Defensa izquierdo', x: 30, y: 20 },
      { id: 'def_cen', label: 'Defensa central', x: 28, y: 50 },
      { id: 'def_der', label: 'Defensa derecho', x: 30, y: 80 },
      { id: 'del_izq', label: 'Delantero izquierdo', x: 75, y: 20 },
      { id: 'del_cen', label: 'Delantero centro', x: 80, y: 50 },
      { id: 'del_der', label: 'Delantero derecho', x: 75, y: 80 },
    ],
  },
  {
    id: '1-3-2-1',
    label: '1-3-2-1 (futbol 7)',
    positions: [
      { id: 'por', label: 'Portero', x: 8, y: 50 },
      { id: 'def_izq', label: 'Defensa izquierdo', x: 28, y: 20 },
      { id: 'def_cen', label: 'Defensa central', x: 25, y: 50 },
      { id: 'def_der', label: 'Defensa derecho', x: 28, y: 80 },
      { id: 'med_izq', label: 'Medio izquierdo', x: 55, y: 35 },
      { id: 'med_der', label: 'Medio derecho', x: 55, y: 65 },
      { id: 'del_cen', label: 'Delantero centro', x: 85, y: 50 },
    ],
  },
];

const SISTEMAS_POR_ID = new Map(SISTEMAS.map((s) => [s.id, s]));

function getSistema(id) {
  return SISTEMAS_POR_ID.get(id) || null;
}

// Numero maximo de jugadores que se pueden asignar a un mismo puesto (titular + suplentes).
const MAX_JUGADORES_POR_PUESTO = 3;

module.exports = { SISTEMAS, getSistema, MAX_JUGADORES_POR_PUESTO };
