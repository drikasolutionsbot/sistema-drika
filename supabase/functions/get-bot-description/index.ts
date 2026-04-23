import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) {
      return new Response(
        JSON.stringify({ description: "", error: "DISCORD_BOT_TOKEN não configurado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch("https://discord.com/api/v10/applications/@me", {
      headers: { Authorization: `Bot ${botToken}` },
    });

    const text = await res.text();
    if (!res.ok) {
      return new Response(
        JSON.stringify({ description: "", error: `Discord API [${res.status}]: ${text}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const app = JSON.parse(text);
    return new Response(
      JSON.stringify({
        description: app.description ?? "",
        name: app.name ?? null,
        id: app.id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ description: "", error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
