const express = require('express');
const bcrypt = require('bcryptjs');
const supabaseAdmin = require('../config/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { ROLES, ALL_ROLES } = require('../config/roles');
const { CLUBES_USUARIO } = require('../config/clubs');
const { parseEquiposAsignados, serializeEquiposAsignados } = require('../lib/equiposAsignados');

const router = express.Router();

// Pantalla y endpoints exclusivos de Administrador y Director.
router.use(requireAuth, requireRole(ROLES.ADMINISTRADOR, ROLES.DIRECTOR));

const PUBLIC_USER_FIELDS = 'id, username, rol, equipo_asignado, club, activo, creado_en';

router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select(PUBLIC_USER_FIELDS)
    .order('username', { ascending: true });

  if (error) {
    return res.status(503).json({ error: 'No se pudo consultar la base de datos de usuarios.' });
  }
  res.json({ usuarios: data || [] });
});

function validarPayload(body, { requierePassword }) {
  const { username, password, rol, equipo_asignado, club } = body || {};

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return 'El nombre de usuario es obligatorio (minimo 3 caracteres).';
  }
  if (!ALL_ROLES.includes(rol)) {
    return 'El rol no es valido.';
  }
  if (equipo_asignado !== undefined && equipo_asignado !== null && typeof equipo_asignado !== 'string' && !Array.isArray(equipo_asignado)) {
    return 'El campo Equipo no es valido.';
  }
  if (!CLUBES_USUARIO.includes(club)) {
    return 'El club no es valido.';
  }
  if (requierePassword && (!password || typeof password !== 'string' || password.length < 8)) {
    return 'La contrasena es obligatoria (minimo 8 caracteres).';
  }
  if (password && (typeof password !== 'string' || password.length < 8)) {
    return 'La contrasena debe tener al menos 8 caracteres.';
  }
  return null;
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
  const error = validarPayload(req.body, { requierePassword: true });
  if (error) return res.status(400).json({ error });
  const errorAlcance = validarAlcanceEquipos(req.user, req.body.equipo_asignado);
  if (errorAlcance) return res.status(403).json({ error: errorAlcance });

  const { username, password, rol, equipo_asignado, club, activo } = req.body;
  const password_hash = await bcrypt.hash(password, 12);

  const { data, error: dbError } = await supabaseAdmin
    .from('usuarios')
    .insert({
      username: username.trim(),
      password_hash,
      rol,
      equipo_asignado: serializeEquiposAsignados(equipo_asignado),
      club,
      activo: activo !== false,
    })
    .select(PUBLIC_USER_FIELDS)
    .single();

  if (dbError) {
    if (dbError.code === '23505') {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
    }
    return res.status(503).json({ error: 'No se pudo crear el usuario.' });
  }

  res.status(201).json({ usuario: data });
});

router.put('/:id', async (req, res) => {
  const error = validarPayload(req.body, { requierePassword: false });
  if (error) return res.status(400).json({ error });
  const errorAlcance = validarAlcanceEquipos(req.user, req.body.equipo_asignado);
  if (errorAlcance) return res.status(403).json({ error: errorAlcance });

  const { username, password, rol, equipo_asignado, club, activo } = req.body;

  const update = {
    username: username.trim(),
    rol,
    equipo_asignado: serializeEquiposAsignados(equipo_asignado),
    club,
    activo: activo !== false,
  };

  if (password) {
    update.password_hash = await bcrypt.hash(password, 12);
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('usuarios')
    .update(update)
    .eq('id', req.params.id)
    .select(PUBLIC_USER_FIELDS)
    .maybeSingle();

  if (dbError) {
    if (dbError.code === '23505') {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
    }
    return res.status(503).json({ error: 'No se pudo actualizar el usuario.' });
  }
  if (!data) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  res.json({ usuario: data });
});

router.delete('/:id', async (req, res) => {
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
});

module.exports = router;
