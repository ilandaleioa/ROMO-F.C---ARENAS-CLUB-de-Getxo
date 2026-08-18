const express = require('express');
const multer = require('multer');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const resolveClub = require('../middleware/resolveClub');
const { ROLES } = require('../config/roles');
const { CARGOS_PERSONAL } = require('../config/personal');
const { parseEquiposAsignados, filtrarEquiposPermitidos } = require('../lib/equiposAsignados');
const { construirSelect, ejecutarConFallback, esColumnaInexistente } = require('../lib/usuarioColumns');
const {
  parseEquiposPersonal,
  serializarEquiposPersonal,
  equipoPersonalCoincide,
} = require('../lib/personalEquipos');

const router = express.Router();

router.use(requireAuth);
router.use(resolveClub);

const FOTO_BUCKET = 'personal-fotos';
const FOTO_URL_TTL_SEGUNDOS = 600;
const PERSONAL_SELECT_BASE_FIELDS = ['id', 'nombre', 'primer_apellido', 'segundo_apellido', 'cargo', 'equipo'];
const PERSONAL_SELECT_OPTIONAL_FIELDS = ['foto_path'];
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

function equiposDesdeQuery(equipoQuery) {
  if (equipoQuery === undefined) return null;
  return parseEquiposPersonal(equipoQuery);
}

function timeoutResult(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data: null, error: new Error('timeout firmando foto') }), ms);
  });
}

async function conFotoUrl(row, { timeoutMs = null } = {}) {
  const { foto_path, ...resto } = row;
  if (!foto_path) {
    return { ...resto, foto_url: null };
  }

  try {
    const firmaPromise = supabaseAdmin.storage.from(FOTO_BUCKET).createSignedUrl(foto_path, FOTO_URL_TTL_SEGUNDOS);
    const { data, error } = timeoutMs ? await Promise.race([firmaPromise, timeoutResult(timeoutMs)]) : await firmaPromise;
    return { ...resto, foto_url: error || !data?.signedUrl ? null : data.signedUrl };
  } catch (err) {
    console.warn(`No se pudo firmar la foto "${foto_path}":`, err.message);
    return { ...resto, foto_url: null };
  }
}

async function conFotosUrl(rows, { timeoutMs = null } = {}) {
  const paths = Array.from(new Set(rows.map((row) => row.foto_path).filter(Boolean)));
  if (paths.length === 0) {
    return rows.map(({ foto_path, ...resto }) => ({ ...resto, foto_url: null }));
  }

  try {
    const firmaPromise = supabaseAdmin.storage.from(FOTO_BUCKET).createSignedUrls(paths, FOTO_URL_TTL_SEGUNDOS);
    const { data, error } = timeoutMs ? await Promise.race([firmaPromise, timeoutResult(timeoutMs)]) : await firmaPromise;

    if (error) {
      console.warn('No se pudieron firmar las fotos del personal:', error.message);
      return rows.map(({ foto_path, ...resto }) => ({ ...resto, foto_url: null }));
    }

    const urlsPorPath = new Map();
    (data || []).forEach((item, index) => {
      urlsPorPath.set(item.path || paths[index], item.signedUrl || null);
    });

    return rows.map(({ foto_path, ...resto }) => ({
      ...resto,
      foto_url: foto_path ? urlsPorPath.get(foto_path) || null : null,
    }));
  } catch (err) {
    console.warn('No se pudieron firmar las fotos del personal:', err.message);
    return rows.map(({ foto_path, ...resto }) => ({ ...resto, foto_url: null }));
  }
}

function normalizarTexto(valor) {
  return String(valor || '').trim();
}

function esColumnaOTablaInexistente(error) {
  const texto = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  // PostgREST devuelve PGRST205 cuando la tabla todavía no existe en el
  // esquema publicado, aunque PostgreSQL no llegue a devolver 42P01.
  return (
    error?.code === '42P01' ||
    error?.code === '42703' ||
    esColumnaInexistente(error, 'foto_path') ||
    error?.code === 'PGRST205' ||
    /could not find the table|does not exist|no existe/i.test(texto)
  );
}

