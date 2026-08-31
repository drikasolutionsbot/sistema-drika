require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  console.log(`\n🤖 Bot logado como ${client.user.tag}`);
  console.log("🔍 Buscando clientes no banco de dados...\n");

  const { data: tenants, error } = await supabase.from("tenants").select("id, name, discord_guild_id, plan");
  if (error) {
    console.error("Erro ao buscar clientes:", error);
    process.exit(1);
  }

  let conectados = [];
  let desconectados = [];

  for (const tenant of tenants) {
    if (!tenant.discord_guild_id) continue;

    // Verifica se o bot está no servidor
    const isConnected = client.guilds.cache.has(tenant.discord_guild_id);

    if (isConnected) {
      conectados.push(tenant);
    } else {
      desconectados.push(tenant);
    }
  }

  console.log("==========================================");
  console.log(`📊 TOTAL DE LOJAS NO BANCO: ${tenants.length}`);
  console.log(`✅ CONECTADOS (Bot presente): ${conectados.length}`);
  console.log(`❌ DESCONECTADOS (Bot ausente/expulso): ${desconectados.length}`);
  console.log("==========================================\n");

  if (conectados.length > 0) {
    console.log("✅ LISTA DE CLIENTES CONECTADOS (Bot Ativo):");
    conectados.forEach((t, i) => {
      console.log(`   ${i + 1}. Loja: "${t.name}" | Plano: ${t.plan} | ID do Servidor: ${t.discord_guild_id}`);
    });
  } else {
    console.log("⚠️ Nenhum cliente conectado encontrado!");
  }

  process.exit(0);
});

if (!process.env.DISCORD_BOT_TOKEN) {
  console.error("❌ ERRO: DISCORD_BOT_TOKEN não encontrado no .env");
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN);
