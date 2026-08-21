const express = require('express');
const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const { ROLES } = require('../config/roles');

const router = express.Router();
const TABLA_CAPTACION = 'Captación_ Base de datos';
const TABLA_INFORMES = 'captacion_informes';

const CAMPOS = [
  'id_jugador', 'fecha_alta', 'quien_da_alta', 'club', 'equipo', 'etapa', 'categoria', 'grupo', 'enlace',
  'nombre', 'primer_apellido', 'segundo_apellido', 'dorsal', 'altura', 'lateralidad',
  'foto_jugador', 'fecha_nacimiento', 'anio_nacimiento', 'edad', 'demarcacion', 'otra_demarcacion', 'demarcacion_concreta',
  'valoracion_responsable', 'valoracion_general', 'descripcion_jugador', 'observaciones', 'valoracion_items',
  'tutor_nombre', 'tutor_telefono', 'telefono_jugador',
];

const CAMPOS_INFORMES = [
  'fecha',
  'observador',
  'jugador_id',
  'club',
  'equipo',
  'etapa',
  'categoria',
  'local',
  'visitante',
  'partido',
  'dorsal',
  'tipologia',
  'lateralidad',
  'descripcion',
  'valoracion',
  'demarcacion_concreta',
  'titularidad',
  'minutos_jugados',
  'goles',
  'goles_encajados',
  'valoracion_items',
];

const ITEMS_VALORACION_POR_DEMARCACION = {
  'Portero': [
    'asociacion_linea_defensiva',
    'conduccion_fijaciones',
    'pases_en_corto',
    'desplazamientos_medios',
    'desplazamientos_largos',
    'inicio_transicion_ofensiva_pies',
  ],
  'Lateral Dcho': [
    'salida_de_balon',
    'manejo_espacio_reducido',
    'desplazamiento_largo',
    'incorporaciones',
    'asociaciones_campo_rival',
    'desmarque_ruptura',
  ],
  'Lateral Izdo': [
    'salida_de_balon',
    'manejo_espacio_reducido',
    'desplazamiento_largo',
    'incorporaciones',
    'asociaciones_campo_rival',
    'desmarque_ruptura',
  ],
  'Central Dcho': [
    'anticipacion_marca',
    'juego_aereo_defensivo',
    'cobertura_ayudas',
    'salida_de_balon',
    'pase_largo_diagonal',
    'duelos_individuales',
  ],
  'Central Izdo': [
    'anticipacion_marca',
    'juego_aereo_defensivo',
    'cobertura_ayudas',
    'salida_de_balon',
    'pase_largo_diagonal',
    'duelos_individuales',
  ],
  'Pivote': [
    'recepcion_bajo_presion',
    'distribucion_juego',
    'cobertura_espacios',
    'recuperacion_balon',
    'cambio_orientacion',
    'proteccion_balon',
  ],
  'Media punta': [
    'ultimo_pase',
    'llegada_area',
    'asociacion_espacios_reducidos',
    'vision_periferica',
    'regate_corto',
    'remate',
  ],
  'Interior Dcho': [
    'llegada_area',
    'asociacion_juego',
    'presion_tras_perdida',
    'desmarque_ruptura',
    'conduccion_progresion',
    'remate',
  ],
  'Interior Izdo': [
    'llegada_area',
    'asociacion_juego',
    'presion_tras_perdida',
    'desmarque_ruptura',
    'conduccion_progresion',
    'remate',
  ],
  'Extremo Dcho': [
    'regate_uno_contra_uno',
    'desborde',
    'centro_balon',
    'definicion_llegada_area',
    'repliegue_defensivo',
    'velocidad_espacio',
  ],
  'Extremo Izdo': [
    'regate_uno_contra_uno',
    'desborde',
    'centro_balon',
    'definicion_llegada_area',
    'repliegue_defensivo',
    'velocidad_espacio',
  ],
  'Delantero': [
    'definicion',
    'juego_espaldas_defensa',
    'remate_cabeza',
    'desmarque_ruptura',
    'presion_primer_defensor',
    'asociacion_area',
  ],
};

