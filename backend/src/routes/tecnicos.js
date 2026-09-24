const express = require('express');
const multer = require('multer');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const resolveClub = require('../middleware/resolveClub');
const { ROLES } = require('../config/roles');
const tecnicosSheetsSync = require('../config/tecnicosSheetsSync');

const router = express.Router();

router.use(requireAuth);
router.use(resolveClub);

const FOTO_BUCKET = 'tecnicos-fotos';
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

function timeoutResult(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data: null, error: new Error('timeout firmando foto') }), ms);
  });
}

async function conFotoUrl(row, { timeoutMs = null } = {}) {
  if (!row) return row;
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
      console.warn('No se pudieron firmar las fotos de tecnicos:', error.message);
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
    console.warn('No se pudieron firmar las fotos de tecnicos:', err.message);
    return rows.map(({ foto_path, ...resto }) => ({ ...resto, foto_url: null }));
  }
}

function esTablaInexistente(error) {
  const texto = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
  return error?.code === '42P01' || error?.code === 'PGRST205' || /could not find the table|does not exist|no existe/i.test(texto);
}

const CAMPOS_EDITABLES = [
  'nombre',
  'primer_apellido',
  'segundo_apellido',
  'tecnico',
  'fecha_nacimiento',
  'dni',
  'telefono',
  'email',
  'localidad',
  'temporada_incorporacion',
  'funcion_principal',
  'otra_funcion',
  'equipo_primer_entrenador',
  'equipo_segundo_entrenador',
  'titulacion_ninguna',
  'titulacion_monitor',
  'titulacion_nivel_1',
  'titulacion_nivel_2',
  'titulacion_nivel_3',
  'titulacion_sin_formacion',
  'titulacion_magisterio',
  'titulacion_tafad',
  'titulacion_ivef',
  'titulacion_cafyd',
  'titulacion_otras',
  'euskera',
  'cuenta_bancaria',
  'observaciones',
];

function normalizarTexto(valor) {
  return String(valor ?? '').trim();
}

function prepararRegistro(body) {
  const registro = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (!(campo in body)) continue;
    const valor = body[campo];
    registro[campo] = valor === '' || valor === null || valor === undefined ? null : normalizarTexto(valor);
  }
  return registro;
}

function validarPayload(registro) {
  if (!normalizarTexto(registro.nombre) || !normalizarTexto(registro.primer_apellido)) {
    return 'Nombre y primer apellido son obligatorios.';
  }
  return null;
}

async function empujarAHoja(club, tecnico) {
  try {
    return await tecnicosSheetsSync.escribirTecnicoEnHoja(club, tecnico);
  } catch (err) {
    console.error('Error escribiendo el tecnico en Google Sheets:', err.message);
    return { omitida: true, motivo: 'No se pudo escribir en la hoja de Google Sheets.' };
  }
}

router.get('/', async (req, res) => {
  try {
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    let query = supabaseAdmin.from('tecnicos').select('*').eq('club', req.club);

    if (search) {
      query = query.or(
        `nombre.ilike.%${search}%,primer_apellido.ilike.%${search}%,segundo_apellido.ilike.%${search}%,telefono.ilike.%${search}%,email.ilike.%${search}%,funcion_principal.ilike.%${search}%,equipo_primer_entrenador.ilike.%${search}%,equipo_segundo_entrenador.ilike.%${search}%`
      );
    }

    const { data, error } = await query.order('primer_apellido', { ascending: true }).order('nombre', { ascending: true });

    if (error) {
      console.error('Error consultando tecnicos:', error);
      if (esTablaInexistente(error)) {
        return res.status(503).json({
          error: 'La tabla tecnicos no existe todavia. Ejecuta backend/scripts/crear-tabla-tecnicos.sql en Supabase.',
        });
      }
      return res.status(503).json({ error: 'No se pudo consultar la base de datos de tecnicos.' });
    }

    const sanitized = await conFotosUrl((data || []).map((row) => ({ ...row })), { timeoutMs: 1500 });
    res.json({ tecnicos: sanitized });
  } catch (err) {
    console.error('Error inesperado al listar tecnicos:', err);
    return res.status(503).json({ error: 'No se pudo consultar la base de datos de tecnicos.' });
  }
});

