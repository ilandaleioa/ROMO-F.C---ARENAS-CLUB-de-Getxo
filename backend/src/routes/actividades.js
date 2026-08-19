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

const ESPACIOS_PERMITIDOS = new Set(['Entero', 'Medio']);

function normalizarActividad(actividad, club) {
  if (!actividad || typeof actividad !== 'object') return null;

  const fecha = texto(actividad.fecha).slice(0, 10);
  const tipo = texto(actividad.tipo).toLowerCase();
  const id = texto(actividad.id);

  if (!id || !fecha || !tipo) return null;

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
    titulo: texto(actividad.titulo),
    equipo: texto(actividad.equipo),
    local: texto(actividad.local),
    visitante: texto(actividad.visitante),
    rival: texto(actividad.rival),
    ubicacion: texto(actividad.ubicacion),
    espacio: ESPACIOS_PERMITIDOS.has(texto(actividad.espacio)) ? texto(actividad.espacio) : '',
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
