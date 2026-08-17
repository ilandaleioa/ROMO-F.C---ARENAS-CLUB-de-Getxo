const env = require('../config/env');
const { verifySessionToken } = require('../lib/session');

// Bloquea cualquier acceso a datos o pantallas protegidas sin sesion valida.
function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[env.sessionCookieName] : null;

  if (!token) {
    return res.status(401).json({ error: 'No hay sesion activa. Inicia sesion de nuevo.' });
  }

  try {
    const payload = verifySessionToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      rol: payload.rol,
      equipo_asignado: payload.equipo_asignado,
      club: payload.club,
      apartados_visibles: payload.apartados_visibles,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesion expirada o invalida. Inicia sesion de nuevo.' });
  }
}

module.exports = requireAuth;
