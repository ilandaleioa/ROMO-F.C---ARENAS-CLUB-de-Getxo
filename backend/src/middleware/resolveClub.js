const { CLUBES, CLUB_POR_DEFECTO, CLUB_TODOS } = require('../config/clubs');

// El club activo lo elige el usuario en el frontend (botones ROMO FC /
// ARENAS CLUB) y viaja en la cabecera X-Club en cada peticion. Nunca se
// confia en valores fuera de la whitelist; si falta o es invalido, se usa
// el club por defecto en vez de fallar la peticion.
//
// Si el usuario autenticado tiene un club asignado distinto de TODOS, ese
// club manda siempre, ignorando la cabecera: evita que un usuario con acceso
// solo a ROMO pueda leer/escribir datos de ARENAS manipulando la peticion.
function resolveClub(req, res, next) {
  const clubUsuario = req.user?.club;
  if (clubUsuario && clubUsuario !== CLUB_TODOS) {
    req.club = clubUsuario;
    return next();
  }

  const valor = String(req.headers['x-club'] || '').trim().toUpperCase();
  req.club = CLUBES.includes(valor) ? valor : CLUB_POR_DEFECTO;
  next();
}

module.exports = resolveClub;
