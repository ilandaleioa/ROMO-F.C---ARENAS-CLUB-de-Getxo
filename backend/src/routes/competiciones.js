const express = require('express');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const resolveClub = require('../middleware/resolveClub');
const { ROLES } = require('../config/roles');

const router = express.Router();

router.use(requireAuth);
router.use(resolveClub);

const CAMPOS = [
  'nombre',
  'tipo',
  'partes',
  'minutos_por_parte',
  'total_minutos',
  'equipo_interno',
  'equipos_anadidos',
  'equipo_fed',
  'etapa',
  'categoria',
  'url',
];
const CAMPOS_SELECT = ['id', ...CAMPOS, 'created_at', 'updated_at'].join(', ');
const TIPOS_VALIDOS = ['liga', 'amistoso'];

function texto(valor) {
  return String(valor ?? '').trim();
}

function entero(valor, fallback = 0) {
  const numero = Number.parseInt(valor, 10);
  return Number.isFinite(numero) ? numero : fallback;
}

function normalizarPayload(body) {
  return {
    nombre: texto(body?.nombre),
    tipo: texto(body?.tipo).toLowerCase(),
    partes: entero(body?.partes),
    minutos_por_parte: entero(body?.minutos_por_parte),
    total_minutos: entero(body?.partes) * entero(body?.minutos_por_parte),
    equipo_interno: texto(body?.equipo_interno),
    equipos_anadidos: Math.max(0, entero(body?.equipos_anadidos)),
    equipo_fed: texto(body?.equipo_fed),
    etapa: texto(body?.etapa),
    categoria: texto(body?.categoria),
    url: texto(body?.url),
  };
}

function validarPayload(payload) {
  const obligatorios = ['nombre', 'tipo'];
  const campoVacio = obligatorios.find((campo) => !payload[campo]);
  if (campoVacio) {
    return 'Completa el nombre y el tipo de la competición.';
  }
  if (!TIPOS_VALIDOS.includes(payload.tipo)) {
    return 'El tipo de competición no es válido.';
  }
  if (payload.partes < 1 || payload.minutos_por_parte < 1) {
    return 'El número de partes y los minutos por parte deben ser mayores que cero.';
  }

  if (payload.url) {
    try {
      const url = new URL(payload.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocolo no valido');
    } catch (_) {
      return 'La URL debe ser válida y comenzar por http:// o https://.';
    }
  }

  return null;
}

function esTablaInexistente(error) {
  const textoError = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    (/competiciones/i.test(textoError) && /does not exist|not find|no existe/i.test(textoError))
  );
}

function responderError(res, error, accion) {
  console.error(`Error al ${accion} competiciones:`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });

  if (esTablaInexistente(error)) {
    return res.status(503).json({
      error: 'Falta crear la tabla "competiciones" en Supabase. Ejecuta backend/scripts/crear-tabla-competiciones.sql.',
    });
  }

  return res.status(503).json({ error: `No se pudo ${accion} las competiciones.` });
}

router.get('/', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('competiciones')
    .select(CAMPOS_SELECT)
    .eq('club', req.club)
    .order('equipo_interno', { ascending: true });

  if (error) return responderError(res, error, 'consultar');
  return res.json({ competiciones: data || [] });
});

router.post('/', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  const payload = normalizarPayload(req.body);
  const errorValidacion = validarPayload(payload);
  if (errorValidacion) return res.status(400).json({ error: errorValidacion });

  const { data, error } = await supabaseAdmin
    .from('competiciones')
    .insert({ ...payload, club: req.club })
    .select(CAMPOS_SELECT)
    .single();

  if (error) return responderError(res, error, 'crear');
  return res.status(201).json({ competicion: data });
});

router.put('/:id', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  const payload = normalizarPayload(req.body);
  const errorValidacion = validarPayload(payload);
  if (errorValidacion) return res.status(400).json({ error: errorValidacion });

  const { data, error } = await supabaseAdmin
    .from('competiciones')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('club', req.club)
    .select(CAMPOS_SELECT)
    .maybeSingle();

  if (error) return responderError(res, error, 'actualizar');
  if (!data) return res.status(404).json({ error: 'Competición no encontrada.' });
  return res.json({ competicion: data });
});

router.delete('/:id', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  const { error, count } = await supabaseAdmin
    .from('competiciones')
    .delete({ count: 'exact' })
    .eq('id', req.params.id)
    .eq('club', req.club);

  if (error) return responderError(res, error, 'borrar');
  if (!count) return res.status(404).json({ error: 'Competición no encontrada.' });
  return res.json({ ok: true });
});

module.exports = router;
