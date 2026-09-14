const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const lines = fs.readFileSync('.env', 'utf8').split(/\r?\n/);
const get = (k) => lines.find(l => l.startsWith(k + '='))?.split('=').slice(1).join('=').replace(/^"|"$/g, '').trim();
const supabase = createClient(get('SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));

async function check() {
  const { data: product } = await supabase.from('products').select('*').limit(1).single();
  console.log('Product columns:', Object.keys(product));
  console.log('Sample product:', JSON.stringify(product, null, 2));

  const { data: storeConfig } = await supabase.from('store_configs').select('*').limit(1).single();
  console.log('StoreConfig feedback/channel fields:');
  console.log('feedback_channel_id:', storeConfig?.feedback_channel_id);
  console.log('store_url:', storeConfig?.store_url);
}

check().catch(console.error);
