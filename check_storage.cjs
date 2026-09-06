const { Client } = require('pg');

const connectionString = 'postgresql://postgres:Lucasduda28123@db.krudxivcuygykoswjbbx.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
});

async function checkStorage() {
  try {
    await client.connect();
    console.log("Conectado ao banco de dados!");

    const res = await client.query(`
      SELECT 
        bucket_id, 
        COUNT(*) as total_files, 
        SUM((metadata->>'size')::bigint) as total_bytes, 
        ROUND(SUM((metadata->>'size')::bigint) / 1024.0 / 1024.0, 2) as total_mb
      FROM storage.objects
      GROUP BY bucket_id;
    `);

    console.log("Status do Storage:");
    console.table(res.rows);

  } catch (err) {
    console.error("Erro:", err);
  } finally {
    await client.end();
  }
}

checkStorage();
