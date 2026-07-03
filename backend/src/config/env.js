require('dotenv').config();

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
  // responde 503 en vez de tumbar el arranque del backend.
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
    gid: process.env.GOOGLE_SHEETS_GID || null,
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null,
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || null,
  },
};
