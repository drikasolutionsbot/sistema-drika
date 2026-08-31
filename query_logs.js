const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Lucasduda28123@db.krudxivcuygykoswjbbx.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

client.connect().then(() => {
  return client.query(`
    SELECT timestamp, event_message, metadata
    FROM _analytics.edge_logs
    WHERE metadata::text LIKE '%send-webhook%'
    ORDER BY timestamp DESC
    LIMIT 15
  `);
}).then(r => {
  if (r.rows.length === 0) {
    console.log('No logs found in _analytics.edge_logs');
    return client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = '_analytics' LIMIT 20");
  }
  console.log(JSON.stringify(r.rows, null, 2));
  return null;
}).then(r2 => {
  if (r2) console.log('Available tables:', JSON.stringify(r2.rows));
  client.end();
}).catch(async e => {
  console.error('Error:', e.message);
  // try alternate schema
  try {
    const r = await client.query(`
      SELECT schemaname, tablename FROM pg_tables 
      WHERE schemaname NOT IN ('pg_catalog','information_schema')
      AND tablename LIKE '%log%'
      LIMIT 30
    `);
    console.log('Log-related tables:', JSON.stringify(r.rows, null, 2));
  } catch(e2) { console.error(e2.message); }
  client.end();
});
