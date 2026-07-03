const express = require('express');
const multer = require('multer');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const resolveClub = require('../middleware/resolveClub');
const { ROLES } = require('../config/roles');
const { columnsForRole, sanitizeRow, FULL_COLUMNS } = require('../config/jugadoresColumns');
const { LATERALIDAD_VALUES, DEMARCACION_VALUES } = require('../config/datosDeportivos');
const sheetsSync = require('../config/googleSheetsSync');

const router = express.Router();

router.use(requireAuth);
router.use(resolveClub);

// Fotos de jugadores: bucket privado en Supabase Storage (son datos de menores),
// se sirven siempre mediante URLs firmadas y temporales, nunca publicas.
const FOTO_BUCKET = 'jugadores-fotos';
const FOTO_URL_TTL_SEGUNDOS = 600;
const EXT_POR_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!EXT_POR_MIME[file.mimetype]) {
      return cb(new Error('Formato de imagen no soportado. Usa JPG, PNG o WEBP.'));
    }
    cb(null, true);
  },
});

// Sustituye "foto_path" (interno) por una URL firmada de corta duracion en la respuesta.
async function conFotoUrl(row) {
  const { foto_path, ...resto } = row;
  if (!foto_path) {
    return { ...resto, foto_url: null };
  }
  const { data, error } = await supabaseAdmin.storage
    .from(FOTO_BUCKET)
    .createSignedUrl(foto_path, FOTO_URL_TTL_SEGUNDOS);
  return { ...resto, foto_url: error ? null : data.signedUrl };
}

// GET /api/jugadores?equipo=xxx&q=busqueda
// Tecnico: se fuerza siempre su equipo_asignado, ignorando "equipo" del query.
// Administrador/Responsable: pueden filtrar por cualquier equipo o pedir todos.
router.get('/', async (req, res) => {
  const { rol, equipo_asignado } = req.user;
  const columns = columnsForRole(rol);
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  let query = supabaseAdmin.from('jugadores').select(columns.join(',')).eq('club', req.club);

  if (rol === ROLES.TECNICO && equipo_asignado !== 'Todos') {
    if (!equipo_asignado) {
      return res.status(409).json({ error: 'Tu usuario no tiene un equipo asignado. Contacta con el administrador.' });
    }
    query = query.eq('equipo', equipo_asignado);
  } else if (req.query.equipo !== undefined) {
    const equiposFiltro = (Array.isArray(req.query.equipo) ? req.query.equipo : [req.query.equipo])
      .map((e) => String(e).trim())
      .filter(Boolean);
    if (equiposFiltro.length === 1) {
      query = query.eq('equipo', equiposFiltro[0]);
    } else if (equiposFiltro.length > 1) {
      query = query.in('equipo', equiposFiltro);
    }
  }

  if (search) {
    query = query.or(
      `nombre.ilike.%${search}%,primer_apellido.ilike.%${search}%,segundo_apellido.ilike.%${search}%`
    );
  }

  query = query.order('primer_apellido', { ascending: true });

  const { data, error } = await query;
  if (error) {
    console.error('Error consultando jugadores:', error);
    return res.status(503).json({ error: 'No se pudo consultar la base de datos de jugadores.' });
  }

  const sanitized = await Promise.all((data || []).map((row) => conFotoUrl(sanitizeRow(row, rol))));
  res.json({ jugadores: sanitized });
});

// Orden de categorías de mayor a menor edad; dentro de cada una, ROMO antes que ITZU.
const ORDEN_EQUIPOS = [
  'ROMO JUVENIL',
  'ITZU JUVENIL',
  'ROMO CADETE',
  'ITZU CADETE',
  'ROMO INFANTIL 2013',
  'ROMO INFANTIL 2014',
  'ROMO ALEVIN 2015 Gobela',
  'ROMO ALEVIN 2015 Ibaiondo',
  'ROMO ALEVIN 2016',
  'ROMO BENJAMIN 2017 Gobela',
  'ROMO BENJAMIN 2017 Ibaiondo',
  'ROMO BENJAMIN 2018',
  'ROMO PREBENJAMIN 2019',
  'ROMO PREBENJAMIN 2020',
];

