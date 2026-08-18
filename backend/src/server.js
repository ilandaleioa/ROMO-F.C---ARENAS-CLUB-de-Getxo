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

  process.exitCode = 1;
});
