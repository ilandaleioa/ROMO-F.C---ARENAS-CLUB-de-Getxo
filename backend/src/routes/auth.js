const express = require('express');
const bcrypt = require('bcryptjs');
const supabaseAdmin = require('../config/supabaseClient');
const { createSessionToken, setSessionCookie, clearSessionCookie } = require('../lib/session');
const requireAuth = require('../middleware/requireAuth');
const { ALL_ROLES } = require('../config/roles');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Usuario y contrasena son obligatorios.' });
  }

  let data;
  try {
    const result = await supabaseAdmin
      .from('usuarios')
      .select('id, username, password_hash, rol, equipo_asignado, club, activo')
      .eq('username', username)
      .maybeSingle();

    if (result.error) throw result.error;
    data = result.data;
  } catch (err) {
    return res.status(503).json({ error: 'No se pudo conectar con la base de datos. Intentalo de nuevo mas tarde.' });
  }

  // Respuesta identica si el usuario no existe o la contrasena es incorrecta,
  // para no revelar si un username existe.
  const genericError = () => res.status(401).json({ error: 'Usuario o contrasena incorrectos.' });

  if (!data || !ALL_ROLES.includes(data.rol) || data.activo === false) {
    return genericError();
  }

  const passwordOk = await bcrypt.compare(password, data.password_hash);
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
    },
  });
});

module.exports = router;
