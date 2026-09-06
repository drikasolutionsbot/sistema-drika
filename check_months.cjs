const {Client} = require('pg');
const c = new Client('postgresql://postgres:Lucasduda28123@db.krudxivcuygykoswjbbx.supabase.co:5432/postgres');
c.connect().then(()=>c.query("SELECT DATE_TRUNC('month', created_at) as month, COUNT(*), ROUND(SUM((metadata->>'size')::bigint) / 1024.0 / 1024.0, 2) as total_mb FROM storage.objects WHERE bucket_id = 'tenant-assets' GROUP BY month ORDER BY month")).then(r => console.table(r.rows)).finally(()=>c.end());
