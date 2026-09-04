const express = require('express');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { ROLES } = require('../config/roles');
const { SISTEMAS, getSistema, MAX_JUGADORES_POR_PUESTO } = require('../config/sistemasTacticos');
const { parseEquiposAsignados, puedeVerEquipo } = require('../lib/equiposAsignados');

const router = express.Router();

router.use(requireAuth);

function esTablaCampogramasInexistente(error) {
  const textoError = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    (/campogramas/i.test(textoError) && /does not exist|not find|no existe/i.test(textoError))
  );
}

function logErrorSupabase(contexto, error) {
  console.error(contexto, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}

function mensajeErrorCampogramas(error, accion) {
  if (esTablaCampogramasInexistente(error)) {
    return 'Falta crear la tabla "campogramas" en Supabase. Revisa la configuracion de la base de datos.';
  }
  return `No se pudo ${accion} el campograma.`;
}

// GET /api/campogramas/sistemas -> catalogo de sistemas tacticos disponibles.
router.get('/sistemas', (req, res) => {
  res.json({ sistemas: SISTEMAS });
});

function resolverEquipo(req) {
  const { rol, equipo_asignado } = req.user;
  if (rol === ROLES.TECNICO && !equipo_asignado) {
    return { error: 'Tu usuario no tiene un equipo asignado. Contacta con el administrador.', status: 409 };
  }

  const equipo = typeof req.query.equipo === 'string' ? req.query.equipo.trim() : '';
  const equiposAsignados = parseEquiposAsignados(equipo_asignado);

  if (equiposAsignados.length > 0) {
    if (!equipo && equiposAsignados.length === 1) return { equipo: equiposAsignados[0] };
    if (!equipo) return { equipo: null };
    if (!equiposAsignados.includes(equipo)) {
      return { error: 'No tienes permiso para ver el campograma de ese equipo.', status: 403 };
    }
  }

  return { equipo: equipo || null };
}

// GET /api/campogramas/ultimo-sistema?equipo=xxx -> ultimo sistema tactico guardado para ese equipo.
router.get('/ultimo-sistema', async (req, res) => {
  try {
    const { equipo, error: errorEquipo, status } = resolverEquipo(req);

    if (errorEquipo) {
      return res.status(status || 400).json({ error: errorEquipo });
    }

    if (!equipo) {
      return res.status(400).json({ error: 'Falta indicar el equipo.' });
    }

    const { data, error } = await supabaseAdmin
      .from('campogramas')
      .select('sistema, updated_at')
      .eq('equipo', equipo)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logErrorSupabase('Error consultando ultimo sistema de campograma:', error);
      return res.status(503).json({ error: mensajeErrorCampogramas(error, 'consultar') });
    }

    res.json({ sistema: data?.sistema || null });
  } catch (err) {
    console.error('Error inesperado consultando ultimo sistema de campograma:', err);
    return res.status(503).json({ error: 'No se pudo consultar el ultimo sistema del equipo.' });
  }
});

// GET /api/campogramas?equipo=xxx&sistema=1-4-4-2 -> campograma guardado (o vacio si no existe).
router.get('/', async (req, res) => {
  try {
    const { equipo, error: errorEquipo, status } = resolverEquipo(req);
    const sistema = typeof req.query.sistema === 'string' ? req.query.sistema.trim() : '';

    if (errorEquipo) {
      return res.status(status || 400).json({ error: errorEquipo });
    }

    if (!equipo) {
      return res.status(400).json({ error: 'Falta indicar el equipo.' });
    }
    if (!sistema || !getSistema(sistema)) {
      return res.status(400).json({ error: 'Sistema tactico no valido.' });
    }

    const { data, error } = await supabaseAdmin
      .from('campogramas')
      .select('equipo, sistema, asignaciones, updated_at')
      .eq('equipo', equipo)
      .eq('sistema', sistema)
      .maybeSingle();

    if (error) {
      logErrorSupabase('Error consultando campograma:', error);
      return res.status(503).json({ error: mensajeErrorCampogramas(error, 'consultar') });
    }

    const asignacionesSaneadas = {};
    for (const [posicionId, jugadorIdsPuesto] of Object.entries(data?.asignaciones || {})) {
      if (Array.isArray(jugadorIdsPuesto) && jugadorIdsPuesto.length > 0) {
        asignacionesSaneadas[posicionId] = jugadorIdsPuesto;
      }
    }

    res.json({
      campograma: data
        ? { ...data, asignaciones: asignacionesSaneadas }
        : { equipo, sistema, asignaciones: {} },
    });
  } catch (err) {
    console.error('Error inesperado consultando campograma:', err);
    return res.status(503).json({ error: 'No se pudo consultar el campograma.' });
  }
});

