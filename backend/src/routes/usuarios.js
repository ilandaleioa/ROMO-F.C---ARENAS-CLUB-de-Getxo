const express = require('express');
const bcrypt = require('bcryptjs');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { ROLES, ALL_ROLES } = require('../config/roles');
const { CLUBES_USUARIO } = require('../config/clubs');
const { parseEquiposAsignados, serializeEquiposAsignados } = require('../lib/equiposAsignados');
const { construirSelect, omitirCampos, ejecutarConFallback } = require('../lib/usuarioColumns');
const {
  parseApartadosVisibles,
  serializeApartadosVisibles,
  validarApartadosVisibles,
} = require('../config/apartados');

const router = express.Router();

// Pantalla y endpoints exclusivos de Administrador y Director.
router.use(requireAuth, requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR));

const PUBLIC_USER_FIELDS_BASE = ['id', 'username', 'rol', 'equipo_asignado'];
const PUBLIC_USER_OPTIONAL_FIELDS = ['club', 'apartados_visibles', 'activo', 'creado_en'];

function normalizarUsuario(usuario) {
  if (!usuario) return usuario;
  const normalizado = {
    ...usuario,
    equipo_asignado: usuario.equipo_asignado || null,
    club: usuario.club || null,
  };

  // No inventamos esta propiedad cuando la base de datos es antigua y aun no
  // tiene la columna. El frontend usa su ausencia para no intentar guardar un
  // campo que el esquema no puede persistir.
  if (Object.prototype.hasOwnProperty.call(usuario, 'apartados_visibles')) {
    normalizado.apartados_visibles = usuario.apartados_visibles || null;
  }

  return normalizado;
}

async function consultarUsuariosPublicos() {
  return ejecutarConFallback(PUBLIC_USER_OPTIONAL_FIELDS, (omitidas) => {
    const select = construirSelect(PUBLIC_USER_FIELDS_BASE, PUBLIC_USER_OPTIONAL_FIELDS, omitidas);
    return supabaseAdmin.from('usuarios').select(select).order('username', { ascending: true });
  });
}

async function insertarUsuarioConFallback(payload) {
  return ejecutarConFallback(PUBLIC_USER_OPTIONAL_FIELDS, (omitidas) => {
    const payloadAjustado = omitirCampos(payload, PUBLIC_USER_OPTIONAL_FIELDS, omitidas);
    const select = construirSelect(PUBLIC_USER_FIELDS_BASE, PUBLIC_USER_OPTIONAL_FIELDS, omitidas);
    return supabaseAdmin.from('usuarios').insert(payloadAjustado).select(select).single();
  });
}

async function actualizarUsuarioConFallback(id, payload) {
  // Solo pedimos en la respuesta las columnas opcionales que forman parte de
  // esta mutacion. Asi una edicion compatible con esquemas antiguos no falla
  // por una columna opcional que ni siquiera se esta modificando.
  const camposOpcionalesDeLaMutacion = PUBLIC_USER_OPTIONAL_FIELDS.filter((campo) =>
    Object.prototype.hasOwnProperty.call(payload, campo),
  );

  return ejecutarConFallback(camposOpcionalesDeLaMutacion, (omitidas) => {
    const payloadAjustado = omitirCampos(payload, PUBLIC_USER_OPTIONAL_FIELDS, omitidas);
    const select = construirSelect(PUBLIC_USER_FIELDS_BASE, camposOpcionalesDeLaMutacion, omitidas);
    return supabaseAdmin.from('usuarios').update(payloadAjustado).eq('id', id).select(select).maybeSingle();
  });
}

router.get('/', async (req, res) => {
  try {
    const { data, error } = await consultarUsuariosPublicos();

    if (error) {
      return res.status(503).json({ error: 'No se pudo consultar la base de datos de usuarios.' });
    }
    res.json({ usuarios: (data || []).map(normalizarUsuario) });
  } catch (err) {
    console.error('Error inesperado al listar usuarios:', err);
    return res.status(503).json({ error: 'No se pudo consultar la base de datos de usuarios.' });
  }
});

