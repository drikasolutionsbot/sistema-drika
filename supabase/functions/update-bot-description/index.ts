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
    const { description } = await req.json();

    if (typeof description !== "string") {
      return new Response(
        JSON.stringify({ error: "description must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (description.length > 400) {
      return new Response(
        JSON.stringify({ error: "Discord limita a descrição em 400 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    if (!botToken) {
      return new Response(
        JSON.stringify({ error: "DISCORD_BOT_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PATCH /applications/@me  — Discord API v10
    const res = await fetch("https://discord.com/api/v10/applications/@me", {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("[update-bot-description] Discord error:", res.status, text);
      return new Response(
        JSON.stringify({
          error: `Discord API [${res.status}]`,
          details: text,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let app: any = null;
    try { app = JSON.parse(text); } catch { /* ignore */ }

    return new Response(
      JSON.stringify({
        success: true,
        description: app?.description ?? description,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[update-bot-description] error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