async function guardarCampograma(req, res) {
  const { rol, equipo_asignado } = req.user;
  const { equipo, sistema, asignaciones } = req.body || {};

  if (typeof equipo !== 'string' || !equipo.trim()) {
    return res.status(400).json({ error: 'Falta indicar el equipo.' });
  }
  if (rol === ROLES.TECNICO && !equipo_asignado) {
    return res.status(409).json({ error: 'Tu usuario no tiene un equipo asignado. Contacta con el administrador.' });
  }
  if (!puedeVerEquipo(req.user, equipo)) {
    return res.status(403).json({ error: 'No tienes permiso para editar el campograma de otro equipo.' });
  }

  const sistemaDef = typeof sistema === 'string' ? getSistema(sistema) : null;
  if (!sistemaDef) {
    return res.status(400).json({ error: 'Sistema tactico no valido.' });
  }
  if (asignaciones !== undefined && (typeof asignaciones !== 'object' || asignaciones === null || Array.isArray(asignaciones))) {
    return res.status(400).json({ error: 'Formato de asignaciones no valido.' });
  }

  const posicionesValidas = new Set(sistemaDef.positions.map((p) => p.id));
  const asignacionesLimpias = {};
  for (const [posicionId, jugadorIdsPuesto] of Object.entries(asignaciones || {})) {
    if (!posicionesValidas.has(posicionId)) {
      return res.status(400).json({ error: `Posicion no valida: ${posicionId}.` });
    }
    if (!Array.isArray(jugadorIdsPuesto)) {
      return res.status(400).json({ error: `El puesto ${posicionId} debe ser una lista de jugadores.` });
    }
    const idsPuesto = Array.from(new Set(jugadorIdsPuesto.filter((id) => id !== null && id !== undefined && id !== '')));
    if (idsPuesto.length > MAX_JUGADORES_POR_PUESTO) {
      return res.status(400).json({ error: `Como maximo ${MAX_JUGADORES_POR_PUESTO} jugadores por puesto.` });
    }
    if (idsPuesto.length > 0) {
      asignacionesLimpias[posicionId] = idsPuesto;
    }
  }

  const jugadorIds = Array.from(new Set(Object.values(asignacionesLimpias).flat()));
  if (jugadorIds.length > 0) {
    const { data: jugadoresDelEquipo, error: errorJugadores } = await supabaseAdmin
      .from('jugadores')
      .select('id')
      .eq('equipo', equipo)
      .in('id', jugadorIds);

    if (errorJugadores) {
      logErrorSupabase('Error validando jugadores del campograma:', errorJugadores);
      return res.status(503).json({ error: 'No se pudo validar los jugadores.' });
    }
    const idsValidos = new Set((jugadoresDelEquipo || []).map((j) => j.id));
    const idInvalido = jugadorIds.find((id) => !idsValidos.has(id));
    if (idInvalido) {
      return res.status(400).json({ error: 'Alguno de los jugadores no pertenece a ese equipo.' });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('campogramas')
    .upsert(
      { equipo, sistema, asignaciones: asignacionesLimpias, updated_at: new Date().toISOString() },
      { onConflict: 'equipo,sistema' }
    )
    .select('equipo, sistema, asignaciones, updated_at')
    .maybeSingle();

  if (error) {
    logErrorSupabase('Error guardando campograma:', error);
    return res.status(503).json({ error: mensajeErrorCampogramas(error, 'guardar') });
  }

  res.json({ campograma: data });
}

// PUT /api/campogramas -> guarda/actualiza la asignacion de jugadores a posiciones.
router.put(
  '/',
  requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR, ROLES.RESPONSABLE),
  async (req, res) => {
    try {
      await guardarCampograma(req, res);
    } catch (err) {
      console.error('Error inesperado guardando campograma:', err);
      return res.status(503).json({ error: 'No se pudo guardar el campograma.' });
    }
  }
);

module.exports = router;
