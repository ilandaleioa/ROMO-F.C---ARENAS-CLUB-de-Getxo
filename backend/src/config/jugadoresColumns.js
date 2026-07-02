// Whitelists explicitas de columnas de la tabla "jugadores" por rol.
// El filtrado se hace SIEMPRE en el backend (select explicito a Supabase
// y saneado de la respuesta), nunca confiando en lo que oculte el frontend.

// Columnas visibles para Administrador y Responsable (incluye sensibles).
const FULL_COLUMNS = [
  'id',
  'marca_temporal',
  'nombre',
  'primer_apellido',
  'segundo_apellido',
  'equipo',
  'fecha_nacimiento',
  'lugar_nacimiento',
  'dni_jugador',
  'altura_cm',
  'peso_kg',
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
];

// Columnas visibles para Tecnico (sin datos sensibles).
const TECNICO_COLUMNS = [
  'id',
  'nombre',
  'primer_apellido',
  'segundo_apellido',
  'equipo',
  'fecha_nacimiento',
  'colegio_instituto',
  'hora_salida_colegio',
  'telefono_jugador',
  'observaciones',
  'foto_path',
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
  return FULL_COLUMNS;
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
  TECNICO_COLUMNS,
  SENSITIVE_COLUMNS,
  columnsForRole,
  sanitizeRow,
};
