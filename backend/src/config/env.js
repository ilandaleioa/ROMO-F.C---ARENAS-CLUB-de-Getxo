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

function cleanEnvValue(value, { stripWhitespace = false } = {}) {
  if (!value) return value;

  let cleaned = String(value).trim().replace(/^"|"$/g, '');
  if (stripWhitespace) {
    cleaned = cleaned.replace(/\s+/g, '');
  }

  return cleaned;
}

module.exports = {
  supabaseUrl: cleanEnvValue(required('SUPABASE_URL')),
  supabaseServiceRoleKey: cleanEnvValue(required('SUPABASE_SERVICE_ROLE_KEY'), { stripWhitespace: true }),
  sessionSecret: cleanEnvValue(required('SESSION_SECRET')),
  sessionCookieName: cleanEnvValue(process.env.SESSION_COOKIE_NAME) || 'romofc_session',
  port: parseInt(cleanEnvValue(process.env.PORT) || '4000', 10),
  frontendOrigin: cleanEnvValue(process.env.FRONTEND_ORIGIN) || 'http://localhost:5173',
  isProduction: cleanEnvValue(process.env.NODE_ENV) === 'production',
  // Opcionales: si faltan, el endpoint de sincronizacion con Google Sheets
  // responde 503 en vez de tumbar el arranque del backend. Mismo service
  // account para los dos clubes (hay que compartirle ambas hojas); solo
  // cambia el spreadsheet/pestana segun el club activo.
  googleServiceAccount: {
    email: cleanEnvValue(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) || null,
    // La clave privada se pega en el panel de variables de entorno como texto de
    // una sola linea; los saltos de linea reales del PEM llegan como "\n"
    // literales y hay que convertirlos, o el decodificador de Node falla con
    // "error:1E08010C:DECODER routines::unsupported". Tambien quitamos comillas
    // envolventes por si se pego el valor JSON completo (con comillas incluidas)
    // en vez de solo el contenido de "private_key".
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
      ? cleanEnvValue(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
          .replace(/^"|"$/g, '')
          .replace(/\\n/g, '\n')
      : null,
  },
  googleApiKey: cleanEnvValue(process.env.GOOGLE_API_KEY) || null,
  googleSheetsPorClub: {
    ROMO: {
      spreadsheetId: cleanEnvValue(process.env.GOOGLE_SHEETS_SPREADSHEET_ID) || null,
      gid: cleanEnvValue(process.env.GOOGLE_SHEETS_GID) || null,
    },
    ARENAS: {
      spreadsheetId: cleanEnvValue(process.env.GOOGLE_SHEETS_SPREADSHEET_ID_ARENAS) || null,
      gid: cleanEnvValue(process.env.GOOGLE_SHEETS_GID_ARENAS) || null,
    },
  },
};
