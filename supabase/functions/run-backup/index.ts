import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v10";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, tenant_id } = body;

    const json = (data: any) =>
      new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // Run backup for a specific tenant
    if (action === "run" && tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, discord_guild_id, bot_token_encrypted, name")
        .eq("id", tenant_id)
        .single();

      if (!tenant) throw new Error("Tenant not found");

      // Create backup record
      const { data: backup, error: insertErr } = await supabase
        .from("ecloud_backups")
        .insert({ tenant_id, backup_type: "manual", status: "running" })
        .select()
        .single();
      if (insertErr) throw insertErr;

      try {
        const backupData: any = { members: [], verified: [], orders: [], products: [], roles: [] };
        let membersCount = 0;
        let verifiedCount = 0;
        let ordersCount = 0;
        let productsCount = 0;

        const botToken = tenant.bot_token_encrypted || Deno.env.get("DISCORD_BOT_TOKEN");
        // 1. Fetch Discord members
        if (tenant.discord_guild_id && botToken) {
          let after = "0";
          const allMembers: any[] = [];
          for (let i = 0; i < 20; i++) { // max 20k members
            const res = await fetch(
              `${DISCORD_API}/guilds/${tenant.discord_guild_id}/members?limit=1000&after=${after}`,
              { headers: { Authorization: `Bot ${botToken}` } }
            );
            if (!res.ok) break;
            const batch = await res.json();
            if (!Array.isArray(batch) || batch.length === 0) break;
            allMembers.push(...batch);
            after = batch[batch.length - 1].user.id;
            if (batch.length < 1000) break;
          }
          backupData.members = allMembers.map((m: any) => ({
            id: m.user.id,
            username: m.user.username,
            discriminator: m.user.discriminator,
            avatar: m.user.avatar,
            nickname: m.nick,
            roles: m.roles,
            joined_at: m.joined_at,
            bot: m.user.bot || false,
          }));
          membersCount = backupData.members.length;
        }

        // 2. Verified members
        const { data: verified } = await supabase
          .from("verified_members")
          .select("discord_user_id, discord_username, discord_avatar, verified_at")
          .eq("tenant_id", tenant_id);
        backupData.verified = verified || [];
        verifiedCount = backupData.verified.length;

        // 3. Orders
        const { data: orders } = await supabase
          .from("orders")
          .select("id, order_number, product_name, discord_user_id, discord_username, status, total_cents, created_at")
          .eq("tenant_id", tenant_id)
          .order("created_at", { ascending: false })
          .limit(1000);
        backupData.orders = orders || [];
        ordersCount = backupData.orders.length;

        // 4. Products + stock
        const { data: products } = await supabase
          .from("products")
          .select("id, name, price_cents, stock, active, type, created_at")
          .eq("tenant_id", tenant_id);
        backupData.products = products || [];
        productsCount = backupData.products.length;

        // 5. Roles from Discord
        if (tenant.discord_guild_id && tenant.bot_token_encrypted) {
          try {
            const rolesRes = await fetch(
              `${DISCORD_API}/guilds/${tenant.discord_guild_id}/roles`,
              { headers: { Authorization: `Bot ${tenant.bot_token_encrypted}` } }
            );
            if (rolesRes.ok) {
              backupData.roles = await rolesRes.json();
            }
          } catch {}
        }

        // Update backup record
        await supabase
          .from("ecloud_backups")
          .update({
            status: "completed",
            members_count: membersCount,
            verified_count: verifiedCount,
            orders_count: ordersCount,
            products_count: productsCount,
            data: backupData,
            completed_at: new Date().toISOString(),
          })
          .eq("id", backup.id);

        return json({
          success: true,
          backup_id: backup.id,
          members: membersCount,
          verified: verifiedCount,
          orders: ordersCount,
          products: productsCount,
        });
      } catch (err: any) {
        await supabase
          .from("ecloud_backups")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", backup.id);
        throw err;
      }
    }

    // Run backup for ALL tenants (cron job)
    if (action === "run_all") {
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id")
        .not("discord_guild_id", "is", null);

      const results: any[] = [];
      for (const t of tenants || []) {
        try {
          // Call self for each tenant
          const res = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/run-backup`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ action: "run", tenant_id: t.id }),
            }
          );
          const data = await res.json();
          results.push({ tenant_id: t.id, ...data });
        } catch (err: any) {
          results.push({ tenant_id: t.id, error: err.message });
        }
      }
      return json({ success: true, results });
    }

    // Get backup history
    if (action === "list" && tenant_id) {
      const { data, error } = await supabase
        .from("ecloud_backups")
        .select("id, backup_type, status, members_count, verified_count, orders_count, products_count, started_at, completed_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return json(data);
    }

    // Get backup data (for export)
    if (action === "get" && body.backup_id) {
      const { data, error } = await supabase
        .from("ecloud_backups")
        .select("*")
        .eq("id", body.backup_id)
        .single();
      if (error) throw error;
      return json(data);
    }

    // Export current data (live, no backup needed)
    if (action === "export" && tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("discord_guild_id, bot_token_encrypted")
        .eq("id", tenant_id)
        .single();

      const exportData: any = {};

      const botToken = tenant?.bot_token_encrypted || Deno.env.get("DISCORD_BOT_TOKEN");
      // Members from Discord
      if (tenant?.discord_guild_id && botToken) {
        let after = "0";
        const allMembers: any[] = [];
        for (let i = 0; i < 20; i++) {
          const res = await fetch(
            `${DISCORD_API}/guilds/${tenant.discord_guild_id}/members?limit=1000&after=${after}`,
            { headers: { Authorization: `Bot ${botToken}` } }
          );
          if (!res.ok) break;
          const batch = await res.json();
          if (!Array.isArray(batch) || batch.length === 0) break;
          allMembers.push(...batch);
          after = batch[batch.length - 1].user.id;
          if (batch.length < 1000) break;
        }
        exportData.members = allMembers.map((m: any) => ({
          id: m.user.id,
          username: m.user.username,
          nickname: m.nick,
          roles: m.roles,
          joined_at: m.joined_at,
        }));
      }

      // Verified
      const { data: verified } = await supabase
        .from("verified_members")
        .select("discord_user_id, discord_username, verified_at")
        .eq("tenant_id", tenant_id);
      exportData.verified = verified || [];

      // Orders
      const { data: orders } = await supabase
        .from("orders")
        .select("order_number, product_name, discord_username, status, total_cents, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", { ascending: false });
      exportData.orders = orders || [];

      // Products
      const { data: products } = await supabase
        .from("products")
        .select("name, price_cents, stock, active, type")
        .eq("tenant_id", tenant_id);
      exportData.products = products || [];

      return json(exportData);
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