function construirSelectPersonal(omitidas) {
  return construirSelect(PERSONAL_SELECT_BASE_FIELDS, PERSONAL_SELECT_OPTIONAL_FIELDS, omitidas);
}

async function ejecutarConsultaPersonalConFallback(ejecutar) {
  return ejecutarConFallback(PERSONAL_SELECT_OPTIONAL_FIELDS, ejecutar);
}

function validarPayload(body) {
  const nombre = normalizarTexto(body?.nombre);
  const primerApellido = normalizarTexto(body?.primer_apellido);
  const cargo = normalizarTexto(body?.cargo);
  const equipos = parseEquiposPersonal(body?.equipo);

  if (!nombre || !primerApellido || !cargo || equipos.length === 0) {
    return 'Nombre, primer apellido, cargo y al menos un equipo son obligatorios.';
  }
  if (!CARGOS_PERSONAL.includes(cargo)) {
    return 'El cargo no es valido.';
  }

  return null;
}

function prepararRegistro(body, club) {
  return {
    club,
    nombre: normalizarTexto(body?.nombre),
    primer_apellido: normalizarTexto(body?.primer_apellido),
    segundo_apellido: normalizarTexto(body?.segundo_apellido) || null,
    cargo: normalizarTexto(body?.cargo),
    equipo: serializarEquiposPersonal(body?.equipo),
  };
}

function puedeGestionar(req) {
  return req.user?.rol === ROLES.ADMINISTRADOR || req.user?.rol === ROLES.DIRECTOR;
}

router.get('/', async (req, res) => {
  try {
    const { rol, equipo_asignado } = req.user;
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const equiposAsignados = parseEquiposAsignados(equipo_asignado);

    if (rol === ROLES.TECNICO && !equipo_asignado) {
      return res.status(409).json({ error: 'Tu usuario no tiene un equipo asignado. Contacta con el administrador.' });
    }

    const equiposFiltro = equiposDesdeQuery(req.query.equipo);

    const { data, error } = await ejecutarConsultaPersonalConFallback((omitidas) => {
      let query = supabaseAdmin
        .from('personal')
        .select(construirSelectPersonal(omitidas))
        .eq('club', req.club);

      if (search) {
        query = query.or(
          `nombre.ilike.%${search}%,primer_apellido.ilike.%${search}%,segundo_apellido.ilike.%${search}%,cargo.ilike.%${search}%,equipo.ilike.%${search}%`
        );
      }

      return query.order('primer_apellido', { ascending: true }).order('nombre', { ascending: true });
    });
    if (error) {
      console.error('Error consultando personal:', error);
      if (esColumnaOTablaInexistente(error)) {
        return res.status(503).json({
          error: 'La tabla personal no tiene el esquema esperado. Ejecuta backend/scripts/crear-tabla-personal.sql en Supabase.',
        });
      }
      return res.status(503).json({ error: 'No se pudo consultar la base de datos de personal.' });
    }

    const filasFiltradas = (data || []).filter((row) => {
      if (equiposAsignados.length > 0 && !equipoPersonalCoincide(row.equipo, equiposAsignados)) {
        return false;
      }
      if (equiposFiltro !== null && !equipoPersonalCoincide(row.equipo, equiposFiltro)) {
        return false;
      }
      return true;
    });

    const sanitized = await conFotosUrl(filasFiltradas.map((row) => ({ ...row })), { timeoutMs: 1500 });
    res.json({ personal: sanitized });
  } catch (err) {
    console.error('Error inesperado al listar personal:', err);
    return res.status(503).json({ error: 'No se pudo consultar la base de datos de personal.' });
  }
});

