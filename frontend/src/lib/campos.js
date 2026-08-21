// Etiquetas legibles para los campos de "jugadores".
// Que un campo tenga aqui su etiqueta no implica que se muestre: el backend
// ya envia solo las columnas permitidas segun el rol del usuario.
export const ETIQUETAS_JUGADOR = {
  marca_temporal: 'Fecha de inscripcion',
  nombre: 'Nombre',
  primer_apellido: 'Primer apellido',
  segundo_apellido: 'Segundo apellido',
  equipo: 'Equipo',
  edicion: 'Edicion',
  fecha_nacimiento: 'Fecha de nacimiento',
  anio_nacimiento: 'Ano de nacimiento',
  edad: 'Edad',
  lugar_nacimiento: 'Lugar de nacimiento',
  dni_jugador: 'DNI del jugador',
  altura_cm: 'Altura (cm)',
  peso_kg: 'Peso (kg)',
  dorsal: 'Dorsal',
  lateralidad: 'Lateralidad',
  demarcacion: 'Demarcacion',
  tiene_hermanos_club: 'Hermanos en el club',
  domicilio: 'Domicilio',
  numero: 'Numero',
  piso_letra: 'Piso / letra',
  localidad: 'Localidad',
  colegio_instituto: 'Colegio / instituto',
  club_procedencia: 'Club de procedencia',
  temporada_ingreso: 'Temporada de ingreso',
  hora_salida_colegio: 'Hora de salida del colegio',
  telefono_jugador: 'Telefono del jugador',
  email_jugador: 'Email del jugador',
  nombre_aita: 'Nombre del padre',
  primer_apellido_aita: 'Primer apellido del padre',
  segundo_apellido_aita: 'Segundo apellido del padre',
  dni_aita: 'DNI del padre',
  telefono_aita: 'Telefono del padre',
  email_aita: 'Email del padre',
  nombre_ama: 'Nombre de la madre',
  primer_apellido_ama: 'Primer apellido de la madre',
  segundo_apellido_ama: 'Segundo apellido de la madre',
  dni_ama: 'DNI de la madre',
  telefono_ama: 'Telefono de la madre',
  email_ama: 'Email de la madre',
  acepta_condiciones: 'Acepta condiciones',
  nombre_aceptante: 'Nombre del aceptante',
  dni_aceptante: 'DNI del aceptante',
  observaciones: 'Observaciones',
};

// Opciones validas para los desplegables de datos deportivos (deben coincidir
// con backend/src/config/datosDeportivos.js).
export const LATERALIDAD_OPCIONES = ['Diestro', 'Zurdo', 'Ambas'];
export const DEMARCACION_OPCIONES = ['Portero', 'Lateral', 'Central', 'Medio', 'Media punta', 'Extremo', 'Delantero'];

// Orden de las secciones/campos en la ficha de detalle.
export const SECCIONES_FICHA = [
  {
    titulo: 'Datos deportivos',
    campos: ['dorsal', 'lateralidad', 'demarcacion'],
  },
  {
    titulo: 'Datos del jugador',
    campos: [
      'nombre',
      'primer_apellido',
      'segundo_apellido',
      'equipo',
      'edicion',
      'lugar_nacimiento',
      'dni_jugador',
      'altura_cm',
      'peso_kg',
      'tiene_hermanos_club',
      'club_procedencia',
      'temporada_ingreso',
    ],
  },
  {
    titulo: 'Nacimiento',
    campos: ['fecha_nacimiento', 'anio_nacimiento', 'edad'],
  },
  {
    titulo: 'Colegio',
    campos: ['colegio_instituto', 'hora_salida_colegio'],
  },
  {
    titulo: 'Domicilio',
    campos: ['domicilio', 'numero', 'piso_letra', 'localidad'],
  },
  {
    titulo: 'Datos del padre',
    campos: ['nombre_aita', 'primer_apellido_aita', 'segundo_apellido_aita', 'dni_aita', 'telefono_aita', 'email_aita'],
  },
  {
    titulo: 'Datos de la madre',
    campos: ['nombre_ama', 'primer_apellido_ama', 'segundo_apellido_ama', 'dni_ama', 'telefono_ama', 'email_ama'],
  },
];
