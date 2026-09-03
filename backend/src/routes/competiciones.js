const express = require('express');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const resolveClub = require('../middleware/resolveClub');
const { CLUBES, CLUB_TODOS } = require('../config/clubs');
const { ROLES } = require('../config/roles');
const { ordenarEquipos: ordenarEquiposGlobal } = require('../lib/equiposOrden');

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
  'url_resultados',
  'url_calendario',
  'url_tabla_cruzada',
  'url_goleadores',
  'url_porteros',
  'url_estadisticas',
  'rivales',
];

const CAMPOS_URL = ['url', 'url_resultados', 'url_calendario', 'url_tabla_cruzada', 'url_goleadores', 'url_porteros', 'url_estadisticas'];
const CAMPOS_SELECT = ['id', 'club', ...CAMPOS, 'created_at', 'updated_at'].join(', ');
const TIPOS_VALIDOS = ['liga', 'amistoso'];

function texto(valor) {
  return String(valor ?? '').trim();
}

function entero(valor, fallback = 0) {
  const numero = Number.parseInt(valor, 10);
  return Number.isFinite(numero) ? numero : fallback;
}

function listaRivales(valor) {
  if (!Array.isArray(valor)) return [];
  return Array.from(new Set(valor.map((nombre) => texto(nombre)).filter(Boolean))).slice(0, 40);
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
    url_resultados: texto(body?.url_resultados),
    url_calendario: texto(body?.url_calendario),
    url_tabla_cruzada: texto(body?.url_tabla_cruzada),
    url_goleadores: texto(body?.url_goleadores),
    url_porteros: texto(body?.url_porteros),
    url_estadisticas: texto(body?.url_estadisticas),
    rivales: listaRivales(body?.rivales),
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

  for (const campo of CAMPOS_URL) {
    if (!payload[campo]) continue;
    try {
      const url = new URL(payload[campo]);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocolo no valido');
    } catch (_) {
      return 'Las URLs deben ser válidas y comenzar por http:// o https://.';
    }
  }

  return null;
}

function resolverClubEscritura(req, body) {
  // Solo un usuario con acceso a ambos clubes puede elegir el club del
  // equipo interno desde el formulario; el resto siempre escribe en su
  // propio club (req.club), venga lo que venga en el body.
  if (req.user?.club !== CLUB_TODOS) return req.club;
  const valor = texto(body?.club).toUpperCase();
  return CLUBES.includes(valor) ? valor : req.club;
}

function esTablaInexistente(error) {
  const textoError = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    (/competiciones/i.test(textoError) && /does not exist|not find|no existe/i.test(textoError))
  );
}

async function cargarEquiposParaSelector(clubes) {
  const { data, error } = await supabaseAdmin
    .from('jugadores')
    .select('club, equipo')
    .in('club', clubes);

  if (error) return { error };

  const porClub = new Map();
  (data || []).forEach((fila) => {
    const clubFila = texto(fila.club);
    const equipo = texto(fila.equipo);
    if (!clubFila || !equipo) return;
    if (!porClub.has(clubFila)) porClub.set(clubFila, new Set());
    porClub.get(clubFila).add(equipo);
  });

  const equiposPorClub = {};
  porClub.forEach((equipos, clubFila) => {
    equiposPorClub[clubFila] = ordenarEquiposGlobal(Array.from(equipos));
  });

  const equipos = ordenarEquiposGlobal(
    Array.from(new Set((data || []).map((fila) => texto(fila.equipo)).filter(Boolean)))
  );

  return { equipos, equiposPorClub };
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

router.get('/equipos', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  const clubes = req.user?.club === CLUB_TODOS ? ['ROMO', 'ARENAS'] : [req.club];
  const { equipos, equiposPorClub, error } = await cargarEquiposParaSelector(clubes);

  if (error) return responderError(res, error, 'consultar');
  return res.json({ equipos: equipos || [], equiposPorClub: equiposPorClub || {} });
});

router.get('/', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('competiciones')
    .select(CAMPOS_SELECT)
    .eq('club', req.club)
    .order('equipo_interno', { ascending: true });

  if (error) return responderError(res, error, 'consultar');
  return res.json({ competiciones: data || [] });
});

const CAMPOS_PUBLICOS_SELECT = [
  'id',
  'club',
  'nombre',
  'tipo',
  'equipo_interno',
  'equipo_fed',
  'etapa',
  'categoria',
  'url',
  'url_resultados',
  'url_calendario',
  'url_tabla_cruzada',
  'url_goleadores',
  'url_porteros',
  'url_estadisticas',
  'rivales',
].join(', ');

router.get('/publicas', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('competiciones')
    .select(CAMPOS_PUBLICOS_SELECT)
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
    .insert({ ...payload, club: resolverClubEscritura(req, req.body) })
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
    .update({ ...payload, club: resolverClubEscritura(req, req.body), updated_at: new Date().toISOString() })
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
