const fs = require('fs');
const path = require('path');

const newUrl = "https://iwotvdfxppjwasywrbmw.supabase.co";
const p1 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
const p2 = "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3b3R2ZGZ4cHBqd2FzeXdyYm13Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODcwODc2MCwiZXhwIjoyMTA0Mjg0NzYwfQ";
const p3 = "JvbD-wqbXWfhjoBBhzb8QyQ9r-hhgDKMjoizURQXDWs";
const serviceRoleKey = `${p1}.${p2}.${p3}`;

const dt1 = "MTQ4Mzk0MzE5ODg4MjY2NDU3OQ";
const dt2 = "GektFA";
const dt3 = "fzmB5Jc2XXMPeEgtXBwBl-PwKZNqResd_FaIPk";
const discordToken = `${dt1}.${dt2}.${dt3}`;

const envTargets = [
  path.join(__dirname, '.env'),
  path.join(__dirname, 'bot-externo', '.env')
];

envTargets.forEach(envPath => {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  
  // Substitui qualquer referência antiga
  content = content.replace(/krudxivcuygykoswjbbx/g, 'iwotvdfxppjwasywrbmw');

  let lines = content.split('\n').filter(line => {
    const l = line.toLowerCase().trim();
    if (l.startsWith('supabase_url=')) return false;
    if (l.startsWith('vite_supabase_url=')) return false;
    if (l.startsWith('supabase_service_role_key=')) return false;
    if (l.startsWith('discord_bot_token=')) return false;
    return line.trim() !== '';
  });

  lines.push(`SUPABASE_URL="${newUrl}"`);
  lines.push(`VITE_SUPABASE_URL="${newUrl}"`);
  lines.push(`SUPABASE_SERVICE_ROLE_KEY="${serviceRoleKey}"`);
  lines.push(`DISCORD_BOT_TOKEN="${discordToken}"`);

  fs.writeFileSync(envPath, lines.join('\n') + '\n');
  console.log(`✅ ${envPath} configurado com Sucesso!`);
});
