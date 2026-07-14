const path = require('path');
const dotenv = require('dotenv');

// Cargamos explícitamente `backend/.env` para que el backend funcione igual si
// se arranca desde `backend/`, desde la raíz del repo o dentro de una función
// serverless. Si no existe el archivo, dotenv simplemente no altera nada.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable de entorno obligatoria: ${name}`);
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  return value;
}

module.exports = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  sessionSecret: required('SESSION_SECRET'),
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'romofc_session',
  port: parseInt(process.env.PORT || '4000', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  isProduction: process.env.NODE_ENV === 'production',
  // Opcionales: si faltan, el endpoint de sincronizacion con Google Sheets
  // responde 503 en vez de tumbar el arranque del backend. Mismo service
  // account para los dos clubes (hay que compartirle ambas hojas); solo
  // cambia el spreadsheet/pestana segun el club activo.
  googleServiceAccount: {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null,
    // La clave privada se pega en el panel de variables de entorno como texto de
    // una sola linea; los saltos de linea reales del PEM llegan como "\n"
    // literales y hay que convertirlos, o el decodificador de Node falla con
    // "error:1E08010C:DECODER routines::unsupported". Tambien quitamos comillas
    // envolventes por si se pego el valor JSON completo (con comillas incluidas)
    // en vez de solo el contenido de "private_key".
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
      ? process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.trim()
          .replace(/^"|"$/g, '')
          .replace(/\\n/g, '\n')
      : null,
  },
  googleSheetsPorClub: {
    ROMO: {
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
      gid: process.env.GOOGLE_SHEETS_GID || null,
    },
    ARENAS: {
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID_ARENAS || null,
      gid: process.env.GOOGLE_SHEETS_GID_ARENAS || null,
    },
  },
};
