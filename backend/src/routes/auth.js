const express = require('express');
const bcrypt = require('bcryptjs');
const supabaseAdmin = require('../config/supabaseClient');
const { createSessionToken, setSessionCookie, clearSessionCookie } = require('../lib/session');
const requireAuth = require('../middleware/requireAuth');
const { ALL_ROLES } = require('../config/roles');

const router = express.Router();

function esColumnaInexistente(error, columna) {
  const mensaje = String(error?.message || error?.details || '').toLowerCase();
  return mensaje.includes(`column usuarios.${columna.toLowerCase()} does not exist`)
    || mensaje.includes(`column "${columna.toLowerCase()}" does not exist`)
    || mensaje.includes(`column '${columna.toLowerCase()}' does not exist`);
}

async function consultarUsuarioLogin(username) {
  const selectConApartados = 'id, username, password_hash, rol, equipo_asignado, club, apartados_visibles, activo';
  const selectBase = 'id, username, password_hash, rol, equipo_asignado, club, activo';

  const consulta = () => supabaseAdmin.from('usuarios').select(selectConApartados).eq('username', username).maybeSingle();
  const resultado = await consulta();

  if (!resultado.error || !esColumnaInexistente(resultado.error, 'apartados_visibles')) {
    return resultado;
  }

  return supabaseAdmin.from('usuarios').select(selectBase).eq('username', username).maybeSingle();
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Usuario y contrasena son obligatorios.' });
  }

  let data;
  try {
    const result = await consultarUsuarioLogin(username);

    if (result.error) throw result.error;
    data = result.data;
  } catch (err) {
    console.error('[auth/login] Error al consultar la base de datos:', err.message || err);
    return res.status(503).json({ error: 'No se pudo conectar con la base de datos. Intentalo de nuevo mas tarde.' });
  }

  // Respuesta identica si el usuario no existe o la contrasena es incorrecta,
  // para no revelar si un username existe.
  const genericError = () => res.status(401).json({ error: 'Usuario o contrasena incorrectos.' });

  if (!data || !ALL_ROLES.includes(data.rol) || data.activo === false) {
    return genericError();
  }

  if (!data.password_hash || typeof data.password_hash !== 'string') {
    console.error('[auth/login] El usuario no tiene password_hash valido:', data.username);
    return res.status(503).json({ error: 'El usuario no tiene una contrasena valida configurada. Contacta con administracion.' });
  }

  let passwordOk = false;
  try {
    passwordOk = await bcrypt.compare(password, data.password_hash);
  } catch (err) {
    console.error('[auth/login] Error al validar la contrasena:', err.message || err);
    return res.status(503).json({ error: 'No se pudo validar la contrasena. Intentalo de nuevo mas tarde.' });
  }
  if (!passwordOk) {
    return genericError();
  }

  const token = createSessionToken(data);
  setSessionCookie(res, token);

  return res.json({
    user: {
      username: data.username,
      rol: data.rol,
      equipo_asignado: data.equipo_asignado || null,
      club: data.club || null,
      apartados_visibles: data.apartados_visibles || null,
    },
  });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      username: req.user.username,
      rol: req.user.rol,
      equipo_asignado: req.user.equipo_asignado || null,
      club: req.user.club || null,
      apartados_visibles: req.user.apartados_visibles || null,
    },
  });
});

module.exports = router;