router.get('/equipos', async (req, res) => {
  try {
    const { rol, equipo_asignado } = req.user;
    if (rol === ROLES.TECNICO && !equipo_asignado) {
      return res.status(409).json({ error: 'Tu usuario no tiene un equipo asignado. Contacta con el administrador.' });
    }

    const { data, error } = await supabaseAdmin.from('personal').select('equipo').eq('club', req.club);
    if (error) {
      if (esColumnaOTablaInexistente(error)) {
        return res.status(503).json({
          error: 'La tabla personal no tiene el esquema esperado. Ejecuta backend/scripts/crear-tabla-personal.sql en Supabase.',
        });
      }
      return res.status(503).json({ error: 'No se pudo consultar la base de datos de personal.' });
    }

    const equipos = filtrarEquiposPermitidos(
      (data || []).flatMap((row) => parseEquiposPersonal(row.equipo)),
      req.user
    ).sort((a, b) =>
      String(a).localeCompare(String(b), 'es', { sensitivity: 'base' })
    );

    res.json({ equipos });
  } catch (err) {
    console.error('Error inesperado consultando equipos de personal:', err);
    return res.status(503).json({ error: 'No se pudo consultar la base de datos de personal.' });
  }
});

router.post('/', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  try {
    const error = validarPayload(req.body);
    if (error) return res.status(400).json({ error });

    const { data, error: dbError } = await ejecutarConsultaPersonalConFallback((omitidas) =>
      supabaseAdmin
        .from('personal')
        .insert(prepararRegistro(req.body, req.club))
        .select(construirSelectPersonal(omitidas))
        .single()
    );

    if (dbError) {
      console.error('Error creando personal:', dbError);
      if (esColumnaOTablaInexistente(dbError)) {
        return res.status(503).json({
          error: 'La tabla personal no tiene el esquema esperado. Ejecuta backend/scripts/crear-tabla-personal.sql en Supabase.',
        });
      }
      return res.status(503).json({ error: 'No se pudo crear el personal.' });
    }

    return res.status(201).json({ personal: await conFotoUrl(data) });
  } catch (err) {
    console.error('Error inesperado creando personal:', err);
    return res.status(503).json({ error: 'No se pudo crear el personal.' });
  }
});

router.put('/:id', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  try {
    const error = validarPayload(req.body);
    if (error) return res.status(400).json({ error });

    const { data, error: dbError } = await ejecutarConsultaPersonalConFallback((omitidas) =>
      supabaseAdmin
        .from('personal')
        .update(prepararRegistro(req.body, req.club))
        .eq('id', req.params.id)
        .eq('club', req.club)
        .select(construirSelectPersonal(omitidas))
        .maybeSingle()
    );

    if (dbError) {
      console.error('Error actualizando personal:', dbError);
      if (esColumnaOTablaInexistente(dbError)) {
        return res.status(503).json({
          error: 'La tabla personal no tiene el esquema esperado. Ejecuta backend/scripts/crear-tabla-personal.sql en Supabase.',
        });
      }
      return res.status(503).json({ error: 'No se pudo actualizar el personal.' });
    }
    if (!data) {
      return res.status(404).json({ error: 'Personal no encontrado.' });
    }

    return res.json({ personal: await conFotoUrl(data) });
  } catch (err) {
    console.error('Error inesperado actualizando personal:', err);
    return res.status(503).json({ error: 'No se pudo actualizar el personal.' });
  }
});

