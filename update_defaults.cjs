const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Lucasduda28123@db.iwotvdfxppjwasywrbmw.supabase.co:5432/postgres' });

const oldDesc1 = "Olá **{username}**, seja bem-vindo(a) ao **{server}**! 🥳\n\nVocê é nosso membro **#{memberCount}**. Aproveite sua estadia!";
const oldDesc2 = "Olá {username}, seja bem-vindo(a) ao {server}! 🥳\n\nVocê é nosso membro #{memberCount}. Aproveite sua estadia!";
const newDesc = "Olá {user}, seja bem-vindo(a) ao **{server}**! 🥳\n\nVocê é nosso membro **#{memberCount}**.\n{user} foi convidado(a) por {inviter} e agora tem {invites} convites.\n\nAproveite sua estadia!";

async function run() {
  await client.connect();

  try {
    const res1 = await client.query(`
      UPDATE public.welcome_configs
      SET embed_data = jsonb_set(
        embed_data,
        '{description}',
        $1::jsonb
      )
      WHERE embed_data->>'description' = $2 OR embed_data->>'description' = $3
    `, [JSON.stringify(newDesc), oldDesc1, oldDesc2]);
    console.log(`Updated ${res1.rowCount} welcome_configs.`);

    const res2 = await client.query(`
      UPDATE public.channel_configs
      SET embed_config = jsonb_set(
        embed_config,
        '{description}',
        $1::jsonb
      )
      WHERE embed_config->>'description' = $2 OR embed_config->>'description' = $3
    `, [JSON.stringify(newDesc), oldDesc1, oldDesc2]);
    console.log(`Updated ${res2.rowCount} channel_configs.`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