// POST /api/tecnicos/sync -> importa desde la hoja publica de Google Sheets
// todos los tecnicos, sustituyendo el contenido de la tabla para el club
// activo (sincronizacion unidireccional: la hoja manda siempre).
router.post('/sync', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  const club = req.club;

  if (!tecnicosSheetsSync.estaConfigurado(club)) {
    return res.status(503).json({
      error: `La sincronizacion de tecnicos con Google Sheets no esta configurada para el club ${club}.`,
    });
  }

  let headers;
  let validas;
  let omitidas;
  try {
    ({ headers, validas, omitidas } = await tecnicosSheetsSync.leerFilasDesdeHoja(club));
  } catch (err) {
    console.error('Error leyendo la hoja de tecnicos:', err.message);
    return res.status(503).json({ error: 'No se pudo leer la hoja de calculo de tecnicos.' });
  }

  if (!headers || headers.length === 0) {
    return res.status(503).json({ error: 'La hoja de calculo de tecnicos no tiene cabeceras o no se pudo leer.' });
  }

  try {
    const { data: existentes, error: fetchError } = await supabaseAdmin
      .from('tecnicos')
      .select('id, dni, nombre, primer_apellido, actualizado_en')
      .eq('club', club);

    if (fetchError) throw fetchError;

    const existentePorDni = new Map();
    const existentePorNombre = new Map();
    (existentes || []).forEach((row) => {
      if (row.dni) existentePorDni.set(row.dni.trim().toUpperCase(), row);
      existentePorNombre.set(`${row.nombre}|${row.primer_apellido}`.trim().toUpperCase(), row);
    });

    const clavesVistas = new Set();
    const hashesConId = [];
    let insertados = 0;
    let actualizados = 0;
    let protegidos = 0;

    for (const datos of validas) {
      const registro = { ...datos, club };
      const claveDni = registro.dni ? registro.dni.trim().toUpperCase() : null;
      const claveNombre = `${registro.nombre}|${registro.primer_apellido}`.trim().toUpperCase();
      const existente = (claveDni && existentePorDni.get(claveDni)) || existentePorNombre.get(claveNombre);

      if (existente) {
        clavesVistas.add(existente.id);
        hashesConId.push({ id: existente.id, sheet_row_hash: registro.sheet_row_hash });

        // Si el tecnico fue editado desde la web despues de la marca temporal
        // de la fila en la hoja, esa edicion es mas reciente que el dato de
        // la hoja: se preserva y no se sobrescribe con la sincronizacion.
        const editadoEnWeb =
          existente.actualizado_en &&
          registro.marca_temporal &&
          new Date(existente.actualizado_en) > new Date(registro.marca_temporal);

        if (editadoEnWeb) {
          protegidos += 1;
          continue;
        }

        const { error: updateError } = await supabaseAdmin.from('tecnicos').update(registro).eq('id', existente.id);
        if (updateError) throw updateError;
        actualizados += 1;
      } else {
        const { data: creado, error: insertError } = await supabaseAdmin
          .from('tecnicos')
          .insert(registro)
          .select('id')
          .single();
        if (insertError) throw insertError;
        clavesVistas.add(creado.id);
        insertados += 1;
        hashesConId.push({ id: creado.id, sheet_row_hash: registro.sheet_row_hash });
      }
    }

    try {
      await tecnicosSheetsSync.marcarIdSyncEnHoja(club, hashesConId);
    } catch (err) {
      console.error('Error enlazando ID_SYNC en la hoja de tecnicos:', err.message);
    }

    let eliminados = 0;
    if (omitidas.length === 0) {
      const idsParaBorrar = (existentes || []).filter((row) => !clavesVistas.has(row.id)).map((row) => row.id);
      if (idsParaBorrar.length > 0) {
        const { error: deleteError, count } = await supabaseAdmin
          .from('tecnicos')
          .delete({ count: 'exact' })
          .in('id', idsParaBorrar);
        if (deleteError) throw deleteError;
        eliminados = count || 0;
      }
    }

    return res.json({
      insertados,
      actualizados,
      protegidos,
      eliminados,
      omitidos: omitidas.length,
    });
  } catch (err) {
    console.error('Error sincronizando tecnicos desde Google Sheets:', err.message);
    if (esTablaInexistente(err)) {
      return res.status(503).json({
        error: 'La tabla tecnicos no existe todavia. Ejecuta backend/scripts/crear-tabla-tecnicos.sql en Supabase.',
      });
    }
    return res.status(503).json({ error: 'No se pudo sincronizar los tecnicos desde Google Sheets.' });
  }
});

router.post('/', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  try {
    const registro = prepararRegistro(req.body || {});
    const errorValidacion = validarPayload(registro);
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    const { data, error } = await supabaseAdmin
      .from('tecnicos')
      .insert({ ...registro, club: req.club })
      .select('*')
      .single();

    if (error) {
      console.error('Error creando tecnico:', error);
      if (esTablaInexistente(error)) {
        return res.status(503).json({
          error: 'La tabla tecnicos no existe todavia. Ejecuta backend/scripts/crear-tabla-tecnicos.sql en Supabase.',
        });
      }
      return res.status(503).json({ error: 'No se pudo crear el tecnico.' });
    }

    const sheetSync = await empujarAHoja(req.club, data);
    return res.status(201).json({ tecnico: await conFotoUrl(data), sheet_sync: sheetSync });
  } catch (err) {
    console.error('Error inesperado creando tecnico:', err);
    return res.status(503).json({ error: 'No se pudo crear el tecnico.' });
  }
});

