const express = require('express');
const bcrypt = require('bcryptjs');
const supabaseAdmin = require('../config/supabaseClient');
const { createSessionToken, setSessionCookie, clearSessionCookie } = require('../lib/session');
const requireAuth = require('../middleware/requireAuth');
const { ALL_ROLES } = require('../config/roles');
const { construirSelect, ejecutarConFallback } = require('../lib/usuarioColumns');

const router = express.Router();
const RETRY_DELAY_MS = 250;
const CAMPOS_LOGIN_BASE = ['id', 'username', 'password_hash', 'rol', 'equipo_asignado', 'club', 'activo'];
const CAMPOS_LOGIN_OPCIONALES = ['apartados_visibles'];

async function consultarUsuarioLogin(username) {
  // El login solo necesita los campos imprescindibles. `apartados_visibles`
  // es opcional en algunas bases ya desplegadas y no debe bloquear la entrada.
  return ejecutarConFallback(CAMPOS_LOGIN_OPCIONALES, (omitidas) =>
    supabaseAdmin
      .from('usuarios')
      .select(construirSelect(CAMPOS_LOGIN_BASE, CAMPOS_LOGIN_OPCIONALES, omitidas))
      .eq('username', username)
      .maybeSingle(),
  );
}

function esErrorDeConexion(err) {
  const mensaje = String(err?.message || '').toLowerCase();
  const causaMensaje = String(err?.cause?.message || '').toLowerCase();
  const causaCodigo = String(err?.cause?.code || err?.code || '').toUpperCase();

  return (
    mensaje.includes('fetch failed') ||
    mensaje.includes('network') ||
    causaMensaje.includes('fetch failed') ||
    ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(causaCodigo)
  );
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function consultarUsuarioLoginConReintento(username, intentos = 2) {
  let ultimoError = null;

  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      return await consultarUsuarioLogin(username);
    } catch (err) {
      ultimoError = err;

      if (!esErrorDeConexion(err) || intento === intentos) {
        throw err;
      }

      console.warn(
        `[auth/login] Fallo de conexion al consultar usuarios, reintentando (${intento}/${intentos}):`,
        err?.cause?.code || err?.code || err?.message || err
      );
      await esperar(RETRY_DELAY_MS * intento);
    }
  }

  throw ultimoError;
}

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Usuario y contrasena son obligatorios.' });
  }

  let data;
  try {
    const result = await consultarUsuarioLoginConReintento(username);

    if (result.error) throw result.error;
    data = result.data;
  } catch (err) {
    const causa = err?.cause?.code || err?.cause?.message || err?.code || err?.message || err;
    console.error('[auth/login] Error al consultar la base de datos:', causa);

    if (esErrorDeConexion(err)) {
      return res.status(503).json({
        error: 'No se pudo conectar con Supabase. Revisa SUPABASE_URL, la service role key y el acceso de red del despliegue.',
      });
    }

    return res.status(503).json({ error: 'No se pudo consultar la base de datos. Intentalo de nuevo mas tarde.' });
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
      id: data.id,
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
      id: req.user.id,
      username: req.user.username,
      rol: req.user.rol,
      equipo_asignado: req.user.equipo_asignado || null,
      club: req.user.club || null,
      apartados_visibles: req.user.apartados_visibles || null,
    },
  });
});

module.exports = router;
