const { createClient } = require("@supabase/supabase-js");
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const lines = envFile.split(/\r?\n/);
const get = (key) => lines.find(l => l.startsWith(key + '='))?.split('=').slice(1).join('=').replace(/^"|"$/g, '').trim();

const supabaseUrl = 'https://iwotvdfxppjwasywrbmw.supabase.co';
const serviceRoleKey = get('SUPABASE_SERVICE_ROLE_KEY');

console.log("Service role key present:", Boolean(serviceRoleKey));

// Simular add_stock chamando manage-product-fields
async function testEdgeFunction() {
  // primeiro pegar um produto válido
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: product } = await supabase.from('products').select('id, tenant_id, name').limit(1).single();
  console.log("Produto:", product?.name, product?.id);
  
  const body = {
    action: 'add_stock',
    tenant_id: product.tenant_id,
    product_id: product.id,
    items: ['item_teste_notificacao'],
  };
  
  console.log("Chamando manage-product-fields...");
  const res = await fetch(`${supabaseUrl}/functions/v1/manage-product-fields`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(body),
  });
  
  const text = await res.text();
  console.log(`manage-product-fields response: ${res.status}`, text);
  
  // Agora testar o send-restock-announcement diretamente
  console.log("\nChamando send-restock-announcement diretamente...");
  const res2 = await fetch(`${supabaseUrl}/functions/v1/send-restock-announcement`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      tenant_id: product.tenant_id,
      product_id: product.id,
      field_id: null,
      added_count: 1,
    }),
  });
  
  const text2 = await res2.text();
  console.log(`send-restock-announcement response: ${res2.status}`, text2);
}

testEdgeFunction().catch(console.error);