function validarPayload(body, { requierePassword }) {
  const { username, password, rol, equipo_asignado, apartados_visibles, club } = body || {};

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return 'El nombre de usuario es obligatorio (minimo 3 caracteres).';
  }
  if (!ALL_ROLES.includes(rol)) {
    return 'El rol no es valido.';
  }
  if (equipo_asignado !== undefined && equipo_asignado !== null && typeof equipo_asignado !== 'string' && !Array.isArray(equipo_asignado)) {
    return 'El campo Equipo no es valido.';
  }
  if (
    apartados_visibles !== undefined &&
    apartados_visibles !== null &&
    typeof apartados_visibles !== 'string' &&
    !Array.isArray(apartados_visibles)
  ) {
    return 'El campo Apartados visibles no es valido.';
  }
  if (!CLUBES_USUARIO.includes(club)) {
    return 'El club no es valido.';
  }
  const errorApartados = validarApartadosVisibles(apartados_visibles);
  if (errorApartados) {
    return errorApartados;
  }
  if (requierePassword && (!password || typeof password !== 'string' || password.length < 8)) {
    return 'La contrasena es obligatoria (minimo 8 caracteres).';
  }
  if (password && (typeof password !== 'string' || password.length < 8)) {
    return 'La contrasena debe tener al menos 8 caracteres.';
  }
  return null;
}

function normalizarApartadosVisibles(valor) {
  const apartados = parseApartadosVisibles(valor);
  return apartados.length > 0 ? serializeApartadosVisibles(apartados) : 'Todos';
}

function validarAlcanceEquipos(actor, equipoAsignado) {
  const equiposActor = parseEquiposAsignados(actor?.equipo_asignado);
  if (equiposActor.length === 0) return null;

  const equiposUsuario = parseEquiposAsignados(equipoAsignado);
  if (equiposUsuario.length === 0) {
    return 'No puedes dar acceso a todos los equipos porque tu usuario esta limitado.';
  }

  const permitidos = new Set(equiposActor);
  const equipoNoPermitido = equiposUsuario.find((eq) => !permitidos.has(eq));
  if (equipoNoPermitido) {
    return `No puedes dar acceso al equipo "${equipoNoPermitido}".`;
  }

  return null;
}

router.post('/', async (req, res) => {
  try {
    const error = validarPayload(req.body, { requierePassword: true });
    if (error) return res.status(400).json({ error });
    const errorAlcance = validarAlcanceEquipos(req.user, req.body.equipo_asignado);
    if (errorAlcance) return res.status(403).json({ error: errorAlcance });

    const { username, password, rol, equipo_asignado, apartados_visibles, club, activo } = req.body;
    const password_hash = await bcrypt.hash(password, 12);

    const { data, error: dbError } = await insertarUsuarioConFallback({
      username: username.trim(),
      password_hash,
      rol,
      equipo_asignado: serializeEquiposAsignados(equipo_asignado),
      apartados_visibles: normalizarApartadosVisibles(apartados_visibles),
      club,
      activo: activo !== false,
    });

    if (dbError) {
      if (dbError.code === '23505') {
        return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
      }
      return res.status(503).json({ error: 'No se pudo crear el usuario.' });
    }

    res.status(201).json({ usuario: normalizarUsuario(data) });
  } catch (err) {
    console.error('Error inesperado creando usuario:', err);
    return res.status(503).json({ error: 'No se pudo crear el usuario.' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const error = validarPayload(req.body, { requierePassword: false });
    if (error) return res.status(400).json({ error });
    const errorAlcance = validarAlcanceEquipos(req.user, req.body.equipo_asignado);
    if (errorAlcance) return res.status(403).json({ error: errorAlcance });

    const { username, password, rol, equipo_asignado, apartados_visibles, club, activo } = req.body;

    const update = {
      username: username.trim(),
      rol,
      equipo_asignado: serializeEquiposAsignados(equipo_asignado),
      apartados_visibles: normalizarApartadosVisibles(apartados_visibles),
      club,
      activo: activo !== false,
    };

    if (password) {
      update.password_hash = await bcrypt.hash(password, 12);
    }

    const { data, error: dbError } = await actualizarUsuarioConFallback(req.params.id, update);

    if (dbError) {
      console.error('[usuarios/PUT] Error de base de datos:', {
        id: req.params.id,
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
      });
      if (dbError.code === '23505') {
        return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
      }
      return res.status(503).json({ error: 'No se pudo actualizar el usuario.' });
    }
    if (!data) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({ usuario: normalizarUsuario(data) });
  } catch (err) {
    console.error('Error inesperado actualizando usuario:', err);
    return res.status(503).json({ error: 'No se pudo actualizar el usuario.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
    }

    const { error, count } = await supabaseAdmin
      .from('usuarios')
      .delete({ count: 'exact' })
      .eq('id', req.params.id);

    if (error) {
      return res.status(503).json({ error: 'No se pudo eliminar el usuario.' });
    }
    if (!count) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Error inesperado eliminando usuario:', err);
    return res.status(503).json({ error: 'No se pudo eliminar el usuario.' });
  }
});

module.exports = router;
