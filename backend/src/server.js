const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`ROMO FC - ARENAS backend escuchando en http://localhost:${env.port}`);
});
