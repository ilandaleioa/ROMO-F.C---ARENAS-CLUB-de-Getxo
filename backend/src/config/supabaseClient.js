const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// Cliente con la service_role key: solo se usa en el backend.
// RLS esta activo en Supabase, esta key lo salta a proposito para que
// sea este servidor (y no el frontend) quien controle los permisos.
const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = supabaseAdmin;
