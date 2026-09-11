const { createClient } = require("@supabase/supabase-js");
const fs = require('fs');

const lines = fs.readFileSync('.env', 'utf-8').split(/\r?\n/);
const get = (key) => lines.find(l => l.startsWith(key + '='))?.split('=').slice(1).join('=').replace(/^"|"$/g, '').trim();

const supabaseUrl = 'https://iwotvdfxppjwasywrbmw.supabase.co';
const serviceRoleKey = get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  // Get one row to see what columns exist
  const { data, error } = await supabase
    .from('store_configs')
    .select('*')
    .eq('tenant_id', '9f15242b-1d3f-4154-903c-514d736570a2')
    .maybeSingle();
  
  if (error) console.error("Error:", error);
  else console.log("Columns:", data ? Object.keys(data) : "no row");
  console.log("Data:", JSON.stringify(data, null, 2));
}
run().catch(console.error);
