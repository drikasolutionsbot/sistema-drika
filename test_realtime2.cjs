const { createClient } = require("@supabase/supabase-js");
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envFile.split(/\r?\n/).find(l => l.startsWith('SUPABASE_URL=')).split('=')[1].replace(/^"|"$/g, '').trim();
const serviceRoleKey = envFile.split(/\r?\n/).find(l => l.startsWith('SUPABASE_SERVICE_ROLE_KEY=')).split('=')[1].replace(/^"|"$/g, '').trim();

const supabase = createClient(supabaseUrl, serviceRoleKey);

supabase.channel('test-restock-2')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'product_stock_items' }, (payload) => {
    console.log("RECEIVED INSERT EVENT FROM REALTIME!", payload);
    process.exit(0);
  })
  .subscribe(async (status) => {
    console.log("Subscribed status:", status);
    
    if (status === 'SUBSCRIBED') {
      const { data: p } = await supabase.from('products').select('id, tenant_id').limit(1).single();
      console.log("Inserting test stock item for product", p.id);
      const { data, error } = await supabase.from('product_stock_items').insert({
        tenant_id: p.tenant_id,
        product_id: p.id,
        content: 'teste_realtime_321',
      });
      if (error) console.error("Insert error:", error);
      else console.log("Insert success!");
    }
  });

setTimeout(() => {
  console.log("Timeout! Realtime event didn't arrive.");
  process.exit(1);
}, 10000);
