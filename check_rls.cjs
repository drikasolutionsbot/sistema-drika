const {Client} = require('pg');
const c = new Client('postgresql://postgres:Lucasduda28123@db.krudxivcuygykoswjbbx.supabase.co:5432/postgres');
c.connect().then(()=>c.query("SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'storage.objects'::regclass")).then(r => console.table(r.rows)).finally(()=>c.end());
