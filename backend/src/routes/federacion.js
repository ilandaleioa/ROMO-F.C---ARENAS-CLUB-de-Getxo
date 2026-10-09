const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const resolveClub = require('../middleware/resolveClub');
const supabaseAdmin = require('../config/supabaseClient');
const { puedeVerEquipo } = require('../lib/equiposAsignados');

const router = express.Router();

router.use(requireAuth);
router.use(resolveClub);

// API de solo lectura con los datos federativos (clasificacion, partidos, actas).
// Se consulta desde el servidor para no exponer el origen al navegador.
const FEDERACION_API_URL = (process.env.FEDERACION_API_URL || 'https://deployvercel-alpha-nine.vercel.app').replace(/\/+$/, '');
const TIMEOUT_MS = 15000;

const NOMBRE_CLUB_FEDERACION = {
  ROMO: 'ROMO F.C.',
  ARENAS: 'Arenas Club',
};

// Prefijo con el que la federacion nombra al equipo propio (p. ej. "ROMO F.C.", "ARENAS C.").
const PREFIJO_EQUIPO_PROPIO = {
  ROMO: 'romo',
  ARENAS: 'arenas',
};

const ETAPAS = ['JUVENIL', 'CADETE', 'INFANTIL', 'SENIOR'];

const RE_COMP = /^\d+-\d+-\d+$/;
const RE_ID = /^\d{1,12}$/;
const RE_TEMPORADA = /^\d{4}-\d{4}$/;

async function consultar(ruta, params = {}) {
  const url = new URL(`${FEDERACION_API_URL}${ruta}`);
  Object.entries(params).forEach(([clave, valor]) => {
    if (valor !== '' && valor != null) url.searchParams.set(clave, String(valor));
  });

  const respuesta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } });
  if (!respuesta.ok) throw new Error(`La API federativa respondio ${respuesta.status}.`);
  return respuesta.json();
}

// Algunos textos del origen llegan con doble codificacion (p. ej. "MUÃ‘OZ").
function repararTexto(valor) {
  if (typeof valor === 'string') {
    if (!/[ÃÂ]/.test(valor)) return valor;
    const reparado = Buffer.from(valor, 'latin1').toString('utf8');
    return reparado.includes('�') ? valor : reparado;
  }
  if (Array.isArray(valor)) return valor.map(repararTexto);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([clave, v]) => [clave, repararTexto(v)]));
  }
  return valor;
}

function responderError(res, error, accion) {
  console.error(`Error al ${accion} datos federativos:`, error?.message);
  return res.status(502).json({ error: `No se pudo ${accion} los datos de la federación.` });
}

function etapaDelEquipo(equipo) {
  const mayus = String(equipo || '').toUpperCase();
  return ETAPAS.find((etapa) => mayus.includes(etapa)) || '';
}

router.get('/competiciones', async (req, res) => {
  const clubnom = NOMBRE_CLUB_FEDERACION[req.club];
  if (!clubnom) return res.json({ competiciones: [], sugerida: null });

  const temporada = RE_TEMPORADA.test(String(req.query.season || '')) ? req.query.season : '';

  try {
    const base = await consultar('/api/filters', { clubnom });
    const season = temporada || (base.seasons || [])[0] || '';
    const filtros = temporada ? await consultar('/api/filters', { clubnom, season }) : base;
    const claves = new Set(filtros.clubcomps || []);
    const competiciones = (filtros.competitions || [])
      .filter((c) => claves.has(c.key) && (!season || c.season === season))
      .map((c) => ({ key: c.key, name: c.name, season: c.season, etapa: c.etapa }));

    const etapa = etapaDelEquipo(req.query.equipo);
    const sugerida = (etapa && competiciones.find((c) => c.etapa === etapa)?.key) || competiciones[0]?.key || null;
    return res.json({ competiciones, sugerida });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
});

// Id federativo del equipo propio en la etapa del equipo interno (p. ej. ROMO JUVENIL),
// para abrir el dashboard directamente filtrado a ese equipo.
router.get('/equipo-dashboard', async (req, res) => {
  const clubnom = NOMBRE_CLUB_FEDERACION[req.club];
  const etapa = etapaDelEquipo(req.query.equipo);
  if (!clubnom || !etapa) return res.json({ id: null, etapa: etapa || null });
  if (req.user && !puedeVerEquipo(req.user, String(req.query.equipo || ''))) {
    return res.status(403).json({ error: 'No tienes permiso para ver este equipo.' });
  }

  try {
    const base = await consultar('/api/filters', { clubnom });
    const season = (base.seasons || [])[0] || '';
    const filtros = await consultar('/api/filters', { clubnom, season, etapa });
    const prefijo = PREFIJO_EQUIPO_PROPIO[req.club];
    const propios = (filtros.teams || []).filter((t) => String(t.name || '').trim().toLowerCase().startsWith(prefijo));
    return res.json({ id: propios.length === 1 ? propios[0].id : null, etapa, season });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
});

router.get('/clasificacion', async (req, res) => {
  const comp = String(req.query.comp || '');
  if (!RE_COMP.test(comp)) return res.status(400).json({ error: 'Competición no válida.' });

  try {
    const { rows } = await consultar('/api/standings', { comp });
    return res.json({ clasificacion: rows || [] });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
});

router.get('/partidos', async (req, res) => {
  const comp = String(req.query.comp || '');
  if (!RE_COMP.test(comp)) return res.status(400).json({ error: 'Competición no válida.' });

  try {
    const { matches } = await consultar('/api/matches', { comp, limit: 500, order: 'date', dir: 'asc' });
    return res.json({ partidos: matches || [] });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
});

router.get('/acta', async (req, res) => {
  const id = String(req.query.id || '');
  if (!RE_ID.test(id)) return res.status(400).json({ error: 'Partido no válido.' });

  try {
    return res.json({ acta: repararTexto(await consultar('/api/match', { id })) });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
});

// Historial federativo de un jugador de la app (partidos, minutos, goles, tarjetas).
// El vinculo con la federacion se guarda en jugadores.federacion_player_id.
router.get('/jugador/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('jugadores')
      .select('equipo, federacion_player_id')
      .eq('id', req.params.id)
      .eq('club', req.club)
      .maybeSingle();

    if (error) return res.status(503).json({ error: 'No se pudo consultar la base de datos de jugadores.' });
    if (!data) return res.status(404).json({ error: 'Jugador no encontrado.' });
    if (!puedeVerEquipo(req.user, data.equipo)) {
      return res.status(403).json({ error: 'No tienes permiso para ver este jugador.' });
    }
    if (!data.federacion_player_id) return res.json({ vinculado: false });

    const ficha = await consultar('/api/player', { id: data.federacion_player_id });
    return res.json({
      vinculado: true,
      totales: ficha.totals || {},
      temporadas: repararTexto(ficha.seasons || []),
      partidos: repararTexto(ficha.matches || []),
      golesPorTramo: ficha.goals_min || [],
      tarjetasPorTramo: ficha.cards_min || [],
      localVisitante: ficha.sides || {},
      tiposGol: ficha.goal_types || {},
    });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
});

module.exports = router;
