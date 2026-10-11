const fs = require('fs');
const path = require('path');
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
  ARENAS: 'ARENAS C.',
};

const CLUB_FILTRO_DATOS = {
  ROMO: 'ROMO,ROMO F.C.',
  ARENAS: 'ARENAS C.',
};

// Prefijo con el que la federacion nombra al equipo propio (p. ej. "ROMO F.C.", "ARENAS C.").
const PREFIJO_EQUIPO_PROPIO = {
  ROMO: 'romo',
  ARENAS: 'arenas',
};

// Equipos internos que la federación registra con otro nombre: [marca en el equipo interno, prefijo federativo].
const PREFIJOS_FILIAL = [['ITZU', 'itzu']];

// Relación equipo interno ↔ equipo federativo (club;equipo_interno;id_federacion;nombre_federacion).
const EQUIPOS_CSV = path.join(__dirname, '..', 'config', 'equipos_federacion.csv');

const normalizar = (texto) =>
  String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

function filaEquipoFederacion(club, equipo) {
  let texto;
  try {
    texto = fs.readFileSync(EQUIPOS_CSV, 'utf8').replace(/^﻿/, '');
  } catch (_) {
    return null;
  }
  const [cabecera, ...filas] = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!cabecera) return null;
  const sep = cabecera.includes(';') ? ';' : ',';
  const campos = cabecera.split(sep).map((c) => c.trim());
  return filas
    .map((linea) => Object.fromEntries(linea.split(sep).map((v, i) => [campos[i], v.trim()])))
    .find((f) => normalizar(f.club) === normalizar(club) && normalizar(f.equipo_interno) === normalizar(equipo)) || null;
}

const ETAPAS = ['JUVENIL', 'CADETE', 'INFANTIL', 'SENIOR'];

const RE_COMP = /^\d+-\d+-\d+$/;
const RE_ID = /^\d{1,12}$/;

// La app solo trabaja con la temporada en curso; cualquier dato de otras temporadas se descarta.
const TEMPORADA_ACTUAL = /^\d{4}-\d{4}$/.test(process.env.TEMPORADA_ACTUAL || '') ? process.env.TEMPORADA_ACTUAL : '2026-2027';

const TRAMOS_MIN = [15, 30, 45, 60, 75, Infinity];
const tramoDe = (minuto) => Math.max(0, TRAMOS_MIN.findIndex((limite) => Number(minuto) <= limite));
const SUMABLES = ['pj', 'titular', 'minutos', 'goles', 'penaltis', 'pp', 'amarillas', 'doble', 'rojas'];

// Reconstruye los datos agregados del jugador usando solo la temporada actual.
function resumenTemporada(ficha) {
  const temporadas = (ficha.seasons || []).filter((s) => s.season === TEMPORADA_ACTUAL);
  const partidos = (ficha.matches || []).filter((m) => m.season === TEMPORADA_ACTUAL);
  const totales = Object.fromEntries(
    SUMABLES.map((k) => [k, temporadas.reduce((acc, s) => acc + (Number(s[k]) || 0), 0)])
  );
  totales.g = partidos.filter((m) => m.result === 'W').length;
  totales.e = partidos.filter((m) => m.result === 'D').length;
  totales.p = partidos.filter((m) => m.result === 'L').length;

  const golesPorTramo = [0, 0, 0, 0, 0, 0];
  const tarjetasPorTramo = [0, 0, 0, 0, 0, 0];
  const lados = { home: { pj: 0, goles: 0 }, away: { pj: 0, goles: 0 } };
  partidos.forEach((m) => {
    (m.goals || []).forEach((g) => { if (g.minute != null) golesPorTramo[tramoDe(g.minute)] += 1; });
    (m.cards || []).forEach((c) => { if (c.minute != null) tarjetasPorTramo[tramoDe(c.minute)] += 1; });
    const lado = lados[m.side];
    if (lado) {
      lado.pj += 1;
      lado.goles += (m.goals || []).length;
    }
  });
  return { temporadas, partidos, totales, golesPorTramo, tarjetasPorTramo, lados };
}

