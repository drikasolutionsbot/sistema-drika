require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function testDelete() {
  const { data, error } = await supabase.storage.from('tenant-assets').list('', { limit: 10 });
  if (error) {
    console.error("Erro ao listar:", error);
    return;
  }
  console.log("Arquivos encontrados:", data.length);
  if (data.length > 0) {
    console.log("Exemplo de arquivo:", data[0].name);
  }
}

testDelete();
