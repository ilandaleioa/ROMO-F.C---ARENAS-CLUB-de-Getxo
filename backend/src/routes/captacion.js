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
  'nombre', 'primer_apellido', 'segundo_apellido', 'dorsal', 'tipologia', 'altura', 'lateralidad',
  'foto_jugador', 'fecha_nacimiento', 'anio_nacimiento', 'edad', 'demarcacion', 'otra_demarcacion',
  'valoracion_general', 'descripcion_jugador', 'observaciones',
];

router.use(requireAuth);

function limpiarPayload(body) {
  return CAMPOS.reduce((payload, campo) => {
    payload[campo] = String(body?.[campo] || '').trim();
    return payload;
  }, {});
}

function validarPayload(payload) {
  if (!payload.nombre) return 'El nombre es obligatorio.';
  if (!payload.primer_apellido) return 'El primer apellido es obligatorio.';
  return null;
}

function limpiarRegistroSegunRol(registro, rol) {
  if (!registro || rol === ROLES.ADMINISTRADOR) {
    return registro;
  }

  const { id_jugador, ...resto } = registro;
  return resto;
}

function idJugadorValido(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(valor || '').trim());
}

function esTablaInexistente(error) {
  const texto = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  return error?.code === '42P01' || error?.code === 'PGRST205' || /does not exist|not find|no existe/i.test(texto);
}

function responderError(res, error, accion) {
  console.error(`Error ${accion} registros de captacion:`, {
    code: error?.code, message: error?.message, details: error?.details, hint: error?.hint,
  });
  if (esTablaInexistente(error)) return res.status(503).json({ error: `No existe la tabla "${TABLA_CAPTACION}" en Supabase.` });
  return res.status(503).json({ error: `No se pudo ${accion} el registro de captacion.` });
}

function responderErrorInformes(res, error, accion) {
  console.error(`Error ${accion} informes de captacion:`, {
    code: error?.code, message: error?.message, details: error?.details, hint: error?.hint,
  });
  if (esTablaInexistente(error)) {
    return res.status(503).json({ error: `No existe la tabla "${TABLA_INFORMES}" en Supabase. Ejecuta el SQL de creacion de informes.` });
  }
  return res.status(503).json({ error: `No se pudo ${accion} el informe de captacion.` });
}

function limpiarInformePayload(body) {
  return {
    fecha: String(body?.fecha || '').trim(),
    observador: String(body?.observador || '').trim(),
    jugador_id: String(body?.jugador_id || '').trim(),
  };
}

function validarInformePayload(payload) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.fecha)) return 'La fecha del informe no es valida.';
  if (!payload.observador) return 'El observador es obligatorio.';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.jugador_id)) {
    return 'Debes seleccionar un jugador de la base de datos de captacion.';
  }
  return null;
}

async function enriquecerInformes(informes) {
  const ids = Array.from(new Set((informes || []).map((informe) => informe.jugador_id).filter(Boolean)));
  if (!ids.length) return informes || [];
  const { data: jugadores, error } = await supabaseAdmin
    .from(TABLA_CAPTACION)
    .select('id, nombre, primer_apellido, segundo_apellido, club, equipo, etapa, categoria')
    .in('id', ids);
  if (error) throw error;
  const jugadoresPorId = new Map((jugadores || []).map((jugador) => [jugador.id, jugador]));
  return (informes || []).map((informe) => ({ ...informe, jugador: jugadoresPorId.get(informe.jugador_id) || null }));
}

async function obtenerJugadorParaInforme(jugadorId) {
  const { data, error } = await supabaseAdmin
    .from(TABLA_CAPTACION)
    .select('id, nombre, primer_apellido, segundo_apellido, club, equipo, etapa, categoria')
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
    if (error) return responderErrorInformes(res, error, 'consultar');
    return res.json({ informes: await enriquecerInformes(data || []) });
  } catch (error) {
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
    const { rol } = req.user;
    const payload = limpiarPayload(req.body);
    const validationError = validarPayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });
    payload.id_jugador = rol === ROLES.ADMINISTRADOR && idJugadorValido(payload.id_jugador)
      ? payload.id_jugador
      : crypto.randomUUID();
    const { data, error } = await supabaseAdmin.from(TABLA_CAPTACION).insert(payload).select('*').single();
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
    const { data, error } = await supabaseAdmin.from(TABLA_INFORMES).insert(payload).select('*').single();
    if (error) return responderErrorInformes(res, error, 'guardar');
    return res.status(201).json({ informe: { ...data, jugador } });
  } catch (error) {
    return responderErrorInformes(res, error, 'guardar');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { rol } = req.user;
    const payload = limpiarPayload(req.body);
    const validationError = validarPayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });
    delete payload.id_jugador;
    const { data, error } = await supabaseAdmin.from(TABLA_CAPTACION).update(payload).eq('id', req.params.id).select('*').maybeSingle();
    if (error) return responderError(res, error, 'actualizar');
    if (!data) return res.status(404).json({ error: 'Registro de captacion no encontrado.' });
    return res.json({ registro: limpiarRegistroSegunRol(data, rol) });
  } catch (error) {
    return responderError(res, error, 'actualizar');
  }
});

router.put('/informes/:id', async (req, res) => {
  try {
    const payload = limpiarInformePayload(req.body);
    const validationError = validarInformePayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });
    const jugador = await obtenerJugadorParaInforme(payload.jugador_id);
    if (!jugador) return res.status(400).json({ error: 'El jugador seleccionado ya no existe en la base de datos de captacion.' });
    const { data, error } = await supabaseAdmin.from(TABLA_INFORMES).update(payload).eq('id', req.params.id).select('*').maybeSingle();
    if (error) return responderErrorInformes(res, error, 'actualizar');
    if (!data) return res.status(404).json({ error: 'Informe de captacion no encontrado.' });
    return res.json({ informe: { ...data, jugador } });
  } catch (error) {
    return responderErrorInformes(res, error, 'actualizar');
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

module.exports = router;
