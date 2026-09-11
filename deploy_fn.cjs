const fs = require('fs');

const lines = fs.readFileSync('.env', 'utf-8').split(/\r?\n/);
const get = (key) => lines.find(l => l.startsWith(key + '='))?.split('=').slice(1).join('=').replace(/^"|"$/g, '').trim();

const serviceRoleKey = get('SUPABASE_SERVICE_ROLE_KEY');
const projectRef = 'iwotvdfxppjwasywrbmw';

// Read the edge function code
const code = fs.readFileSync('supabase/functions/manage-product-fields/index.ts', 'utf-8');

console.log("Deploying manage-product-fields to", projectRef);
console.log("Function code length:", code.length);

// Use the Management API to deploy
async function deploy() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions/manage-product-fields`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      slug: 'manage-product-fields',
      name: 'manage-product-fields',
      body: code,
      verify_jwt: false,
    }),
  });
  
  const text = await res.text();
  console.log("Deploy response:", res.status, text);
}

deploy().catch(console.error);
