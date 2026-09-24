// Script CLI para crear (si no existe) el bucket de Supabase Storage donde se
// guardan las fotos de los tecnicos.
// Uso:
//   node scripts/crear-bucket-tecnicos-fotos.js
// Requiere las variables de entorno de backend/.env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

require('dotenv').config();
const supabaseAdmin = require('../src/config/supabaseClient');

const BUCKET = 'tecnicos-fotos';

async function main() {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) {
    console.error('Error al listar buckets:', listError.message);
    process.exit(1);
  }

  if (buckets.some((b) => b.name === BUCKET)) {
    console.log(`El bucket "${BUCKET}" ya existe.`);
    return;
  }

  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });

  if (error) {
    console.error('Error al crear el bucket:', error.message);
    process.exit(1);
  }

  console.log(`Bucket "${BUCKET}" creado correctamente (privado).`);
}

main();
