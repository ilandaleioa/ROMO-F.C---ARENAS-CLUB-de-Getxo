const CLUBES = ['ROMO', 'ARENAS'];
const CLUB_POR_DEFECTO = 'ROMO';
const CLUB_TODOS = 'TODOS';

// Valores validos para el campo "club" de un usuario: uno de los clubes o
// TODOS (acceso a ambos).
const CLUBES_USUARIO = [...CLUBES, CLUB_TODOS];

module.exports = { CLUBES, CLUB_POR_DEFECTO, CLUB_TODOS, CLUBES_USUARIO };
