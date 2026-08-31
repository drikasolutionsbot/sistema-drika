require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('landing_config').select('global_bot_banner_url').single();
  if (error) console.error(error);
  console.log("DB RESULT:", data);
}
check();
