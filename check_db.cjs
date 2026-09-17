require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: tenants } = await supabase.from('tenants').select('id, discord_guild_id, bot_token_encrypted');
  const totalWithToken = tenants.filter(t => t.bot_token_encrypted).length;
  const totalWithGuild = tenants.filter(t => t.discord_guild_id).length;
  console.log(`Total tenants: ${tenants.length}`);
  console.log(`With token: ${totalWithToken}`);
  console.log(`With guild: ${totalWithGuild}`);
}
check();
