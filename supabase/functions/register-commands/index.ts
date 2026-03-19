

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Extract application ID from bot token (first segment is base64-encoded bot user/app ID)
function getAppIdFromToken(token: string): string {
  try {
    const firstSegment = token.split(".")[0];
    // Add padding if needed
    const padded = firstSegment + "=".repeat((4 - firstSegment.length % 4) % 4);
    return atob(padded);
  } catch {
    return "";
  }
}

interface CommandChoice {
  name: string;
  value: string | number;
}

interface CommandOption {
  name: string;
  description: string;
  type: number;
  required?: boolean;
  choices?: CommandChoice[];
}

interface SlashCommand {
  name: string;
  description: string;
  type: number;
  options?: CommandOption[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") || null;

    const { commands, guild_id } = await req.json();

    if (!BOT_TOKEN) {
      return new Response(JSON.stringify({ success: false, registered: 0, commands: [], message: "Bot externo não configurado (DISCORD_BOT_TOKEN)." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!commands || !Array.isArray(commands) || commands.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum comando fornecido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slashCommands: SlashCommand[] = commands.map((cmd: { name: string; description: string; options?: CommandOption[] }) => {
      const built: SlashCommand = {
        name: cmd.name.replace(/^\//, "").toLowerCase(),
        description: cmd.description.substring(0, 100),
        type: 1,
      };

      if (cmd.options && cmd.options.length > 0) {
        built.options = cmd.options.map((opt) => {
          const o: CommandOption = {
            name: opt.name.toLowerCase().substring(0, 32),
            description: opt.description.substring(0, 100),
            type: opt.type,
            required: opt.required ?? false,
          };
          if (opt.choices && opt.choices.length > 0) {
            o.choices = opt.choices.slice(0, 25).map((c) => ({
              name: String(c.name).substring(0, 100),
              value: opt.type === 4 || opt.type === 10 ? Number(c.value) : String(c.value),
            }));
          }
          return o;
        });
      }

      return built;
    });

    // Extract app ID from the bot token
    const DISCORD_APP_ID = getAppIdFromToken(BOT_TOKEN);
    if (!DISCORD_APP_ID || !/^\d{17,20}$/.test(DISCORD_APP_ID)) {
      return new Response(JSON.stringify({ error: "Não foi possível extrair o Application ID do bot token. Verifique se o token é válido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Register globally or per-guild
    let url: string;
    if (guild_id) {
      url = `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${guild_id}/commands`;
    } else {
      url = `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`;
    }

    const discordRes = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slashCommands),
    });

    if (!discordRes.ok) {
      const errBody = await discordRes.text();
      console.error("Discord API error:", discordRes.status, errBody);
      return new Response(
        JSON.stringify({ error: `Discord API retornou ${discordRes.status}`, details: errBody }),
        { status: discordRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await discordRes.json();

    return new Response(
      JSON.stringify({ success: true, registered: result.length ?? 0, commands: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error registering commands:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
