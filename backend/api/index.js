let app;

try {
  app = require('../src/app');
} catch (err) {
  console.error('[api/index] No se pudo inicializar el backend:', err.message || err);

  module.exports = (req, res) => {
    const message = err?.message
      ? `No se pudo inicializar el backend: ${err.message}`
      : 'No se pudo inicializar el backend. Revisa las variables de entorno de Vercel y que la API este desplegada.';

    res.status(500).json({
      error: message,
    });
  };

  return;
}

module.exports = app;
