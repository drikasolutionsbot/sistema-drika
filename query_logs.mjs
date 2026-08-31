// Test the send-webhook-message Edge Function directly
const SUPABASE_URL = 'https://krudxivcuygykoswjbbx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtydWR4aXZjdXlneWtvc3dqYmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzMDgwMDAsImV4cCI6MjA1OTg4NDAwMH0.fake';

// Try to get the anon key from the local .env or config
import { readFileSync } from 'fs';

let anonKey = '';
try {
  const env = readFileSync('.env', 'utf8');
  const match = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
  if (match) anonKey = match[1].trim();
} catch {}

if (!anonKey) {
  try {
    const env = readFileSync('.env.local', 'utf8');
    const match = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
    if (match) anonKey = match[1].trim();
  } catch {}
}

if (!anonKey) {
  // Try src/integrations/supabase/client.ts
  try {
    const client = readFileSync('src/integrations/supabase/client.ts', 'utf8');
    const match = client.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*["'](.+?)["']/);
    if (match) anonKey = match[1].trim();
  } catch {}
}

console.log('Anon key found:', anonKey ? 'yes (' + anonKey.slice(0,30) + '...)' : 'NO');

const tenant_id = '87c91b99-e389-42c8-99ad-18503f4f64cd';
const product_id = '4d41a029-9b21-4efc-9037-07a164c1db7b';
// Use a test channel ID (real one from the guild)
const channel_id = '1228348348046512209'; // guild id as placeholder, will fail with discord error

const body = {
  tenant_id,
  channel_id,
  embeds: [],
  content: '',
  product_id,
};

console.log('\nCalling Edge Function with body:', JSON.stringify(body));

const res = await fetch(`${SUPABASE_URL}/functions/v1/send-webhook-message`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${anonKey}`,
    'apikey': anonKey,
  },
  body: JSON.stringify(body),
});

console.log('\nStatus:', res.status, res.statusText);
const text = await res.text();
console.log('Response body:', text);