function limpiarValoracionItems(demarcacionConcreta, valoracionItems) {
  const itemsPermitidos = ITEMS_VALORACION_POR_DEMARCACION[demarcacionConcreta] || [];
  if (!itemsPermitidos.length || !valoracionItems || typeof valoracionItems !== 'object') return {};

  return itemsPermitidos.reduce((resultado, item) => {
    const valor = Number(valoracionItems[item]);
    if (Number.isInteger(valor) && valor >= 1 && valor <= 5) resultado[item] = valor;
    return resultado;
  }, {});
}

function normalizarClaveItemInformeCompleto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function construirClavesInformeCompleto(etiquetas) {
  const clavesUsadas = new Map();
  return etiquetas.map((label) => {
    const claveBase = normalizarClaveItemInformeCompleto(label);
    const veces = (clavesUsadas.get(claveBase) || 0) + 1;
    clavesUsadas.set(claveBase, veces);
    return veces > 1 ? `${claveBase}_${veces}` : claveBase;
  });
}

const FISICO_ESTANDAR = ['Velocidad', 'Potencia', 'Aceleracion', 'Salto', 'Fuerza'];

const GRUPOS_INFORME_COMPLETO = ['fisico', 'conBalon', 'sinBalon'];

const ITEMS_INFORME_COMPLETO_POR_DEMARCACION = {
  'PORTERO': {
    conBalon: construirClavesInformeCompleto([
      'Asociacion con linea defensiva',
      'Conduccion fijaciones',
      'Pases en corto',
      'Desplazamientos medios',
      'Desplazamientos largos',
      'Inicio de transicion ofensiva con pies',
      'Inicio de transicion ofensiva con manos',
    ]),
    sinBalon: construirClavesInformeCompleto([
      'Acciones debajo de los palos',
      'Salidas 1 contra 1',
      'Juego aereo frontal',
      'Juego aereo lateral',
      'Segundas jugadas',
      'Bloqueos',
      'Dominio area juego lateral',
      'Dominio distancia linea defensiva',
    ]),
    fisico: construirClavesInformeCompleto(['Velocidad', 'Potencia', 'Desplazamiento lateral', 'Salto', 'Fuerza']),
  },
  'LATERAL': {
    conBalon: construirClavesInformeCompleto([
      'Salida de balon',
      'Manejo espacio reducido',
      'Desplazamiento largo',
      'Incorporaciones',
      'Asociaciones en campo rival',
      'Desmarque ruptura',
      'Duelos 1 contra 1',
      'Centros laterales en ultimo tercio',
    ]),
    sinBalon: construirClavesInformeCompleto([
      'Acciones de duelo terrestre',
      'Acciones de duelo aereo',
      'Comportamiento dentro del area',
      'Orientaciones',
      'Defender situacion con pelota alejada',
      'Eleccion momento entrada',
      'Defensa balon espalda',
      'Dominio de la linea defensiva',
    ]),
    fisico: construirClavesInformeCompleto(FISICO_ESTANDAR),
  },
  'CENTRAL': {
    conBalon: construirClavesInformeCompleto([
      'Salida de balon (pases filtrados)',
      'Desplazamiento corto',
      'Desplazamiento largo',
      'Conducciones para progresar',
      'Incorporacion ataque',
      'Comunicacion',
      'Vigil',
      'Juego aereo ofensivo',
    ]),
    sinBalon: construirClavesInformeCompleto([
      'Defensa area',
      'Acciones de duelo terrestre',
      'Acciones de duelo aereo',
      'Anticipacion',
      'Ganar duelos en campo abierto',
      'Capacidad para girar',
      'Vigilancias',
      'Dominio de la linea defensiva',
    ]),
    fisico: construirClavesInformeCompleto(FISICO_ESTANDAR),
  },
  'MEDIO CENTRO 6': {
    conBalon: construirClavesInformeCompleto([
      'Manejo balon',
      'Manejo tiempos',
      'Cambios de orientacion',
      'Capacidad para girar',
      'Dominio espacial - orientaciones',
      'Crear lineas de pase',
      'Primer contacto',
      'Controles orientados',
    ]),
    sinBalon: construirClavesInformeCompleto([
      'Defender juego aereo frontal/diagonal',
      'Defender situaciones en pasillo central/lateral',
      'Capacidad de ir a linea defensiva',
      'Temporizar',
      'Recuperaciones',
      'Anticipacion',
      'Repliegue',
      'Retornos',
    ]),
    fisico: construirClavesInformeCompleto(FISICO_ESTANDAR),
  },
  'INTERIOR': {
    conBalon: construirClavesInformeCompleto([
      'Pases filtrados - verticalidad',
      'Pases ventajosos definitivos',
      'Arrancadas - conducciones',
      'Recibir en 3/4',
      'Girar entre lineas',
      'Capacidad de llegada',
      'Filtrar ultimo pase',
      'Finalizar accion',
    ]),
    sinBalon: construirClavesInformeCompleto([
      'Actividad defensiva para recuperar',
      'Presion orientada',
      'Presion tras perdida',
      'Anticipacion',
      'Retornos',
      'Duelos terrestres',
      'Duelos aereos',
      'Agresividad',
    ]),
    fisico: construirClavesInformeCompleto(FISICO_ESTANDAR),
  },
  'EXTREMO': {
    conBalon: construirClavesInformeCompleto([
      'Desmarques de ruptura',
      'Centros laterales',
      'Asistencia',
      'Acciones de 1vs1 en movimiento',
      'Acciones de 1vs1 en parado',
      'Centros',
      'Finalizar desde fuera',
      'Ir al espalda linea defensiva',
    ]),
    sinBalon: construirClavesInformeCompleto([
      'Defender cerrando lado opuesto',
      'Capacidad recuperar en su zona',
      'Capacidad def de no ser superado',
      'Recuperaciones balon',
      'Ayudas al lateral',
      'Anticipacion',
      'Orientar la presion',
      'Tapar lineas de pase',
    ]),
    fisico: construirClavesInformeCompleto(FISICO_ESTANDAR),
  },
  'DELANTERO': {
    conBalon: construirClavesInformeCompleto([
      'Remates en area',
      'Juego de espaldas',
      'Tiro',
      'Asistencias',
      'Dar apoyo y continuidad al juego',
      'Dar profundidad (prolongacion/desvio)',
      'Remate de centro lateral',
      'Capacidad de jugar solo o con companero linea',
    ]),
    sinBalon: construirClavesInformeCompleto([
      'Presion orientada',
      'Presion tras perdida',
      'Duelo',
      'Retornos',
      'Ayudas al lateral',
      'Anticipacion',
      'Orientar la presion',
      'Tapar lineas de pase',
    ]),
    fisico: construirClavesInformeCompleto(FISICO_ESTANDAR),
  },
  'MEDIA PUNTA': {
    conBalon: construirClavesInformeCompleto([
      'Arrancadas - conducciones',
      'Ultimos y penultimos pases',
      'Remate',
      'Tiro',
      'Asistencia',
      'Movilidades dentro-fuera',
      'Romper linea defensiva',
      'Hace desmarque o se mueve reactivamente',
    ]),
    sinBalon: construirClavesInformeCompleto([
      'Presion orientada',
      'Presion tras perdida',
      'Duelo',
      'Anticipacion',
      'Retornos',
      'Duelos terrestres',
      'Duelos aereos',
      'Tapar lineas de pase',
    ]),
    fisico: construirClavesInformeCompleto(FISICO_ESTANDAR),
  },
};

