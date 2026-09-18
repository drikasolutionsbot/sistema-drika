const { Client } = require('pg');
const fs = require('fs');

const connectionString = 'postgresql://postgres:Lucasduda28123@db.iwotvdfxppjwasywrbmw.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    const sql = fs.readFileSync('supabase/migrations/20260918000000_add_invite_tracker.sql', 'utf8');
    await client.query(sql);
    console.log("Migração de invite tracker aplicada com sucesso!");
  } catch (e) {
    console.error("Erro ao aplicar migração:", e);
  } finally {
    await client.end();
  }
}

run();
