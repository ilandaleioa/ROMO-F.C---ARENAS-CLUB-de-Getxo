const express = require('express');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const resolveClub = require('../middleware/resolveClub');
const { ROLES } = require('../config/roles');
const tecnicosSheetsSync = require('../config/tecnicosSheetsSync');

const router = express.Router();

router.use(requireAuth);
router.use(resolveClub);

function esTablaInexistente(error) {
  const texto = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
  return error?.code === '42P01' || error?.code === 'PGRST205' || /could not find the table|does not exist|no existe/i.test(texto);
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

    res.json({ tecnicos: data || [] });
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
      .select('id, dni, nombre, primer_apellido')
      .eq('club', club);

    if (fetchError) throw fetchError;

    const existentePorDni = new Map();
    const existentePorNombre = new Map();
    (existentes || []).forEach((row) => {
      if (row.dni) existentePorDni.set(row.dni.trim().toUpperCase(), row);
      existentePorNombre.set(`${row.nombre}|${row.primer_apellido}`.trim().toUpperCase(), row);
    });

    const clavesVistas = new Set();
    let insertados = 0;
    let actualizados = 0;

    for (const datos of validas) {
      const registro = { ...datos, club };
      const claveDni = registro.dni ? registro.dni.trim().toUpperCase() : null;
      const claveNombre = `${registro.nombre}|${registro.primer_apellido}`.trim().toUpperCase();
      const existente = (claveDni && existentePorDni.get(claveDni)) || existentePorNombre.get(claveNombre);

      if (existente) {
        clavesVistas.add(existente.id);
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
      }
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

module.exports = router;
