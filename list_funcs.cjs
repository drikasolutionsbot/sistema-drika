const {Client} = require('pg');
const c = new Client('postgresql://postgres:Lucasduda28123@db.krudxivcuygykoswjbbx.supabase.co:5432/postgres');
c.connect().then(()=>c.query("SELECT proname FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE nspname = 'storage'")).then(r => console.log(r.rows.map(x=>x.proname))).finally(()=>c.end());