function limpiarValoracionItemsInformeCompleto(valoracionItems) {
  const demarcacion = String(valoracionItems?.demarcacion || '').trim().toUpperCase();
  const grupos = ITEMS_INFORME_COMPLETO_POR_DEMARCACION[demarcacion];
  if (!grupos || !valoracionItems || typeof valoracionItems !== 'object') {
    return { demarcacion: '', conBalon: {}, sinBalon: {}, fisico: {} };
  }

  const resultado = { demarcacion };
  GRUPOS_INFORME_COMPLETO.forEach((grupo) => {
    const itemsPermitidos = grupos[grupo] || [];
    const valoresGrupo = valoracionItems[grupo];
    resultado[grupo] = itemsPermitidos.reduce((acumulado, item) => {
      const valor = Number(valoresGrupo?.[item]);
      if (Number.isInteger(valor) && valor >= 1 && valor <= 5) acumulado[item] = valor;
      return acumulado;
    }, {});
  });
  return resultado;
}

router.use(requireAuth);

function normalizarTextoError(error) {
  return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

function esErrorDeConexion(error) {
  const texto = normalizarTextoError(error);
  return /fetch failed|econn|enotfound|etimedout|network|timeout/i.test(texto);
}

function limpiarPayload(body) {
  const payload = CAMPOS.filter((campo) => campo !== 'valoracion_items').reduce((acumulado, campo) => {
    acumulado[campo] = String(body?.[campo] || '').trim();
    return acumulado;
  }, {});
  payload.valoracion_items = limpiarValoracionItemsInformeCompleto(body?.valoracion_items);
  return payload;
}

function validarPayload(payload) {
  if (!payload.nombre) return 'El nombre es obligatorio.';
  if (!payload.primer_apellido) return 'El primer apellido es obligatorio.';
  return null;
}

function obtenerFechaHoyISO() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function limpiarRegistroSegunRol(registro, rol) {
  if (!registro) {
    return registro;
  }

  const { id_jugador, ...resto } = registro;
  return resto;
}

function idJugadorValido(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(valor || '').trim());
}

