const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    envVars[key] = val;
  }
});
const { createClient } = require('@supabase/supabase-js');
const s = createClient(envVars.VITE_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY);

async function run() {
  // Get the pending withdrawal in full detail
  const { data: tx, error } = await s
    .from('wallet_transactions')
    .select('*')
    .eq('id', '47ffbfbe-4e7a-45f9-9367-a199aec4ffcf')
    .single();
  
  console.log('Pending withdrawal TX (full):', JSON.stringify(tx, null, 2));
  console.log('Error:', error);
}
run().catch(console.error);