router.put('/:id', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  try {
    const registro = prepararRegistro(req.body || {});
    const errorValidacion = validarPayload({ ...req.body });
    if (errorValidacion) return res.status(400).json({ error: errorValidacion });

    registro.actualizado_en = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('tecnicos')
      .update(registro)
      .eq('id', req.params.id)
      .eq('club', req.club)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error actualizando tecnico:', error);
      if (esTablaInexistente(error)) {
        return res.status(503).json({
          error: 'La tabla tecnicos no existe todavia. Ejecuta backend/scripts/crear-tabla-tecnicos.sql en Supabase.',
        });
      }
      return res.status(503).json({ error: 'No se pudo actualizar el tecnico.' });
    }
    if (!data) {
      return res.status(404).json({ error: 'Tecnico no encontrado.' });
    }

    const sheetSync = await empujarAHoja(req.club, data);
    return res.json({ tecnico: await conFotoUrl(data), sheet_sync: sheetSync });
  } catch (err) {
    console.error('Error inesperado actualizando tecnico:', err);
    return res.status(503).json({ error: 'No se pudo actualizar el tecnico.' });
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

      const { data: registro, error: fetchError } = await supabaseAdmin
        .from('tecnicos')
        .select('id, foto_path')
        .eq('id', req.params.id)
        .eq('club', req.club)
        .maybeSingle();

      if (fetchError) {
        console.error('Error consultando tecnico para subir foto:', fetchError);
        if (esTablaInexistente(fetchError)) {
          return res.status(503).json({
            error: 'La tabla tecnicos no existe todavia. Ejecuta backend/scripts/crear-tabla-tecnicos.sql en Supabase.',
          });
        }
        return res.status(503).json({ error: 'No se pudo consultar la base de datos de tecnicos.' });
      }
      if (!registro) {
        return res.status(404).json({ error: 'Tecnico no encontrado.' });
      }

      const ext = EXT_POR_MIME[req.file.mimetype];
      const nuevoPath = `${registro.id}-${Date.now()}.${ext}`;

      const { error: uploadStorageError } = await supabaseAdmin.storage
        .from(FOTO_BUCKET)
        .upload(nuevoPath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

      if (uploadStorageError) {
        console.error('Error subiendo foto de tecnico:', uploadStorageError);
        return res.status(503).json({ error: 'No se pudo subir la foto.' });
      }

      const { error: updateError } = await supabaseAdmin
        .from('tecnicos')
        .update({ foto_path: nuevoPath, actualizado_en: new Date().toISOString() })
        .eq('id', registro.id)
        .eq('club', req.club);

      if (updateError) {
        console.error('Error actualizando foto_path del tecnico:', updateError);
        await supabaseAdmin.storage.from(FOTO_BUCKET).remove([nuevoPath]);
        return res.status(503).json({ error: 'No se pudo actualizar el tecnico.' });
      }

      if (registro.foto_path) {
        await supabaseAdmin.storage.from(FOTO_BUCKET).remove([registro.foto_path]);
      }

      const { data: completo } = await supabaseAdmin
        .from('tecnicos')
        .select('*')
        .eq('id', registro.id)
        .eq('club', req.club)
        .maybeSingle();
      if (completo) {
        await empujarAHoja(req.club, completo);
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
    const { data: existente } = await supabaseAdmin
      .from('tecnicos')
      .select('foto_path')
      .eq('id', req.params.id)
      .eq('club', req.club)
      .maybeSingle();

    const { error, count } = await supabaseAdmin
      .from('tecnicos')
      .delete({ count: 'exact' })
      .eq('id', req.params.id)
      .eq('club', req.club);

    if (error) {
      console.error('Error borrando tecnico:', error);
      if (esTablaInexistente(error)) {
        return res.status(503).json({
          error: 'La tabla tecnicos no existe todavia. Ejecuta backend/scripts/crear-tabla-tecnicos.sql en Supabase.',
        });
      }
      return res.status(503).json({ error: 'No se pudo borrar el tecnico.' });
    }
    if (!count) {
      return res.status(404).json({ error: 'Tecnico no encontrado.' });
    }

    if (existente?.foto_path) {
      await supabaseAdmin.storage.from(FOTO_BUCKET).remove([existente.foto_path]);
    }

    let sheetSync;
    try {
      sheetSync = await tecnicosSheetsSync.borrarTecnicoDeHoja(req.club, req.params.id);
    } catch (err) {
      console.error('Error borrando el tecnico de Google Sheets:', err.message);
      sheetSync = { omitida: true, motivo: 'No se pudo borrar la fila en Google Sheets.' };
    }

    return res.json({ ok: true, sheet_sync: sheetSync });
  } catch (err) {
    console.error('Error inesperado borrando tecnico:', err);
    return res.status(503).json({ error: 'No se pudo borrar el tecnico.' });
  }
});

module.exports = router;