function esTablaInexistente(error) {
  const texto = normalizarTextoError(error);
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /could not find the table/i.test(texto) ||
    /\btable\b.*\bdoes not exist\b/i.test(texto) ||
    /\brelation\b.*\bdoes not exist\b/i.test(texto)
  );
}

function esColumnaInexistente(error, columna) {
  const columnaNormalizada = String(columna || '').trim().toLowerCase();

  if (!columnaNormalizada) return false;

  return extraerColumnaInexistente(error) === columnaNormalizada;
}

function extraerColumnaInexistente(error) {
  const texto = normalizarTextoError(error);
  const patrones = [
    /column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i,
    /column\s+'([^']+)'\s+of\s+relation\s+'[^']+'\s+does\s+not\s+exist/i,
    /column\s+"([^"]+)"\s+does\s+not\s+exist/i,
    /column\s+'([^']+)'\s+does\s+not\s+exist/i,
    /column\s+([a-z0-9_]+)\s+does\s+not\s+exist/i,
    /could not find the\s+'([^']+)'\s+column/i,
    /could not find the\s+"([^"]+)"\s+column/i,
  ];

  for (const patron of patrones) {
    const match = texto.match(patron);
    if (match?.[1]) {
      return match[1].trim().toLowerCase();
    }
  }

  return null;
}

function omitirCampos(payload, omitidas) {
  const resultado = { ...payload };
  for (const campo of omitidas) {
    delete resultado[campo];
  }
  return resultado;
}

async function ejecutarConFallbackCampos(ejecutar, camposValidos = CAMPOS) {
  const omitidas = new Set();

  while (true) {
    const respuesta = await ejecutar(omitidas);
    if (!respuesta?.error) {
      return respuesta;
    }

    const faltante = extraerColumnaInexistente(respuesta.error);
    if (!faltante || omitidas.has(faltante) || !camposValidos.includes(faltante)) {
      return respuesta;
    }

    // Etapa es un dato funcional del formulario. Omitirlo y devolver 200 hace
    // que parezca guardado, pero se pierde al volver a cargar el registro.
    if (faltante === 'etapa') {
      return respuesta;
    }

    omitidas.add(faltante);
  }
}

function responderError(res, error, accion) {
  console.error(`Error ${accion} registros de captacion:`, {
    code: error?.code, message: error?.message, details: error?.details, hint: error?.hint,
  });
  if (esErrorDeConexion(error)) {
    return res.status(503).json({
      error: 'No se pudo conectar con Supabase. Comprueba la conexion del backend y vuelve a intentarlo.',
    });
  }
  if (esTablaInexistente(error)) {
    return res.status(503).json({
      error: `No existe la tabla "${TABLA_CAPTACION}" en Supabase. Ejecuta backend/scripts/crear-tabla-captacion.sql en el editor SQL.`,
    });
  }
  if (extraerColumnaInexistente(error)) {
    return res.status(503).json({
      error: 'La tabla de captacion no tiene el esquema esperado. Ejecuta backend/scripts/crear-tabla-captacion.sql en Supabase.',
    });
  }
  return res.status(503).json({ error: `No se pudo ${accion} el registro de captacion.` });
}

