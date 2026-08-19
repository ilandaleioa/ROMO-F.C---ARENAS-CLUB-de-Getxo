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
const { parseEquiposAsignados, filtrarEquiposPermitidos, puedeVerEquipo } = require('../lib/equiposAsignados');
const { ordenarEquipos: ordenarEquiposGlobal } = require('../lib/equiposOrden');

const router = express.Router();
const sincronizacionesEnCurso = new Set();

function bloquearSincronizacion(req, res, next) {
  const club = req.club;
  if (sincronizacionesEnCurso.has(club)) {
    return res.status(409).json({ error: `Ya hay una sincronizacion en curso para ${club}. Espera a que termine.` });
  }

  sincronizacionesEnCurso.add(club);
  res.once('finish', () => sincronizacionesEnCurso.delete(club));
  res.once('close', () => sincronizacionesEnCurso.delete(club));
  return next();
}

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

function equiposDesdeQuery(equipoQuery) {
  if (equipoQuery === undefined) return null;
  const valores = Array.isArray(equipoQuery) ? equipoQuery : [equipoQuery];
  return Array.from(
    new Set(
      valores
        .map((e) => String(e || '').trim())
        .filter((e) => e && e !== 'Todos')
    )
  );
}

function aplicarFiltroEquipos(query, equipos) {
  if (equipos.length === 1) return query.eq('equipo', equipos[0]);
  if (equipos.length > 1) return query.in('equipo', equipos);
  return query;
}

// Sustituye "foto_path" (interno) por una URL firmada de corta duracion en la respuesta.
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
    const firmaPromise = supabaseAdmin.storage
      .from(FOTO_BUCKET)
      .createSignedUrl(foto_path, FOTO_URL_TTL_SEGUNDOS);
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
    const firmaPromise = supabaseAdmin.storage
      .from(FOTO_BUCKET)
      .createSignedUrls(paths, FOTO_URL_TTL_SEGUNDOS);
    const { data, error } = timeoutMs ? await Promise.race([firmaPromise, timeoutResult(timeoutMs)]) : await firmaPromise;

    if (error) {
      console.warn('No se pudieron firmar las fotos de jugadores:', error.message);
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
    console.warn('No se pudieron firmar las fotos de jugadores:', err.message);
    return rows.map(({ foto_path, ...resto }) => ({ ...resto, foto_url: null }));
  }
}

// POST /api/jugadores -> crea un jugador desde el formulario de la app.
router.post('/', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  try {
    const body = req.body || {};
    const nombre = String(body.nombre || '').trim();
    const primer_apellido = String(body.primer_apellido || '').trim();
    const segundo_apellido = String(body.segundo_apellido || '').trim();
    const equipo = String(body.equipo || '').trim();

    if (!nombre || !primer_apellido || !equipo) {
      return res.status(400).json({ error: 'Nombre, primer apellido y equipo son obligatorios.' });
    }

    const dorsal = body.dorsal === '' || body.dorsal === null || body.dorsal === undefined ? null : Number(body.dorsal);
    if (dorsal !== null && (!Number.isInteger(dorsal) || dorsal < 1 || dorsal > 99)) {
      return res.status(400).json({ error: 'El dorsal debe ser un numero entre 1 y 99.' });
    }

    const { data, error } = await supabaseAdmin
      .from('jugadores')
      .insert({
        club: req.club,
        nombre,
        primer_apellido,
        segundo_apellido: segundo_apellido || null,
        equipo,
        fecha_nacimiento: body.fecha_nacimiento || null,
        dorsal,
        lateralidad: body.lateralidad || null,
        demarcacion: body.demarcacion || null,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creando jugador:', error);
      return res.status(503).json({ error: 'No se pudo crear el jugador.' });
    }

    return res.status(201).json({ jugador: await conFotoUrl(sanitizeRow(data, req.user.rol)) });
  } catch (err) {
    console.error('Error inesperado creando jugador:', err);
    return res.status(503).json({ error: 'No se pudo crear el jugador.' });
  }
});

