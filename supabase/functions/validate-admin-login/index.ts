import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { email, password } = await req.json();
    if (!email || !password) throw new Error("Email e senha são obrigatórios");

    // Use anon key client for authentication (signInWithPassword)
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return new Response(JSON.stringify({ error: "Email ou senha inválidos." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = signInData.user.id;

    // Use service role client to check roles (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      // Sign out the session we just created
      await anonClient.auth.signOut();
      return new Response(JSON.stringify({ error: "Acesso negado. Este email não tem permissão de administrador." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return the session tokens so the client can establish the session
    return new Response(JSON.stringify({
      success: true,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});