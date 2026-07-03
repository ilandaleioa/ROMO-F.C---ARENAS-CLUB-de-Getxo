const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');

const authRoutes = require('./routes/auth');
const jugadoresRoutes = require('./routes/jugadores');
const usuariosRoutes = require('./routes/usuarios');
const campogramasRoutes = require('./routes/campogramas');

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/jugadores', jugadoresRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/campogramas', campogramasRoutes);

// Manejador de errores generico: nunca exponer detalles internos ni datos sensibles.
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.' });
});

module.exports = app;
