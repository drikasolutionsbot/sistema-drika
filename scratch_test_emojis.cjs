const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://krudxivcuygykoswjbbx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtydWR4aXZjdXlneWtvc3dqYmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTM4OTgsImV4cCI6MjA4Nzk4OTg5OH0.k5b8jP-_hHoDAlTmeOX_M8genpiQ_i9f1Tr8XVCSPhg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Fetching a tenant...");
  const { data: tenants, error } = await supabase.from('tenants').select('id, name, discord_guild_id').limit(1);
  if (error) {
    console.error("Error fetching tenant:", error);
    return;
  }
  
  if (!tenants || tenants.length === 0) {
    console.log("No tenants found");
    return;
  }
  
  const tenantId = tenants[0].id;
  console.log("Found tenant:", tenantId, tenants[0].name, tenants[0].discord_guild_id);
  
  console.log("Invoking discord-emojis function...");
  const { data, error: invokeError } = await supabase.functions.invoke('discord-emojis', {
    body: { tenant_id: tenantId }
  });
  
  console.log("Invoke Result:", { data, error: invokeError });
}

test();