router.post(
  '/:id/foto',
  requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR),
  (req, res) => {
    uploadFoto.single('foto')(req, res, async (uploadErr) => {
      if (uploadErr) {
        return res.status(400).json({ error: uploadErr.message || 'No se pudo procesar la imagen.' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No se ha enviado ninguna imagen.' });
      }

      let registro = null;
      let fetchError = null;
      const consultaConFoto = await supabaseAdmin
        .from('personal')
        .select('id, foto_path, equipo')
        .eq('id', req.params.id)
        .eq('club', req.club)
        .maybeSingle();

      if (consultaConFoto.error && esColumnaOTablaInexistente(consultaConFoto.error)) {
        const consultaSinFoto = await supabaseAdmin
          .from('personal')
          .select('id, equipo')
          .eq('id', req.params.id)
          .eq('club', req.club)
          .maybeSingle();

        fetchError = consultaSinFoto.error;
        registro = consultaSinFoto.data ? { ...consultaSinFoto.data, foto_path: null } : null;
      } else {
        fetchError = consultaConFoto.error;
        registro = consultaConFoto.data;
      }

      if (fetchError) {
        if (esColumnaOTablaInexistente(fetchError)) {
          return res.status(503).json({
            error: 'La tabla personal no tiene el esquema esperado. Ejecuta backend/scripts/crear-tabla-personal.sql en Supabase.',
          });
        }
        return res.status(503).json({ error: 'No se pudo consultar la base de datos de personal.' });
      }
      if (!registro) {
        return res.status(404).json({ error: 'Personal no encontrado.' });
      }

      const ext = EXT_POR_MIME[req.file.mimetype];
      const nuevoPath = `${registro.id}-${Date.now()}.${ext}`;

      const { error: uploadStorageError } = await supabaseAdmin.storage
        .from(FOTO_BUCKET)
        .upload(nuevoPath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

      if (uploadStorageError) {
        return res.status(503).json({ error: 'No se pudo subir la foto.' });
      }

      const { error: updateError } = await supabaseAdmin
        .from('personal')
        .update({ foto_path: nuevoPath })
        .eq('id', registro.id)
        .eq('club', req.club);

      if (updateError) {
        if (esColumnaOTablaInexistente(updateError)) {
          return res.status(503).json({
            error: 'La tabla personal no tiene el esquema esperado. Ejecuta backend/scripts/crear-tabla-personal.sql en Supabase.',
          });
        }
        await supabaseAdmin.storage.from(FOTO_BUCKET).remove([nuevoPath]);
        return res.status(503).json({ error: 'No se pudo actualizar el personal.' });
      }

      if (registro.foto_path) {
        await supabaseAdmin.storage.from(FOTO_BUCKET).remove([registro.foto_path]);
      }

      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from(FOTO_BUCKET)
        .createSignedUrl(nuevoPath, FOTO_URL_TTL_SEGUNDOS);

      return res.json({ foto_url: signError ? null : signed?.signedUrl || null });
    });
  }
);

router.delete('/:id', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  try {
    const equiposUsuario = parseEquiposAsignados(req.user?.equipo_asignado);
    let registro = null;
    let fetchError = null;
    const consultaConFoto = await supabaseAdmin
      .from('personal')
      .select('id, foto_path, equipo')
      .eq('id', req.params.id)
      .eq('club', req.club)
      .maybeSingle();

    if (consultaConFoto.error && esColumnaOTablaInexistente(consultaConFoto.error)) {
      const consultaSinFoto = await supabaseAdmin
        .from('personal')
        .select('id, equipo')
        .eq('id', req.params.id)
        .eq('club', req.club)
        .maybeSingle();

      fetchError = consultaSinFoto.error;
      registro = consultaSinFoto.data ? { ...consultaSinFoto.data, foto_path: null } : null;
    } else {
      fetchError = consultaConFoto.error;
      registro = consultaConFoto.data;
    }

    if (fetchError) {
      if (esColumnaOTablaInexistente(fetchError)) {
        return res.status(503).json({
          error: 'La tabla personal no tiene el esquema esperado. Ejecuta backend/scripts/crear-tabla-personal.sql en Supabase.',
        });
      }
      return res.status(503).json({ error: 'No se pudo consultar la base de datos de personal.' });
    }
    if (!registro) {
      return res.status(404).json({ error: 'Personal no encontrado.' });
    }

    if (equiposUsuario.length > 0 && !equipoPersonalCoincide(registro.equipo, equiposUsuario)) {
      return res.status(403).json({ error: 'No tienes permiso para borrar este personal.' });
    }

    const { error: deleteError, count } = await supabaseAdmin
      .from('personal')
      .delete({ count: 'exact' })
      .eq('club', req.club)
      .eq('id', req.params.id);

    if (deleteError) {
      if (esColumnaOTablaInexistente(deleteError)) {
        return res.status(503).json({
          error: 'La tabla personal no tiene el esquema esperado. Ejecuta backend/scripts/crear-tabla-personal.sql en Supabase.',
        });
      }
      return res.status(503).json({ error: 'No se pudo eliminar el personal.' });
    }
    if (!count) {
      return res.status(404).json({ error: 'Personal no encontrado.' });
    }

    if (registro.foto_path) {
      await supabaseAdmin.storage.from(FOTO_BUCKET).remove([registro.foto_path]);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Error inesperado eliminando personal:', err);
    return res.status(503).json({ error: 'No se pudo borrar el personal.' });
  }
});

module.exports = router;
