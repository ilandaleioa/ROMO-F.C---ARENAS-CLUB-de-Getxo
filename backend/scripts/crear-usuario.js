// Script CLI para dar de alta (o resetear la contrasena de) un usuario de la app.
// Uso:
//   node scripts/crear-usuario.js <username> <password> <rol> [equipo_asignado] [club]
// rol: administrador | responsable | tecnico
// club: ROMO | ARENAS | TODOS (por defecto TODOS)
// Requiere las variables de entorno de backend/.env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

require('dotenv').config();
const bcrypt = require('bcryptjs');
const supabaseAdmin = require('../src/config/supabaseClient');
const { ALL_ROLES, ROLES } = require('../src/config/roles');
const { CLUBES_USUARIO, CLUB_TODOS } = require('../src/config/clubs');

async function main() {
  const [username, password, rol, equipo_asignado, clubArg] = process.argv.slice(2);
  const club = clubArg ? clubArg.toUpperCase() : CLUB_TODOS;

  if (!username || !password || !rol) {
    console.error('Uso: node scripts/crear-usuario.js <username> <password> <rol> [equipo_asignado] [club]');
    console.error(`Roles validos: ${ALL_ROLES.join(', ')}`);
    console.error(`Clubes validos: ${CLUBES_USUARIO.join(', ')}`);
    process.exit(1);
  }
  if (!ALL_ROLES.includes(rol)) {
    console.error(`Rol invalido. Roles validos: ${ALL_ROLES.join(', ')}`);
    process.exit(1);
  }
  if (rol === ROLES.TECNICO && !equipo_asignado) {
    console.error('Los usuarios con rol "tecnico" necesitan un equipo_asignado.');
    process.exit(1);
  }
  if (!CLUBES_USUARIO.includes(club)) {
    console.error(`Club invalido. Clubes validos: ${CLUBES_USUARIO.join(', ')}`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('La contrasena debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .upsert(
      {
        username,
        password_hash,
        rol,
        equipo_asignado: rol === ROLES.TECNICO ? equipo_asignado : null,
        club,
        activo: true,
      },
      { onConflict: 'username' }
    )
    .select('id, username, rol, equipo_asignado, club')
    .single();

  if (error) {
    console.error('Error al crear/actualizar el usuario:', error.message);
    process.exit(1);
  }

  console.log('Usuario guardado correctamente:');
  console.log(data);
}

main();
