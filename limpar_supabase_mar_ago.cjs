const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

// Pega os valores do .env injetados pelo Node
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: Variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY não encontradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const pgClient = new Client({
  connectionString: 'postgresql://postgres:Lucasduda28123@db.krudxivcuygykoswjbbx.supabase.co:5432/postgres'
});

async function main() {
  try {
    await pgClient.connect();
    console.log("Conectado ao PostgreSQL para listar os arquivos...");

    // Busca arquivos criados em Março ou Agosto de 2026
    const res = await pgClient.query(`
      SELECT name
      FROM storage.objects
      WHERE bucket_id = 'tenant-assets'
        AND (
          DATE_TRUNC('month', created_at) = '2026-03-01' OR 
          DATE_TRUNC('month', created_at) = '2026-08-01'
        )
    `);

    const files = res.rows.map(r => r.name);
    console.log(`Encontrados ${files.length} arquivos para deletar.`);

    if (files.length === 0) {
      console.log("Nenhum arquivo encontrado para deletar nesses meses.");
      return;
    }

    // O Supabase JS permite deletar no máximo 100 (ou mais), mas vamos fazer em lotes de 100 para segurança.
    const chunkSize = 100;
    let deletedCount = 0;

    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      
      const { data, error } = await supabase.storage.from('tenant-assets').remove(chunk);
      
      if (error) {
        console.error("Erro ao deletar lote:", error);
      } else {
        deletedCount += chunk.length;
        console.log(`Deletados ${deletedCount} de ${files.length}...`);
      }
    }

    console.log("🎉 Limpeza concluída com sucesso! Os arquivos foram removidos da Storage de verdade.");

  } catch (err) {
    console.error("Ocorreu um erro geral:", err);
  } finally {
    await pgClient.end();
  }
}

main();
