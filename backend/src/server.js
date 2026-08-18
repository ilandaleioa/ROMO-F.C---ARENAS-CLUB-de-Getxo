const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`ROMO FC - ARENAS backend escuchando en http://localhost:${env.port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`No se puede iniciar el backend: el puerto ${env.port} ya esta en uso.`);
  } else {
    console.error('No se puede iniciar el backend:', error);
  }

  // Si el servidor no puede arrancar, salimos de inmediato para evitar que
  // `node --watch` se quede en un estado ambiguo con procesos duplicados.
  process.exit(1);
});
