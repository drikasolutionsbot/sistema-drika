const { createClient } = require("@supabase/supabase-js");
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.split(/\r?\n/).find(l => l.startsWith('SUPABASE_URL=')).split('=')[1].replace(/^"|"$/g, '').trim();
const serviceRoleKey = envFile.split(/\r?\n/).find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY=')).split('=')[1].replace(/^"|"$/g, '').trim();

const supabase = createClient(supabaseUrl, serviceRoleKey);

supabase.channel('test-restock')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'product_stock_items' }, (payload) => {
    console.log("RECEIVED INSERT EVENT!", payload);
  })
  .subscribe((status) => {
    console.log("Subscribed status:", status);
  });

setTimeout(() => {
  console.log("Waiting for events...");
}, 2000);
