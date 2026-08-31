const fetch = require('node-fetch');

async function test() {
  const url = 'https://krudxivcuygykoswjbbx.supabase.co/functions/v1/discord-emojis';
  const tenant_id = 'e7b0e118-2e06-444a-93f8-659f8ed26162'; // example, I'll just use a random ID or if I can find a real one
  
  // let's just make the request without a tenant to see the error
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ tenant_id: 'non-existent' })
  });
  
  const text = await res.text();
  console.log(res.status, text);
}
test();
