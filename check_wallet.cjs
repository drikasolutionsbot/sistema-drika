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
  const orderId = '42042cc6-cd4c-42f8-ae6a-0030fafb23cc';

  // Check webhook logs for this order
  const { data: logs } = await s
    .from('webhook_logs')
    .select('created_at, provider_key, event_type, status, result, payload')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('=== Recent webhook logs ===');
  (logs || []).forEach(l => {
    console.log(`[${l.created_at}] ${l.provider_key} | ${l.event_type} | ${l.status} | result=${JSON.stringify(l.result)}`);
  });

  // Try calling credit_order_to_wallet manually for order 3464
  console.log('\n=== Attempting to credit wallet for order 3464 ===');
  const { data: creditResult, error: creditErr } = await s.rpc('credit_order_to_wallet', {
    _tenant_id: '9f15242b-1d3f-4154-903c-514d736570a2',
    _order_id: orderId,
    _amount_cents: 200,
    _description: 'Venda Pedido #3464 - teste',
  });
  console.log('credit_order_to_wallet result:', creditResult);
  console.log('credit_order_to_wallet error:', creditErr);

  // Check wallet after credit attempt
  const { data: wallet } = await s
    .from('wallets')
    .select('balance_cents, total_earned_cents')
    .eq('tenant_id', '9f15242b-1d3f-4154-903c-514d736570a2')
    .single();
  console.log('Wallet after credit:', wallet);

  // Check wallet_transactions after credit attempt
  const { data: txs } = await s
    .from('wallet_transactions')
    .select('id, type, description, amount_cents, status, created_at')
    .eq('tenant_id', '9f15242b-1d3f-4154-903c-514d736570a2')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('Wallet transactions:', JSON.stringify(txs, null, 2));
}

run().catch(console.error);
