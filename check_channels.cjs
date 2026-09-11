const { createClient } = require("@supabase/supabase-js");
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.split(/\r?\n/).find(l => l.startsWith('SUPABASE_URL=')).split('=')[1].replace(/^"|"$/g, '').trim();
const serviceRoleKey = envFile.split(/\r?\n/).find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY=')).split('=')[1].replace(/^"|"$/g, '').trim();

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data, error } = await supabase
    .from("channel_configs")
    .select("*")
    .eq("channel_key", "restock_channel");

  if (error) console.error(error);
  else console.log(data);
}
run();
