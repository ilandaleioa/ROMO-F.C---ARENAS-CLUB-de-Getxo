const supabaseAdmin = require('./src/config/supabaseClient');
const { FULL_COLUMNS } = require('./src/config/jugadoresColumns');
(async () => {
  const { data, error } = await supabaseAdmin.from('jugadores').select(FULL_COLUMNS.join(',')).limit(1);
  console.log('DATA:', data);
  console.log('ERROR:', JSON.stringify(error, null, 2));
})();