function responderErrorInformes(res, error, accion) {
  console.error(`Error ${accion} informes de captacion:`, {
    code: error?.code, message: error?.message, details: error?.details, hint: error?.hint,
  });
  if (esErrorDeConexion(error)) {
    return res.status(503).json({
      error: 'No se pudo conectar con Supabase. Comprueba la conexion del backend y vuelve a intentarlo.',
    });
  }
  if (esTablaInexistente(error)) {
    return res.status(503).json({
      error: `No existe la tabla "${TABLA_INFORMES}" en Supabase. Ejecuta backend/scripts/crear-tabla-captacion-informes.sql en el editor SQL.`,
    });
  }
  if (extraerColumnaInexistente(error)) {
    return res.status(503).json({
      error: 'La tabla de informes de captacion no tiene el esquema esperado. Ejecuta backend/scripts/crear-tabla-captacion-informes.sql en Supabase.',
    });
  }
  return res.status(503).json({ error: `No se pudo ${accion} el informe de captacion.` });
}

function limpiarInformePayload(body) {
  const payload = CAMPOS_INFORMES.filter((campo) => campo !== 'valoracion_items').reduce((acumulado, campo) => {
    acumulado[campo] = String(body?.[campo] || '').trim();
    return acumulado;
  }, {});
  payload.valoracion_items = limpiarValoracionItems(payload.demarcacion_concreta, body?.valoracion_items);
  return payload;
}

function validarInformePayload(payload) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.fecha)) return 'La fecha del informe no es valida.';
  if (!payload.observador) return 'El observador es obligatorio.';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.jugador_id)) {
    return 'Debes seleccionar un jugador de la base de datos de captacion.';
  }
  return null;
}

function completarInformeConJugador(payload, jugador) {
  return { ...payload };
}

async function enriquecerInformes(informes) {
  const ids = Array.from(new Set((informes || []).map((informe) => informe.jugador_id).filter(Boolean)));
  if (!ids.length) return informes || [];
  const { data: jugadores, error } = await supabaseAdmin
    .from(TABLA_CAPTACION)
    .select('id, nombre, primer_apellido, segundo_apellido, club, equipo, categoria, dorsal, lateralidad, foto_jugador')
    .in('id', ids);
  if (error) throw error;
  const jugadoresPorId = new Map((jugadores || []).map((jugador) => [jugador.id, jugador]));
  return (informes || []).map((informe) => ({ ...informe, jugador: jugadoresPorId.get(informe.jugador_id) || null }));
}

async function obtenerJugadorParaInforme(jugadorId) {
  const { data, error } = await supabaseAdmin
    .from(TABLA_CAPTACION)
    .select('id, nombre, primer_apellido, segundo_apellido, club, equipo, categoria, dorsal, lateralidad, foto_jugador')
    .eq('id', jugadorId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

router.get('/', async (_req, res) => {
  try {
    const { rol } = _req.user;
    const { data, error } = await supabaseAdmin.from(TABLA_CAPTACION).select('*');
    if (error) return responderError(res, error, 'consultar');
    return res.json({ registros: (data || []).map((registro) => limpiarRegistroSegunRol(registro, rol)) });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
});

router.get('/informes', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLA_INFORMES)
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      if (esTablaInexistente(error)) {
        console.warn(`La tabla "${TABLA_INFORMES}" no existe en Supabase. Se devuelve una lista vacia para no bloquear la pantalla de captacion.`);
        return res.json({ informes: [] });
      }
      return responderErrorInformes(res, error, 'consultar');
    }
    return res.json({ informes: await enriquecerInformes(data || []) });
  } catch (error) {
    if (esTablaInexistente(error)) {
      console.warn(`La tabla "${TABLA_INFORMES}" no existe en Supabase. Se devuelve una lista vacia para no bloquear la pantalla de captacion.`);
      return res.json({ informes: [] });
    }
    return responderErrorInformes(res, error, 'consultar');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rol } = req.user;
    const { data, error } = await supabaseAdmin
      .from(TABLA_CAPTACION)
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) return responderError(res, error, 'consultar');
    if (!data) return res.status(404).json({ error: 'Registro de captacion no encontrado.' });
    return res.json({ registro: limpiarRegistroSegunRol(data, rol) });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
});

