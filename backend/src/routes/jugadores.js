const express = require('express');
const multer = require('multer');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { ROLES } = require('../config/roles');
const { columnsForRole, sanitizeRow, FULL_COLUMNS } = require('../config/jugadoresColumns');

const router = express.Router();

router.use(requireAuth);

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

  let query = supabaseAdmin.from('jugadores').select(columns.join(','));

  if (rol === ROLES.TECNICO) {
    if (!equipo_asignado) {
      return res.json({ jugadores: [] });
    }
    query = query.eq('equipo', equipo_asignado);
  } else if (typeof req.query.equipo === 'string' && req.query.equipo.trim() !== '') {
    query = query.eq('equipo', req.query.equipo.trim());
  }

  if (search) {
    query = query.or(
      `nombre.ilike.%${search}%,primer_apellido.ilike.%${search}%,segundo_apellido.ilike.%${search}%`
    );
  }

  query = query.order('primer_apellido', { ascending: true });

  const { data, error } = await query;
  if (error) {
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

  if (rol === ROLES.TECNICO) {
    return res.json({ equipos: equipo_asignado ? [equipo_asignado] : [] });
  }

  const { data, error } = await supabaseAdmin.from('jugadores').select('equipo');
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
    .maybeSingle();

  if (error) {
    return res.status(503).json({ error: 'No se pudo consultar la base de datos de jugadores.' });
  }
  if (!data) {
    return res.status(404).json({ error: 'Jugador no encontrado.' });
  }

  if (rol === ROLES.TECNICO && data.equipo !== equipo_asignado) {
    return res.status(403).json({ error: 'No tienes permiso para ver este jugador.' });
  }

  res.json({ jugador: await conFotoUrl(sanitizeRow(data, rol)) });
});

// POST /api/jugadores/:id/foto -> sube/reemplaza la foto de un jugador.
// Tecnico solo puede subir fotos de jugadores de su propio equipo asignado.
router.post(
  '/:id/foto',
  requireRole(ROLES.ADMINISTRADOR, ROLES.RESPONSABLE, ROLES.TECNICO),
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
      if (rol === ROLES.TECNICO && jugador.equipo !== equipo_asignado) {
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

module.exports = router;
