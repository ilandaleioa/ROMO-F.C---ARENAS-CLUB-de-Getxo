const express = require('express');
const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// El nombre contiene espacios y caracteres no ASCII porque es el nombre real
// de la tabla creada en Supabase. PostgREST lo acepta como nombre de tabla.
const TABLA_CAPTACION = 'Captación_ Base de datos';

const CAMPOS = [
  'id_jugador',
  'fecha_alta',
  'quien_da_alta',
  'club',
  'equipo',
  'categoria',
  'grupo',
  'enlace',
  'nombre',
  'primer_apellido',
  'segundo_apellido',
  'dorsal',
  'tipologia',
  'altura',
  'lateralidad',
  'foto_jugador',
  'fecha_nacimiento',
  'anio_nacimiento',
  'edad',
  'demarcacion',
  'otra_demarcacion',
  'valoracion_general',
  'descripcion_jugador',
  'observaciones',
];

router.use(requireAuth);

function limpiarPayload(body) {
  return CAMPOS.reduce((payload, campo) => {
    payload[campo] = String(body?.[campo] || '').trim();
    return payload;
  }, {});
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
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });

  if (esTablaInexistente(error)) {
    return res.status(503).json({
      error: `No existe la tabla "${TABLA_CAPTACION}" en Supabase.`,
    });
  }

  return res.status(503).json({ error: `No se pudo ${accion} el registro de captacion.` });
}

// GET /api/captacion -> lista los registros guardados en Supabase.
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from(TABLA_CAPTACION).select('*');

    if (error) return responderError(res, error, 'consultar');
    return res.json({ registros: data || [] });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
});

// POST /api/captacion -> crea un registro.
router.post('/', async (req, res) => {
  try {
    const payload = limpiarPayload(req.body);
    // El ID se genera en el servidor si falta o no tiene formato UUID.
    // Así el formulario puede mostrarlo sin permitir IDs arbitrarios.
    payload.id_jugador = idJugadorValido(payload.id_jugador) ? payload.id_jugador : crypto.randomUUID();
    const { data, error } = await supabaseAdmin
      .from(TABLA_CAPTACION)
      .insert(payload)
      .select('*')
      .single();

    if (error) return responderError(res, error, 'guardar');
    return res.status(201).json({ registro: data });
  } catch (error) {
    return responderError(res, error, 'guardar');
  }
});

// PUT /api/captacion/:id -> actualiza un registro.
router.put('/:id', async (req, res) => {
  try {
    const payload = limpiarPayload(req.body);
    // El ID se conserva al editar y nunca forma parte de los campos editables.
    delete payload.id_jugador;
    const { data, error } = await supabaseAdmin
      .from(TABLA_CAPTACION)
      .update(payload)
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) return responderError(res, error, 'actualizar');
    if (!data) return res.status(404).json({ error: 'Registro de captacion no encontrado.' });
    return res.json({ registro: data });
  } catch (error) {
    return responderError(res, error, 'actualizar');
  }
});

// DELETE /api/captacion/:id -> elimina un registro.
router.delete('/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLA_CAPTACION)
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle();

    if (error) return responderError(res, error, 'eliminar');
    if (!data) return res.status(404).json({ error: 'Registro de captacion no encontrado.' });
    return res.json({ ok: true });
  } catch (error) {
    return responderError(res, error, 'eliminar');
  }
});

module.exports = router;