async function consultar(ruta, params = {}) {
  const url = new URL(`${FEDERACION_API_URL}${ruta}`);
  Object.entries(params).forEach(([clave, valor]) => {
    if (valor !== '' && valor != null) url.searchParams.set(clave, String(valor));
  });

  const headers = { Accept: 'application/json' };
  if (process.env.FEDERACION_SERVICE_KEY) headers['X-Service-Key'] = process.env.FEDERACION_SERVICE_KEY;
  const respuesta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers });
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

  try {
    const season = TEMPORADA_ACTUAL;
    const filtros = await consultar('/api/filters', { clubnom, season });
    const claves = new Set(filtros.clubcomps || []);
    const competiciones = (filtros.competitions || [])
      .filter((c) => claves.has(c.key) && c.season === season)
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

  const fila = filaEquipoFederacion(req.club, req.query.equipo);
  if (fila && RE_ID.test(fila.id_federacion)) return res.json({ id: fila.id_federacion, etapa, season: TEMPORADA_ACTUAL });

  try {
    // Mismo filtro de club que usa la pantalla de Datos (incluye el alias «ROMO» y los filiales).
    const clubFiltro = CLUB_FILTRO_DATOS[req.club] || clubnom;
    const season = TEMPORADA_ACTUAL;
    const filtros = await consultar('/api/filters', { clubnom: clubFiltro, season, etapa });
    // El filial de ROMO (ITZU JUVENIL = Itzubaltzeta Juvenil B) cuelga del mismo club en la federación:
    // se resuelve por su propio prefijo para que no coincida con el primer equipo.
    const prefijo = PREFIJOS_FILIAL.find(([marca]) => String(req.query.equipo || '').toUpperCase().includes(marca))?.[1]
      || PREFIJO_EQUIPO_PROPIO[req.club];
    const equipos = filtros.teams || [];
    // Si el CSV da el nombre federativo (p. ej. «ROMO F.C. - Juvenil A»), se elige el equipo cuyo nombre lo encabeza.
    const nombre = normalizar(fila?.nombre_federacion);
    const porNombre = nombre ? equipos.filter((t) => t.name && nombre.startsWith(normalizar(t.name))) : [];
    let propios = porNombre.length === 1
      ? porNombre
      : equipos.filter((t) => String(t.name || '').trim().toLowerCase().startsWith(prefijo));
    // Varios equipos propios en la misma etapa (A, B...): se elige por la letra del equipo interno
    // (p. ej. «ARENAS Juvenil A» ↔ «ARENAS C. - Juvenil A» / «ARENAS C. "A"»).
    if (propios.length > 1) {
      const letra = (String(req.query.equipo || '').trim().match(/\s([A-Z])$/i) || [])[1];
      if (letra) {
        const porLetra = propios.filter((t) => {
          const nombreEq = String(t.name || '').trim().toUpperCase().replace(/["']+$/, '');
          return /[\s"'-]/.test(nombreEq.slice(-2, -1)) && nombreEq.endsWith(letra.toUpperCase());
        });
        if (porLetra.length === 1) propios = porLetra;
      }
    }
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
    const r = resumenTemporada(ficha);
    return res.json({
      vinculado: true,
      federacionPlayerId: String(data.federacion_player_id),
      temporada: TEMPORADA_ACTUAL,
      totales: r.totales,
      temporadas: repararTexto(r.temporadas),
      partidos: repararTexto(r.partidos),
      golesPorTramo: r.golesPorTramo,
      tarjetasPorTramo: r.tarjetasPorTramo,
      localVisitante: r.lados,
    });
  } catch (error) {
    return responderError(res, error, 'consultar');
  }
});

module.exports = router;
