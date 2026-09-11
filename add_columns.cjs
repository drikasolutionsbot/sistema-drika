const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Lucasduda28123@db.iwotvdfxppjwasywrbmw.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    // Adicionar a coluna store_url na tabela store_configs
    await client.query(`
      ALTER TABLE public.store_configs 
      ADD COLUMN IF NOT EXISTS store_url TEXT;
    `);
    console.log("Coluna store_url adicionada com sucesso!");
    
    // Aproveitar para garantir que as outras colunas também existem, caso faltem
    await client.query(`
      ALTER TABLE public.store_configs 
      ADD COLUMN IF NOT EXISTS restock_embed_color TEXT,
      ADD COLUMN IF NOT EXISTS restock_embed_title TEXT,
      ADD COLUMN IF NOT EXISTS restock_embed_description TEXT,
      ADD COLUMN IF NOT EXISTS restock_embed_footer TEXT,
      ADD COLUMN IF NOT EXISTS restock_embed_image_url TEXT,
      ADD COLUMN IF NOT EXISTS restock_embed_thumbnail_url TEXT,
      ADD COLUMN IF NOT EXISTS restock_mention_role_id TEXT;
    `);
    console.log("Outras colunas verificadas com sucesso!");
    
  } catch (e) {
    console.error("Erro ao alterar tabela:", e);
  } finally {
    await client.end();
  }
}

run();
