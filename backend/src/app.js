const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');

const authRoutes = require('./routes/auth');
const jugadoresRoutes = require('./routes/jugadores');
const usuariosRoutes = require('./routes/usuarios');
const campogramasRoutes = require('./routes/campogramas');
const configRoutes = require('./routes/config');
const captacionRoutes = require('./routes/captacion');
const personalRoutes = require('./routes/personal');
const competicionesRoutes = require('./routes/competiciones');
const actividadesRoutes = require('./routes/actividades');

const app = express();

function isAllowedOrigin(origin) {
  if (!origin) return true;

  if (env.frontendOrigin && origin === env.frontendOrigin) {
    return true;
  }

  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    if (hostname.endsWith('.vercel.app')) {
      return true;
    }

    if (env.isProduction && process.env.VERCEL_URL) {
      return origin === `https://${process.env.VERCEL_URL}`;
    }
  } catch (_) {
    return false;
  }

  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  })
);
// La ficha de captacion puede incluir fotos en data URL, asi que subimos el
// limite del body para evitar que una imagen provoque un 500 al guardar.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON malformado en la solicitud.' });
  }

  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({
      error: 'El contenido enviado es demasiado grande. Reduce el tamano de la foto e intenta de nuevo.',
    });
  }

  return next(err);
});
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Si alguien abre el backend en el navegador, lo mandamos al frontend.
// En desarrollo el frontend vive en Vite; en produccion esto apunta a la URL publica.
app.get('/', (req, res) => {
  res.redirect(302, env.frontendOrigin);
});

app.use('/api/auth', authRoutes);
app.use('/api/jugadores', jugadoresRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/campogramas', campogramasRoutes);
app.use('/api/config', configRoutes);
app.use('/api/captacion', captacionRoutes);
app.use('/api/personal', personalRoutes);
app.use('/api/competiciones', competicionesRoutes);
app.use('/api/actividades', actividadesRoutes);

// Manejador de errores generico: nunca exponer detalles internos ni datos sensibles.
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.' });
});

module.exports = app;
