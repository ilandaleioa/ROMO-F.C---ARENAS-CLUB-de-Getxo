const jwt = require('jsonwebtoken');
const env = require('../config/env');

const SESSION_TTL = '8h';

function createSessionToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      rol: user.rol,
      equipo_asignado: user.equipo_asignado || null,
      club: user.club || null,
      apartados_visibles: user.apartados_visibles || null,
    },
    env.sessionSecret,
    { expiresIn: SESSION_TTL }
  );
}

function verifySessionToken(token) {
  return jwt.verify(token, env.sessionSecret);
}

function setSessionCookie(res, token) {
  res.cookie(env.sessionCookieName, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(env.sessionCookieName, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
  });
}

module.exports = {
  createSessionToken,
  verifySessionToken,
  setSessionCookie,
  clearSessionCookie,
};