// GET /api/jugadores?equipo=xxx&q=busqueda
// Si el usuario tiene equipos asignados, se limita siempre a esa lista.
router.get('/', async (req, res) => {
  try {
    const { rol, equipo_asignado } = req.user;
    const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const equiposAsignados = parseEquiposAsignados(equipo_asignado);

    // Pedimos toda la fila para que una columna nueva o antigua del esquema no
    // tumbe el listado; el saneado de campos sigue haciendose en backend con la
    // whitelist por rol antes de responder.
    let query = supabaseAdmin.from('jugadores').select('*').eq('club', req.club);

    if (rol === ROLES.TECNICO && !equipo_asignado) {
      return res.status(409).json({ error: 'Tu usuario no tiene un equipo asignado. Contacta con el administrador.' });
    }

    const equiposFiltro = equiposDesdeQuery(req.query.equipo);
    if (equiposAsignados.length > 0) {
      const permitidos = new Set(equiposAsignados);
      const equiposFinales = equiposFiltro === null ? equiposAsignados : equiposFiltro.filter((eq) => permitidos.has(eq));
      if (equiposFinales.length === 0) return res.json({ jugadores: [] });
      query = aplicarFiltroEquipos(query, equiposFinales);
    } else if (equiposFiltro !== null) {
      query = aplicarFiltroEquipos(query, equiposFiltro);
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

    const sanitized = await conFotosUrl((data || []).map((row) => sanitizeRow(row, rol)), { timeoutMs: 1500 });
    res.json({ jugadores: sanitized });
  } catch (err) {
    console.error('Error inesperado al listar jugadores:', err);
    return res.status(503).json({ error: 'No se pudo consultar la base de datos de jugadores.' });
  }
});

// Orden de equipos mostrado en la app. Separamos por club para respetar la
// jerarquía real de cada cantera sin depender del orden alfabético.
const ORDEN_EQUIPOS_POR_CLUB = {
  ARENAS: [
    'Juvenil A',
    'Juvenil B',
    'Cadete A',
    'Cadete B',
    'Infantil 13',
    'Infantil 14',
    'Alevín 15A',
    'Alevín 15B',
    'Alevín 16A',
    'Alevín 16B',
    'Benjamín 17',
    'Benjamín 18',
  ],
  ROMO: [
    'Juvenil A',
    'Juvenil B',
    'Cadete A',
    'Cadete B',
    'Infantil 13',
    'Infantil 14',
    'Alevín 15A',
    'Alevín 15B',
    'Alevín 16A',
    'Alevín 16B',
    'Benjamín 17',
    'Benjamín 18',
  ],
};

function ordenarEquipos(equipos, club) {
  const ordenClub = ORDEN_EQUIPOS_POR_CLUB[club] || [];
  return [...equipos].sort((a, b) => {
    const ia = ordenClub.indexOf(a);
    const ib = ordenClub.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// GET /api/jugadores/equipos -> lista de equipos distintos (para el selector).
// Solo tiene sentido para Administrador/Responsable; Tecnico ya conoce su equipo.
router.get('/equipos', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('jugadores').select('equipo').eq('club', req.club);
  if (error) {
    return res.status(503).json({ error: 'No se pudo consultar la base de datos de jugadores.' });
  }

  const equipos = ordenarEquiposGlobal(filtrarEquiposPermitidos((data || []).map((r) => r.equipo).filter(Boolean), req.user));
  res.json({ equipos });
});

// GET /api/jugadores/:id -> ficha de un jugador.
router.get('/:id', async (req, res) => {
  const { rol, equipo_asignado } = req.user;

  const { data, error } = await supabaseAdmin
    .from('jugadores')
    .select('*')
    .eq('id', req.params.id)
    .eq('club', req.club)
    .maybeSingle();

  if (error) {
    return res.status(503).json({ error: 'No se pudo consultar la base de datos de jugadores.' });
  }
  if (!data) {
    return res.status(404).json({ error: 'Jugador no encontrado.' });
  }

  if (rol === ROLES.TECNICO && !equipo_asignado) {
    return res.status(409).json({ error: 'Tu usuario no tiene un equipo asignado. Contacta con el administrador.' });
  }
  if (!puedeVerEquipo(req.user, data.equipo)) {
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
        .eq('club', req.club)
        .maybeSingle();

      if (fetchError) {
        return res.status(503).json({ error: 'No se pudo consultar la base de datos de jugadores.' });
      }
      if (!jugador) {
        return res.status(404).json({ error: 'Jugador no encontrado.' });
      }
      if (rol === ROLES.TECNICO && !equipo_asignado) {
        return res.status(409).json({ error: 'Tu usuario no tiene un equipo asignado. Contacta con el administrador.' });
      }
      if (!puedeVerEquipo(req.user, jugador.equipo)) {
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

async function sincronizarJugadorEditadoConHoja(jugador, club) {
  if (!sheetsSync.estaConfigurado(club)) {
    return {
      ok: false,
      omitida: true,
      motivo: `La sincronizacion con Google Sheets no esta configurada para el club ${club}.`,
    };
  }

  let sheets;
  let tabTitle;
  try {
    sheets = sheetsSync.getSheetsClient();
    tabTitle = await sheetsSync.resolverPestana(sheets, club);
  } catch (err) {
    return {
      ok: false,
      omitida: true,
      motivo: 'No se pudo conectar con Google Sheets.',
    };
  }

  const resultado = await sheetsSync.sincronizarSupabaseHaciaSheet(sheets, tabTitle, club, [jugador]);
  if (resultado.omitida) {
    return {
      ok: false,
      omitida: true,
      motivo: resultado.motivo,
    };
  }

  const hashAplicado = resultado.hashesAplicados[0];
  if (hashAplicado) {
    const { error } = await supabaseAdmin
      .from('jugadores')
      .update({ sheet_row_hash: hashAplicado.sheet_row_hash })
      .eq('id', hashAplicado.id)
      .eq('club', club);

    if (error) throw error;
  }

  return {
    ok: true,
    omitida: false,
    actualizados: resultado.actualizados,
    insertados: resultado.insertados,
  };
}

// PATCH /api/jugadores/:id/datos-deportivos -> actualiza dorsal/lateralidad/demarcacion.
// Solo Administrador, Responsable y Director pueden editar estos datos.
router.patch(
  '/:id/datos-deportivos',
  requireRole(ROLES.ADMINISTRADOR, ROLES.RESPONSABLE, ROLES.DIRECTOR),
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
      const lateralidadNormalizada = lateralidad === null ? null : String(lateralidad).trim() || null;
      if (lateralidadNormalizada !== null && !LATERALIDAD_VALUES.includes(lateralidadNormalizada)) {
        return res
          .status(400)
          .json({ error: `Lateralidad no valida. Valores permitidos: ${LATERALIDAD_VALUES.join(', ')}.` });
      }
      updates.lateralidad = lateralidadNormalizada;
    }
    if (demarcacion !== undefined) {
      const demarcacionNormalizada = demarcacion === null ? null : String(demarcacion).trim() || null;
      if (demarcacionNormalizada !== null && !DEMARCACION_VALUES.includes(demarcacionNormalizada)) {
        return res
          .status(400)
          .json({ error: `Demarcacion no valida. Valores permitidos: ${DEMARCACION_VALUES.join(', ')}.` });
      }
      updates.demarcacion = demarcacionNormalizada;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar.' });
    }

    try {
      if (!req.user) {
        return res.status(401).json({ error: 'No hay sesion activa. Inicia sesion de nuevo.' });
      }

      const { rol } = req.user;
      const { data: jugadorActual, error: errorJugadorActual } = await supabaseAdmin
        .from('jugadores')
        .select('equipo')
        .eq('id', req.params.id)
        .eq('club', req.club)
        .maybeSingle();

      if (errorJugadorActual) {
        return res.status(503).json({ error: 'No se pudo consultar la base de datos de jugadores.' });
      }
      if (!jugadorActual) {
        return res.status(404).json({ error: 'Jugador no encontrado.' });
      }
      if (!puedeVerEquipo(req.user, jugadorActual.equipo)) {
        return res.status(403).json({ error: 'No tienes permiso para editar este jugador.' });
      }

      if (updates.dorsal !== undefined && updates.dorsal !== null) {
        const { data: dorsalDuplicado, error: errorDorsalDuplicado } = await supabaseAdmin
          .from('jugadores')
          .select('id')
          .eq('club', req.club)
          .eq('equipo', jugadorActual.equipo)
          .eq('dorsal', updates.dorsal)
          .neq('id', req.params.id)
          .maybeSingle();

        if (errorDorsalDuplicado) {
          return res.status(503).json({ error: 'No se pudo comprobar el dorsal del jugador.' });
        }
        if (dorsalDuplicado) {
          return res.status(409).json({
            error: 'Ya existe otro jugador de ese equipo con ese dorsal. Elige otro numero.',
          });
        }
      }

      const { data, error } = await supabaseAdmin
        .from('jugadores')
        .update(updates)
        .eq('id', req.params.id)
        .eq('club', req.club)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Error de Supabase actualizando datos deportivos:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        if (error.code === '23505') {
          return res.status(409).json({
            error: 'No se pudo guardar porque ese dorsal ya esta asignado en el equipo.',
          });
        }

        return res.status(503).json({ error: 'No se pudo actualizar el jugador.' });
      }
      if (!data) {
        return res.status(404).json({ error: 'Jugador no encontrado.' });
      }

      let sheetSync = null;
      try {
        sheetSync = await sincronizarJugadorEditadoConHoja(data, req.club);
      } catch (err) {
        console.warn('Jugador actualizado, pero no se pudo sincronizar con Google Sheets:', err.message);
        sheetSync = {
          ok: false,
          omitida: true,
          motivo: 'El jugador se guardo en la app, pero no se pudo actualizar la hoja de calculo.',
        };
      }

      res.json({ jugador: await conFotoUrl(sanitizeRow(data, rol)), sheet_sync: sheetSync });
    } catch (err) {
      console.error('Excepcion actualizando datos deportivos:', err);
      res.status(503).json({ error: 'No se pudo actualizar el jugador.' });
    }
  }
);

// DELETE /api/jugadores/:id -> elimina un jugador de Supabase y su foto asociada.
router.delete('/:id', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), async (req, res) => {
  try {
    const { data: jugador, error: fetchError } = await supabaseAdmin
      .from('jugadores')
      .select('id, equipo, foto_path')
      .eq('id', req.params.id)
      .eq('club', req.club)
      .maybeSingle();

    if (fetchError) {
      return res.status(503).json({ error: 'No se pudo consultar la base de datos de jugadores.' });
    }
    if (!jugador) {
      return res.status(404).json({ error: 'Jugador no encontrado.' });
    }
    if (!puedeVerEquipo(req.user, jugador.equipo)) {
      return res.status(403).json({ error: 'No tienes permiso para borrar este jugador.' });
    }

    const resultadoBorrado = await borrarJugadoresYFotos([jugador], req.club);
    if (!resultadoBorrado.borrados) {
      return res.status(404).json({ error: 'Jugador no encontrado.' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Error inesperado eliminando jugador:', err.message);
    res.status(503).json({ error: 'No se pudo borrar el jugador.' });
  }
});

async function borrarJugadoresYFotos(jugadores, club) {
  const jugadoresUnicos = Array.from(
    new Map((jugadores || []).filter((jugador) => jugador?.id).map((jugador) => [jugador.id, jugador])).values()
  );

  if (jugadoresUnicos.length === 0) {
    return { borrados: 0, fotos_borradas: 0 };
  }

  const ids = jugadoresUnicos.map((jugador) => jugador.id);
  const fotos = Array.from(new Set(jugadoresUnicos.map((jugador) => jugador.foto_path).filter(Boolean)));

  const { error: deleteError, count } = await supabaseAdmin
    .from('jugadores')
    .delete({ count: 'exact' })
    .eq('club', club)
    .in('id', ids);

  if (deleteError) {
    throw deleteError;
  }

  if (fotos.length > 0) {
    const { error: storageError } = await supabaseAdmin.storage.from(FOTO_BUCKET).remove(fotos);
    if (storageError) {
      console.warn('Jugadores borrados, pero no se pudieron eliminar algunas fotos:', storageError.message);
    }
  }

  return { borrados: count || ids.length, fotos_borradas: fotos.length };
}

async function actualizarJugadoresDesdeSheet(actualizables, club) {
  let actualizados = 0;
  let noEncontrados = 0;
  let sinCambios = 0;
  let supabaseGanadores = 0;
  let conflictos = 0;

  if (actualizables.length === 0) {
    return { actualizados, noEncontrados, sinCambios, supabaseGanadores, conflictos };
  }

  const ids = actualizables.map((fila) => fila.id);
  const { data: existentes, error: fetchError } = await supabaseAdmin
    .from('jugadores')
    .select('*')
    .eq('club', club)
    .in('id', ids);

  if (fetchError) throw fetchError;
  const jugadoresPorId = new Map((existentes || []).map((jugador) => [jugador.id, jugador]));

  for (const fila of actualizables) {
    const jugadorActual = jugadoresPorId.get(fila.id);
    if (!jugadorActual) {
      noEncontrados += 1;
      continue;
    }

    const hashSheet = fila.datos.sheet_row_hash;
    const hashBase = jugadorActual.sheet_row_hash;
    const hashSupabase = sheetsSync.calcularSheetRowHash(jugadorActual);
    const sheetCambio = hashBase ? hashSheet !== hashBase : true;
    const supabaseCambio = hashBase ? hashSupabase !== hashBase : false;

    if (!sheetCambio && !supabaseCambio) {
      sinCambios += 1;
      continue;
    }

    if (!sheetCambio && supabaseCambio) {
      supabaseGanadores += 1;
      continue;
    }

    if (sheetCambio && supabaseCambio) {
      conflictos += 1;
    }

    const { sheet_row_hash, ...datosSinHash } = fila.datos;
    const { data, error } = await supabaseAdmin
      .from('jugadores')
      .update(datosSinHash)
      .eq('id', fila.id)
      .eq('club', club)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (data) {
      if (sheet_row_hash) {
        const { error: hashError } = await supabaseAdmin
          .from('jugadores')
          .update({ sheet_row_hash })
          .eq('id', fila.id)
          .eq('club', club);

        if (hashError) {
          if (hashError.code === '23505') {
            conflictos += 1;
            continue;
          }
          throw hashError;
        }
      }
      actualizados += 1;
    }
  }

  return { actualizados, noEncontrados, sinCambios, supabaseGanadores, conflictos };
}

async function sincronizarSupabaseConHoja(sheets, tabTitle, club) {
  const { data: jugadores, error } = await supabaseAdmin
    .from('jugadores')
    .select('*')
    .eq('club', club);

  if (error) throw error;

  const resultado = await sheetsSync.sincronizarSupabaseHaciaSheet(sheets, tabTitle, club, jugadores || [], {
    eliminarFilasNoVinculadas: true,
  });
  if (resultado.omitida || resultado.hashesAplicados.length === 0) return resultado;

  for (const item of resultado.hashesAplicados) {
    const { error: updateError } = await supabaseAdmin
      .from('jugadores')
      .update({ sheet_row_hash: item.sheet_row_hash })
      .eq('id', item.id)
      .eq('club', club);

    if (updateError) {
      if (updateError.code === '23505') {
        continue;
      }
      throw updateError;
    }
  }

  return resultado;
}

function respuestaSync(base, hojaResultado) {
  const avisoHoja = hojaResultado?.omitida ? hojaResultado.motivo : null;
  const aviso = [base.aviso, avisoHoja].filter(Boolean).join(' ');
  return {
    ...base,
    hoja_actualizados: hojaResultado?.actualizados || 0,
    hoja_insertados: hojaResultado?.insertados || 0,
    hoja_eliminados: hojaResultado?.eliminados || 0,
    sync_bidireccional: !hojaResultado?.omitida,
    ...(aviso ? { aviso } : {}),
  };
}

function normalizarClave(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function claveJugador(datos) {
  const dni = normalizarClave(datos.dni_jugador);
  if (dni) return `dni:${dni}`;

  return [
    datos.nombre,
    datos.primer_apellido,
    datos.segundo_apellido,
    datos.equipo,
    datos.fecha_nacimiento,
  ]
    .map(normalizarClave)
    .join('|');
}

async function separarPendientesNuevos(pendientes, club) {
  const { data, error } = await supabaseAdmin
    .from('jugadores')
    .select('id, nombre, primer_apellido, segundo_apellido, equipo, fecha_nacimiento, dni_jugador, sheet_row_hash')
    .eq('club', club);

  if (error) throw error;

  const idPorHash = new Map();
  const idPorClave = new Map();

  for (const jugador of data || []) {
    if (jugador.sheet_row_hash) idPorHash.set(jugador.sheet_row_hash, jugador.id);
    const clave = claveJugador(jugador);
    if (clave && !idPorClave.has(clave)) idPorClave.set(clave, jugador.id);
  }

  const insertables = [];
  const duplicados = [];
  const hashesPendientes = new Set();
  const clavesPendientes = new Set();

  for (const pendiente of pendientes) {
    const hash = pendiente.datos.sheet_row_hash;
    const clave = claveJugador(pendiente.datos);
    const idExistente = (hash && idPorHash.get(hash)) || idPorClave.get(clave);

    if (idExistente) {
      duplicados.push({ ...pendiente, id: idExistente });
      continue;
    }

    if ((hash && hashesPendientes.has(hash)) || clavesPendientes.has(clave)) {
      duplicados.push(pendiente);
      continue;
    }

    insertables.push(pendiente);
    if (hash) hashesPendientes.add(hash);
    clavesPendientes.add(clave);
  }

  return { insertables, duplicados };
}

// POST /api/jugadores/sync -> importa desde Google Sheets las filas nuevas
// del formulario (las que aun no tienen ID_SYNC) e inserta cada una en
// "jugadores". Las filas que ya tienen ID_SYNC actualizan el jugador enlazado
// en todos los campos presentes en la hoja. Administrador y Director pueden
// escribir en bloque datos sensibles de menores (DNI, telefono, domicilio,
// datos de padres/madres).
router.post('/sync', requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR), bloquearSincronizacion, async (req, res) => {
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
  let actualizables;
  let omitidas;
  try {
    ({ headers, idxIdSync, pendientes, actualizables = [], omitidas } = await sheetsSync.leerFilasPendientes(
      sheets,
      tabTitle,
      club
    ));
  } catch (err) {
    console.error('Error leyendo filas de Google Sheets:', err.message);
    return res.status(503).json({ error: 'No se pudo leer la hoja de calculo.' });
  }

  // Una lectura vacia o incompleta no debe interpretarse como una hoja sin
  // jugadores, porque el flujo de sincronizacion tambien puede borrar filas.
  if (!headers || headers.length === 0) {
    return res.status(503).json({ error: 'La hoja de calculo no tiene cabeceras o no se pudo leer.' });
  }

  const omisionesPorMotivo = omitidas.reduce((acc, fila) => {
    acc[fila.motivo] = (acc[fila.motivo] || 0) + 1;
    return acc;
  }, {});

  let actualizados = 0;
  let noEncontrados = 0;
  let sinCambios = 0;
  let supabaseGanadores = 0;
  let conflictos = 0;
  let borrados = 0;
  let fotosBorradas = 0;
  if (actualizables.length > 0) {
    try {
      ({ actualizados, noEncontrados, sinCambios, supabaseGanadores, conflictos } = await actualizarJugadoresDesdeSheet(
        actualizables,
        club
      ));
    } catch (err) {
      console.error('Error actualizando jugadores desde Sheets:', err.message);
      return res.status(503).json({ error: 'No se pudieron actualizar los jugadores en la base de datos.' });
    }
  }

  const empujarSupabaseAHoja = async () => {
    try {
      return await sincronizarSupabaseConHoja(sheets, tabTitle, club);
    } catch (err) {
      console.error('Error sincronizando Supabase hacia Google Sheets:', err.message);
      return {
        omitida: true,
        motivo: 'No se pudo escribir en Google Sheets desde Supabase.',
        actualizados: 0,
        insertados: 0,
      };
    }
  };

  let insertables;
  let duplicados;
  try {
    ({ insertables, duplicados } = await separarPendientesNuevos(pendientes, club));
  } catch (err) {
    console.error('Error comprobando duplicados desde Sheets:', err.message);
    return res.status(503).json({ error: 'No se pudo comprobar si ya existen jugadores en la base de datos.' });
  }

  const duplicadosConId = duplicados.filter((p) => p.id);
  const idsPresentesBase = new Set([
    ...actualizables.map((fila) => fila.id),
    ...duplicadosConId.map((fila) => fila.id),
  ]);

  const borrarJugadoresDesaparecidos = async (idsNuevos = []) => {
    // Si hay filas invalidas, no sabemos si faltan datos por un error de
    // formato o porque se han borrado realmente. Conservamos la base de datos
    // y lo dejamos reflejado en el resultado para evitar perdidas de datos.
    if (omitidas.length > 0) return;

    const idsPresentes = new Set([...idsPresentesBase, ...idsNuevos]);

    try {
      const { data: jugadoresActivos, error: fetchError } = await supabaseAdmin
        .from('jugadores')
        .select('id, foto_path, sheet_row_hash')
        .eq('club', club);

      if (fetchError) throw fetchError;

      const jugadoresParaBorrar = (jugadoresActivos || []).filter((jugador) => !idsPresentes.has(jugador.id));

      if (jugadoresParaBorrar.length === 0) {
        return;
      }

      const resultadoBorrado = await borrarJugadoresYFotos(jugadoresParaBorrar, club);
      borrados += resultadoBorrado.borrados;
      fotosBorradas += resultadoBorrado.fotos_borradas;
    } catch (err) {
      console.error('Error borrando jugadores desaparecidos del Sheet:', err.message);
      throw new Error('No se pudieron borrar los jugadores que ya no estan en la hoja.');
    }
  };

  if (insertables.length === 0) {
    if (duplicadosConId.length > 0) {
      try {
        await sheetsSync.marcarComoSincronizadas(sheets, tabTitle, idxIdSync, duplicadosConId, club);
      } catch (err) {
        console.warn('No se pudo marcar ID_SYNC en filas ya existentes:', err.message);
      }
    }

    try {
      await borrarJugadoresDesaparecidos();
    } catch (err) {
      return res.status(503).json({ error: err.message });
    }

    const hojaResultado = await empujarSupabaseAHoja();
    return res.json(
      respuestaSync(
        {
          insertados: 0,
          actualizados,
          sin_cambios: sinCambios,
          supabase_ganadores: supabaseGanadores,
          conflictos,
          no_encontrados: noEncontrados,
          duplicados: duplicados.length,
          omitidos: omitidas.length,
          total_pendientes: pendientes.length,
          borrados,
          fotos_borradas: fotosBorradas,
          omisiones_por_motivo: omisionesPorMotivo,
        },
        hojaResultado
      )
    );
  }

  const { data: insertados, error: insertError } = await supabaseAdmin
    .from('jugadores')
    .insert(insertables.map((p) => ({ ...p.datos, club })))
    .select('id');

  if (insertError) {
    console.error('Error insertando jugadores desde Sheets:', insertError.message);
    return res.status(503).json({ error: 'No se pudieron guardar los jugadores en la base de datos.' });
  }

  try {
    const filasConId = insertables.map((p, i) => ({ numeroFila: p.numeroFila, id: insertados[i].id }));
    duplicadosConId.forEach((p) => filasConId.push({ numeroFila: p.numeroFila, id: p.id }));
    await sheetsSync.marcarComoSincronizadas(sheets, tabTitle, idxIdSync, filasConId, club);
  } catch (err) {
    // Los jugadores ya se han insertado; si falla solo el marcado en el Sheet,
    // avisamos pero no lo tratamos como fallo total (evita duplicados se
    // reintentaria manualmente revisando el Sheet).
    console.error('Jugadores insertados pero no se pudo marcar ID_SYNC en el Sheet:', err.message);
    const hojaResultado = await empujarSupabaseAHoja();
    return res.json(
      respuestaSync(
        {
          insertados: insertados.length,
          actualizados,
          sin_cambios: sinCambios,
          supabase_ganadores: supabaseGanadores,
          conflictos,
          no_encontrados: noEncontrados,
          duplicados: duplicados.length,
          omitidos: omitidas.length,
          borrados,
          fotos_borradas: fotosBorradas,
          omisiones_por_motivo: omisionesPorMotivo,
          aviso: 'Se importaron los jugadores pero no se pudo marcar la hoja como sincronizada. Revisa el Sheet manualmente.',
        },
        hojaResultado
      )
    );
  }

  try {
    await borrarJugadoresDesaparecidos(insertados.map((item) => item.id));
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  const hojaResultado = await empujarSupabaseAHoja();
  res.json(
    respuestaSync(
      {
        insertados: insertados.length,
        actualizados,
        sin_cambios: sinCambios,
        supabase_ganadores: supabaseGanadores,
        conflictos,
        no_encontrados: noEncontrados,
        duplicados: duplicados.length,
        omitidos: omitidas.length,
        borrados,
        fotos_borradas: fotosBorradas,
        omisiones_por_motivo: omisionesPorMotivo,
      },
      hojaResultado
    )
  );
});

module.exports = router;