function ordenarEquipos(equipos) {
  return [...equipos].sort((a, b) => {
    const ia = ORDEN_EQUIPOS.indexOf(a);
    const ib = ORDEN_EQUIPOS.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// GET /api/jugadores/equipos -> lista de equipos distintos (para el selector).
// Solo tiene sentido para Administrador/Responsable; Tecnico ya conoce su equipo.
router.get('/equipos', async (req, res) => {
  const { rol, equipo_asignado } = req.user;

  if (rol === ROLES.TECNICO && equipo_asignado !== 'Todos') {
    return res.json({ equipos: equipo_asignado ? [equipo_asignado] : [] });
  }

  const { data, error } = await supabaseAdmin.from('jugadores').select('equipo').eq('club', req.club);
  if (error) {
    return res.status(503).json({ error: 'No se pudo consultar la base de datos de jugadores.' });
  }

  const equipos = ordenarEquipos(Array.from(new Set((data || []).map((r) => r.equipo).filter(Boolean))));
  res.json({ equipos });
});

// GET /api/jugadores/:id -> ficha de un jugador.
router.get('/:id', async (req, res) => {
  const { rol, equipo_asignado } = req.user;
  const columns = columnsForRole(rol);

  const { data, error } = await supabaseAdmin
    .from('jugadores')
    .select(columns.join(','))
    .eq('id', req.params.id)
    .eq('club', req.club)
    .maybeSingle();

  if (error) {
    return res.status(503).json({ error: 'No se pudo consultar la base de datos de jugadores.' });
  }
  if (!data) {
    return res.status(404).json({ error: 'Jugador no encontrado.' });
  }

  if (rol === ROLES.TECNICO && equipo_asignado !== 'Todos' && data.equipo !== equipo_asignado) {
    return res.status(403).json({ error: 'No tienes permiso para ver este jugador.' });
  }

  res.json({ jugador: await conFotoUrl(sanitizeRow(data, rol)) });
});

// POST /api/jugadores/:id/foto -> sube/reemplaza la foto de un jugador.
// Tecnico solo puede subir fotos de jugadores de su propio equipo asignado.
router.post(
  '/:id/foto',
  requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR, ROLES.RESPONSABLE, ROLES.TECNICO),
  (req, res) => {
    uploadFoto.single('foto')(req, res, async (uploadErr) => {
      if (uploadErr) {
        return res.status(400).json({ error: uploadErr.message || 'No se pudo procesar la imagen.' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No se ha enviado ninguna imagen.' });
      }

      const { rol, equipo_asignado } = req.user;

      const { data: jugador, error: fetchError } = await supabaseAdmin
        .from('jugadores')
        .select('id, equipo, foto_path')
        .eq('id', req.params.id)
        .maybeSingle();

      if (fetchError) {
        return res.status(503).json({ error: 'No se pudo consultar la base de datos de jugadores.' });
      }
      if (!jugador) {
        return res.status(404).json({ error: 'Jugador no encontrado.' });
      }
      if (rol === ROLES.TECNICO && equipo_asignado !== 'Todos' && jugador.equipo !== equipo_asignado) {
        return res.status(403).json({ error: 'No tienes permiso para editar este jugador.' });
      }

      const ext = EXT_POR_MIME[req.file.mimetype];
      const nuevoPath = `${jugador.id}-${Date.now()}.${ext}`;

      const { error: uploadStorageError } = await supabaseAdmin.storage
        .from(FOTO_BUCKET)
        .upload(nuevoPath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

      if (uploadStorageError) {
        return res.status(503).json({ error: 'No se pudo subir la foto.' });
      }

      const { error: updateError } = await supabaseAdmin
        .from('jugadores')
        .update({ foto_path: nuevoPath })
        .eq('id', jugador.id);

      if (updateError) {
        await supabaseAdmin.storage.from(FOTO_BUCKET).remove([nuevoPath]);
        return res.status(503).json({ error: 'No se pudo actualizar el jugador.' });
      }

      if (jugador.foto_path) {
        await supabaseAdmin.storage.from(FOTO_BUCKET).remove([jugador.foto_path]);
      }

      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from(FOTO_BUCKET)
        .createSignedUrl(nuevoPath, FOTO_URL_TTL_SEGUNDOS);

      res.json({ foto_url: signError ? null : signed.signedUrl });
    });
  }
);

// PATCH /api/jugadores/:id/datos-deportivos -> actualiza dorsal/lateralidad/demarcacion.
// Solo Administrador y Responsable pueden editar estos datos.
router.patch(
  '/:id/datos-deportivos',
  requireRole(ROLES.ADMINISTRADOR, ROLES.RESPONSABLE),
  async (req, res) => {
    const { dorsal, lateralidad, demarcacion } = req.body || {};
    const updates = {};

    if (dorsal !== undefined) {
      if (dorsal !== null) {
        const dorsalNum = Number(dorsal);
        if (!Number.isInteger(dorsalNum) || dorsalNum < 1 || dorsalNum > 99) {
          return res.status(400).json({ error: 'Dorsal no valido. Debe ser un numero entre 1 y 99.' });
        }
        updates.dorsal = dorsalNum;
      } else {
        updates.dorsal = null;
      }
    }
    if (lateralidad !== undefined) {
      if (lateralidad !== null && !LATERALIDAD_VALUES.includes(lateralidad)) {
        return res.status(400).json({ error: 'Lateralidad no valida.' });
      }
      updates.lateralidad = lateralidad;
    }
    if (demarcacion !== undefined) {
      if (demarcacion !== null && !DEMARCACION_VALUES.includes(demarcacion)) {
        return res.status(400).json({ error: 'Demarcacion no valida.' });
      }
      updates.demarcacion = demarcacion;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar.' });
    }

    const { rol } = req.user;

    const { data, error } = await supabaseAdmin
      .from('jugadores')
      .update(updates)
      .eq('id', req.params.id)
      .select(columnsForRole(rol).join(','))
      .maybeSingle();

    if (error) {
      return res.status(503).json({ error: 'No se pudo actualizar el jugador.' });
    }
    if (!data) {
      return res.status(404).json({ error: 'Jugador no encontrado.' });
    }

    res.json({ jugador: await conFotoUrl(sanitizeRow(data, rol)) });
  }
);

// POST /api/jugadores/sync -> importa desde Google Sheets las filas nuevas
// del formulario (las que aun no tienen ID_SYNC) e inserta cada una en
// "jugadores". Solo Administrador: escribe en bloque datos sensibles de
// menores (DNI, telefono, domicilio, datos de padres/madres).
router.post('/sync', requireRole(ROLES.ADMINISTRADOR), async (req, res) => {
  const club = req.club;

  if (!sheetsSync.estaConfigurado(club)) {
    return res.status(503).json({
      error: `La sincronizacion con Google Sheets no esta configurada para el club ${club}.`,
    });
  }

  let sheets;
  let tabTitle;
  try {
    sheets = sheetsSync.getSheetsClient();
    tabTitle = await sheetsSync.resolverPestana(sheets, club);
  } catch (err) {
    console.error('Error conectando con Google Sheets:', err.message);
    return res.status(503).json({ error: 'No se pudo conectar con Google Sheets.' });
  }

  let headers;
  let idxIdSync;
  let pendientes;
  let omitidas;
  try {
    ({ headers, idxIdSync, pendientes, omitidas } = await sheetsSync.leerFilasPendientes(sheets, tabTitle, club));
  } catch (err) {
    console.error('Error leyendo filas de Google Sheets:', err.message);
    return res.status(503).json({ error: 'No se pudo leer la hoja de calculo.' });
  }

  if (pendientes.length === 0) {
    return res.json({ insertados: 0, omitidos: omitidas.length, total_pendientes: 0 });
  }

  const { data: insertados, error: insertError } = await supabaseAdmin
    .from('jugadores')
    .insert(pendientes.map((p) => ({ ...p.datos, club })))
    .select('id');

  if (insertError) {
    console.error('Error insertando jugadores desde Sheets:', insertError.message);
    return res.status(503).json({ error: 'No se pudieron guardar los jugadores en la base de datos.' });
  }

  try {
    const filasConId = pendientes.map((p, i) => ({ numeroFila: p.numeroFila, id: insertados[i].id }));
    await sheetsSync.marcarComoSincronizadas(sheets, tabTitle, idxIdSync, filasConId, club);
  } catch (err) {
    // Los jugadores ya se han insertado; si falla solo el marcado en el Sheet,
    // avisamos pero no lo tratamos como fallo total (evita duplicados se
    // reintentaria manualmente revisando el Sheet).
    console.error('Jugadores insertados pero no se pudo marcar ID_SYNC en el Sheet:', err.message);
    return res.json({
      insertados: insertados.length,
      omitidos: omitidas.length,
      aviso: 'Se importaron los jugadores pero no se pudo marcar la hoja como sincronizada. Revisa el Sheet manualmente.',
    });
  }

  res.json({ insertados: insertados.length, omitidos: omitidas.length });
});

module.exports = router;