router.post('/', async (req, res) => {
  try {
    const { rol, club: clubSesion, username } = req.user;
    const payload = limpiarPayload(req.body);
    const validationError = validarPayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });
    if (!payload.fecha_alta) payload.fecha_alta = obtenerFechaHoyISO();
    if (!payload.club) payload.club = String(clubSesion || '').trim();
    if (!payload.quien_da_alta) payload.quien_da_alta = String(username || '').trim();
    payload.id_jugador = rol === ROLES.ADMINISTRADOR && idJugadorValido(payload.id_jugador)
      ? payload.id_jugador
      : crypto.randomUUID();
    const { data, error } = await ejecutarConFallbackCampos((omitidas) =>
      supabaseAdmin
        .from(TABLA_CAPTACION)
        .insert(omitirCampos(payload, omitidas))
        .select('*')
        .single(),
      CAMPOS
    );
    if (error) return responderError(res, error, 'guardar');
    return res.status(201).json({ registro: limpiarRegistroSegunRol(data, rol) });
  } catch (error) {
    return responderError(res, error, 'guardar');
  }
});

router.post('/informes', async (req, res) => {
  try {
    const payload = limpiarInformePayload(req.body);
    const validationError = validarInformePayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });
    const jugador = await obtenerJugadorParaInforme(payload.jugador_id);
    if (!jugador) return res.status(400).json({ error: 'El jugador seleccionado ya no existe en la base de datos de captacion.' });
    const payloadFinal = completarInformeConJugador(payload, jugador);
    const { data, error } = await ejecutarConFallbackCampos((omitidas) =>
      supabaseAdmin
        .from(TABLA_INFORMES)
        .insert(omitirCampos(payloadFinal, omitidas))
        .select('*')
        .single(),
      CAMPOS_INFORMES
    );
    if (error) return responderErrorInformes(res, error, 'guardar');
    return res.status(201).json({ informe: { ...data, jugador } });
  } catch (error) {
    return responderErrorInformes(res, error, 'guardar');
  }
});

router.put('/informes/:id', async (req, res) => {
  try {
    const payload = limpiarInformePayload(req.body);
    const validationError = validarInformePayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });
    const jugador = await obtenerJugadorParaInforme(payload.jugador_id);
    if (!jugador) return res.status(400).json({ error: 'El jugador seleccionado ya no existe en la base de datos de captacion.' });
    const payloadFinal = completarInformeConJugador(payload, jugador);
    const { data, error } = await ejecutarConFallbackCampos((omitidas) =>
      supabaseAdmin
        .from(TABLA_INFORMES)
        .update(omitirCampos(payloadFinal, omitidas))
        .eq('id', req.params.id)
        .select('*')
        .maybeSingle(),
      CAMPOS_INFORMES
    );
    if (error) return responderErrorInformes(res, error, 'actualizar');
    if (!data) return res.status(404).json({ error: 'Informe de captacion no encontrado.' });
    return res.json({ informe: { ...data, jugador } });
  } catch (error) {
    return responderErrorInformes(res, error, 'actualizar');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { rol } = req.user;
    const payload = limpiarPayload(req.body);
    const validationError = validarPayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });
    delete payload.id_jugador;
    const { data, error } = await ejecutarConFallbackCampos((omitidas) =>
      supabaseAdmin
        .from(TABLA_CAPTACION)
        .update(omitirCampos(payload, omitidas))
        .eq('id', req.params.id)
        .select('*')
        .maybeSingle(),
      CAMPOS
    );
    if (error) return responderError(res, error, 'actualizar');
    if (!data) return res.status(404).json({ error: 'Registro de captacion no encontrado.' });
    return res.json({ registro: limpiarRegistroSegunRol(data, rol) });
  } catch (error) {
    return responderError(res, error, 'actualizar');
  }
});

router.delete('/informes/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from(TABLA_INFORMES).delete().eq('id', req.params.id).select('id').maybeSingle();
    if (error) return responderErrorInformes(res, error, 'eliminar');
    if (!data) return res.status(404).json({ error: 'Informe de captacion no encontrado.' });
    return res.json({ ok: true });
  } catch (error) {
    return responderErrorInformes(res, error, 'eliminar');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from(TABLA_CAPTACION).delete().eq('id', req.params.id).select('id').maybeSingle();
    if (error) return responderError(res, error, 'eliminar');
    if (!data) return res.status(404).json({ error: 'Registro de captacion no encontrado.' });
    return res.json({ ok: true });
  } catch (error) {
    return responderError(res, error, 'eliminar');
  }
});

module.exports = router;
