// Normaliza el campo "localidad" de los jugadores ya guardados en Supabase.
// El Form ha usado a lo largo del tiempo tanto opcion multiple
// ("Getxo (Algorta, Romo, Las Arenas..)") como texto libre ("Berango"),
// dejando localidades equivalentes escritas de forma distinta.
// Uso:
//   node scripts/normalizar-localidades.js        (solo muestra los cambios)
//   node scripts/normalizar-localidades.js --aplicar   (aplica los cambios en Supabase)
// Requiere las variables de entorno de backend/.env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

require('dotenv').config();
const supabaseAdmin = require('../src/config/supabaseClient');

function normalizarLocalidad(valor) {
  if (!valor) return valor;
  let v = String(valor).trim();
  v = v.replace(/\(.*$/, '').trim();
  v = v.replace(/[.,]+$/, '').trim();
  v = v.replace(/\s+/g, ' ');
  v = v.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  return v;
}

async function main() {
  const aplicar = process.argv.includes('--aplicar');

  const { data, error } = await supabaseAdmin.from('jugadores').select('id, nombre, primer_apellido, localidad');
  if (error) {
    console.error('Error consultando jugadores:', error.message);
    process.exit(1);
  }

  const cambios = (data || [])
    .map((j) => ({ ...j, nueva: normalizarLocalidad(j.localidad) }))
    .filter((j) => j.localidad && j.nueva !== j.localidad);

  if (cambios.length === 0) {
    console.log('No hay localidades que normalizar.');
    return;
  }

  console.log(`Localidades a normalizar (${cambios.length}):`);
  cambios.forEach((c) => {
    console.log(`- ${c.nombre} ${c.primer_apellido}: "${c.localidad}" -> "${c.nueva}"`);
  });

  if (!aplicar) {
    console.log('\nModo simulacion: no se ha modificado nada. Ejecuta con --aplicar para guardar los cambios.');
    return;
  }

  for (const c of cambios) {
    const { error: updateError } = await supabaseAdmin
      .from('jugadores')
      .update({ localidad: c.nueva })
      .eq('id', c.id);
    if (updateError) {
      console.error(`Error actualizando ${c.id}:`, updateError.message);
    }
  }
  console.log('\nCambios aplicados.');
}

main();
