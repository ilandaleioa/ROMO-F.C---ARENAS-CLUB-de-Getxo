// Whitelists explicitas de columnas de la tabla "jugadores" por rol.
// El filtrado se hace SIEMPRE en el backend (select explicito a Supabase
// y saneado de la respuesta), nunca confiando en lo que oculte el frontend.

// Columnas visibles para Administrador y Responsable (incluye sensibles).
const FULL_COLUMNS = [
  'id',
  'club',
  'marca_temporal',
  'nombre',
  'primer_apellido',
  'segundo_apellido',
  'equipo',
  'edicion',
  'fecha_nacimiento',
  'lugar_nacimiento',
  'dni_jugador',
  'altura_cm',
  'peso_kg',
  'dorsal',
  'lateralidad',
  'demarcacion',
  'tiene_hermanos_club',
  'domicilio',
  'numero',
  'piso_letra',
  'localidad',
  'colegio_instituto',
  'club_procedencia',
  'temporada_ingreso',
  'hora_salida_colegio',
  'telefono_jugador',
  'email_jugador',
  'nombre_aita',
  'primer_apellido_aita',
  'segundo_apellido_aita',
  'dni_aita',
  'telefono_aita',
  'email_aita',
  'nombre_ama',
  'primer_apellido_ama',
  'segundo_apellido_ama',
  'dni_ama',
  'telefono_ama',
  'email_ama',
  'acepta_condiciones',
  'nombre_aceptante',
  'dni_aceptante',
  'observaciones',
  'foto_path',
  'id_legible',
];

// Columnas visibles para Responsable: todo menos datos de los tutores
// (aita/ama) y datos identificativos/sensibles del propio jugador.
const RESPONSABLE_EXCLUDED = new Set([
  'nombre_aita',
  'primer_apellido_aita',
  'segundo_apellido_aita',
  'dni_aita',
  'telefono_aita',
  'email_aita',
  'nombre_ama',
  'primer_apellido_ama',
  'segundo_apellido_ama',
  'dni_ama',
  'telefono_ama',
  'email_ama',
  'dni_jugador',
  'domicilio',
  'numero',
  'piso_letra',
  'localidad',
  'telefono_jugador',
  'email_jugador',
  'dni_aceptante',
  'nombre_aceptante',
]);
const RESPONSABLE_COLUMNS = FULL_COLUMNS.filter((c) => !RESPONSABLE_EXCLUDED.has(c));

// Columnas visibles para Tecnico (sin datos sensibles).
const TECNICO_COLUMNS = [
  'id',
  'club',
  'nombre',
  'primer_apellido',
  'segundo_apellido',
  'equipo',
  'edicion',
  'fecha_nacimiento',
  'dorsal',
  'lateralidad',
  'demarcacion',
  'colegio_instituto',
  'hora_salida_colegio',
  'telefono_jugador',
  'observaciones',
  'foto_path',
  'id_legible',
];

// Columnas necesarias para listados, graficas y campogramas. La ficha
// individual sigue usando columnsForRole para cargar el detalle completo.
const LIST_COLUMNS = [
  'id',
  'club',
  'nombre',
  'primer_apellido',
  'segundo_apellido',
  'equipo',
  'edicion',
  'fecha_nacimiento',
  'dorsal',
  'lateralidad',
  'demarcacion',
  'localidad',
  'foto_path',
  'id_legible',
];

// Columnas consideradas sensibles (documentacion / referencia).
const SENSITIVE_COLUMNS = [
  'dni_jugador',
  'domicilio',
  'numero',
  'piso_letra',
  'dni_aita',
  'dni_ama',
  'telefono_aita',
  'telefono_ama',
  'email_aita',
  'email_ama',
  'dni_aceptante',
];

const { ROLES } = require('./roles');

function columnsForRole(rol) {
  if (rol === ROLES.TECNICO) return TECNICO_COLUMNS;
  if (rol === ROLES.RESPONSABLE) return RESPONSABLE_COLUMNS;
  return FULL_COLUMNS; // administrador, director
}

function listColumnsForRole(rol) {
  const allowed = new Set(columnsForRole(rol));
  return LIST_COLUMNS.filter((column) => allowed.has(column));
}

// Elimina de cada fila cualquier campo que no este en la whitelist del rol,
// como segunda barrera ademas del "select" explicito hecho a Supabase.
function sanitizeRow(row, rol) {
  const allowed = new Set(columnsForRole(rol));
  const clean = {};
  for (const key of Object.keys(row)) {
    if (allowed.has(key)) clean[key] = row[key];
  }
  return clean;
}

module.exports = {
  FULL_COLUMNS,
  RESPONSABLE_COLUMNS,
  TECNICO_COLUMNS,
  LIST_COLUMNS,
  SENSITIVE_COLUMNS,
  columnsForRole,
  listColumnsForRole,
  sanitizeRow,
};
