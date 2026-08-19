const express = require('express');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const resolveClub = require('../middleware/resolveClub');
const { ROLES } = require('../config/roles');

const router = express.Router();

router.use(requireAuth);
router.use(resolveClub);

function texto(valor) {
  return String(valor ?? '').trim();
}

function espacioCanonico(valor) {
  const espacio = texto(valor).toLowerCase();
  if (espacio === 'entero') return 'Entero';
  if (espacio === 'medio') return 'Medio';
  return '';
}

function normalizarTextoBusqueda(valor) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function esLocalRomo(valor) {
  return /^(?:romo fc|romo f c|romo juvenil a)(?:\s|$)/.test(normalizarTextoBusqueda(valor));
}

const NOMBRE_INTERNO_ROMO_JUVENIL = 'ROMO JUVENIL A';

function reemplazarNombreRomoJuvenil(valor) {
  return texto(valor).replace(/ROMO\s+F[.,]?\s*C[.,]?/gi, NOMBRE_INTERNO_ROMO_JUVENIL);
}

function esPartidoLigaRomoJuvenil(actividad) {
  if (texto(actividad?.tipo).toLowerCase() !== 'partido') return false;

  const competicion = normalizarTextoBusqueda(actividad?.competicion);
  const datosPartido = normalizarTextoBusqueda([
    actividad?.equipo,
    actividad?.local,
    actividad?.visitante,
    actividad?.rival,
    actividad?.titulo,
  ].filter(Boolean).join(' '));
  const esLigaJuvenil = competicion.includes('juvenil') || datosPartido.includes('juvenil');

  return competicion.includes('liga') && esLigaJuvenil && datosPartido.includes('romo');
}

function normalizarActividad(actividad, club) {
  if (!actividad || typeof actividad !== 'object') return null;

  const fecha = texto(actividad.fecha).slice(0, 10);
  const tipo = texto(actividad.tipo).toLowerCase();
  const id = texto(actividad.id);

  if (!id || !fecha || !tipo) return null;

  const esLigaRomoJuvenil = esPartidoLigaRomoJuvenil(actividad);
  const equipo = esLigaRomoJuvenil ? NOMBRE_INTERNO_ROMO_JUVENIL : texto(actividad.equipo);
  const local = esLigaRomoJuvenil ? reemplazarNombreRomoJuvenil(actividad.local) : texto(actividad.local);
  const visitante = esLigaRomoJuvenil ? reemplazarNombreRomoJuvenil(actividad.visitante) : texto(actividad.visitante);
  const rival = esLigaRomoJuvenil ? reemplazarNombreRomoJuvenil(actividad.rival) : texto(actividad.rival);
  const titulo = esLigaRomoJuvenil ? reemplazarNombreRomoJuvenil(actividad.titulo) : texto(actividad.titulo);
  const ubicacion = texto(actividad.ubicacion) || (tipo === 'partido' && esLocalRomo(local) ? 'GOBELA' : '');

  return {
    ...actividad,
    id,
    club,
    tipo,
    fecha,
    hora: texto(actividad.hora),
    horaFin: texto(actividad.horaFin),
    evento: texto(actividad.evento),
    competicion: texto(actividad.competicion),
    titulo,
    equipo,
    local,
    visitante,
    rival,
    ubicacion,
    espacio: espacioCanonico(actividad.espacio),
    jornada: Number.isFinite(Number(actividad.jornada)) ? Number(actividad.jornada) : 0,
    duracion: texto(actividad.duracion),
  };
}

function esTablaInexistente(error) {
  const textoError = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    (/actividades_calendario/i.test(textoError) && /does not exist|not find|no existe/i.test(textoError))
  );
}

function responderError(res, error, accion) {
  console.error(`Error al ${accion} actividades:`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });

  if (esTablaInexistente(error)) {
    return res.status(503).json({
      error: 'Falta crear la tabla "actividades_calendario" en Supabase. Ejecuta backend/scripts/crear-tabla-actividades-calendario.sql.',
    });
  }

  return res.status(503).json({ error: `No se pudieron ${accion} las actividades.` });
}

router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('actividades_calendario')
    .select('actividades')
    .eq('club', req.club)
    .maybeSingle();

  if (error) return responderError(res, error, 'consultar');

  const actividades = Array.isArray(data?.actividades) ? data.actividades : [];
  return res.json({ actividades });
});

router.put('/', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  const actividadesBrutas = Array.isArray(req.body?.actividades) ? req.body.actividades : null;
  if (!actividadesBrutas) {
    return res.status(400).json({ error: 'El payload de actividades debe ser un array.' });
  }

  const actividades = actividadesBrutas.map((actividad) => normalizarActividad(actividad, req.club)).filter(Boolean);

  const { error } = await supabaseAdmin
    .from('actividades_calendario')
    .upsert(
      {
        club: req.club,
        actividades,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'club' }
    );

  if (error) return responderError(res, error, 'guardar');
  return res.json({ actividades });
});

module.exports = router;
