// Valores permitidos para los campos deportivos editables desde la ficha.
// Unica fuente de verdad en el backend: cualquier valor fuera de estas listas
// se rechaza en el endpoint de actualizacion, sin confiar en el frontend.
const LATERALIDAD_VALUES = ['Diestro', 'Zurdo', 'Ambas'];

const DEMARCACION_VALUES = [
  'Portero',
  'Lateral Dcho',
  'Lateral Izdo',
  'Central Dcho',
  'Central Izdo',
  'Pivote',
  'Media punta',
  'Interior Dcho',
  'Interior Izdo',
  'Extremo Dcho',
  'Extremo Izdo',
  'Delantero',
];

module.exports = { LATERALIDAD_VALUES, DEMARCACION_VALUES };
