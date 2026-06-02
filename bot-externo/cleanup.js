require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanDB() {
  console.log("🧹 Iniciando faxina no banco de dados...");
  
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  const date15 = fifteenDaysAgo.toISOString();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const date30 = thirtyDaysAgo.toISOString();

  let res;

  // 1. Logs de proteção antigos
  console.log("Apagando logs de proteção antigos...");
  res = await supabase.from('protection_logs').delete().lt('created_at', date15);
  if(res.error) console.log("Erro:", res.error.message);

  // 2. Tickets fechados
  console.log("Apagando tickets antigos já fechados...");
  res = await supabase.from('tickets').delete().eq('status', 'closed').lt('created_at', date15);
  if(res.error) console.log("Erro:", res.error.message);

  // 3. Estoque antigo já entregue
  console.log("Apagando registros de estoque já entregues há muito tempo...");
  res = await supabase.from('product_stock_items').delete().eq('delivered', true).lt('created_at', date30);
  if(res.error) console.log("Erro:", res.error.message);

  // 4. Ordens canceladas
  console.log("Apagando ordens canceladas e expiradas antigas...");
  res = await supabase.from('orders').delete().in('status', ['cancelled', 'expired', 'expired_payment']).lt('created_at', date15);
  if(res.error) console.log("Erro:", res.error.message);

  console.log("✅ Faxina concluída! O banco deve liberar espaço em alguns minutos no painel.");
}

cleanDB();
