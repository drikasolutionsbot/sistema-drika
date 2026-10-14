import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCORD_API = "https://discord.com/api/v10";

interface ReminderResult {
  tenant_id: string;
  tenant_name: string;
  discord_id?: string;
  type?: "d1" | "d0";
  status: "sent" | "skipped" | "error";
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");

    if (!botToken) {
      throw new Error("DISCORD_BOT_TOKEN não está configurado nas Edge Functions.");
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const action = body.action || "run_all";
    const force = !!body.force;
    const specifiedSystemUrl = body.system_url?.trim() || "";

    // 1. Carrega configurações globais da landing_config
    const { data: config } = await admin
      .from("landing_config")
      .select("subscription_reminders_enabled, system_url, global_bot_banner_url")
      .limit(1)
      .maybeSingle();

    // Se estiver desativado globalmente e não for envio forçado/unitário
    if (config?.subscription_reminders_enabled === false && action === "run_all" && !force) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "Lembretes automáticos estão desativados em landing_config.",
          results: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemUrl = (specifiedSystemUrl || config?.system_url || "https://www.drikahub.com").replace(/\/$/, "");
    const renewalUrl = `${systemUrl}/settings?tab=plan`;

    // 2. Determina o escopo de tenants a verificar
    let tenantsToProcess: any[] = [];

    if (action === "send_single" && body.tenant_id) {
      const { data: singleTenant, error: singleErr } = await admin
        .from("tenants")
        .select("id, name, plan, plan_expires_at, owner_discord_id, owner_discord_username, reminder_d1_sent_at, reminder_d0_sent_at, logo_url, bot_name")
        .eq("id", body.tenant_id)
        .single();

      if (singleErr || !singleTenant) {
        throw new Error(`Loja não encontrada: ${body.tenant_id}`);
      }
      tenantsToProcess = [singleTenant];
    } else {
      // Busca tenants que possuem plano e data de expiração definida, não expirados há muito tempo
      const { data: tenants, error: tenantsErr } = await admin
        .from("tenants")
        .select("id, name, plan, plan_expires_at, owner_discord_id, owner_discord_username, reminder_d1_sent_at, reminder_d0_sent_at, logo_url, bot_name")
        .not("plan_expires_at", "is", null)
        .neq("plan", "expired");

      if (tenantsErr) throw tenantsErr;
      tenantsToProcess = tenants || [];
    }

    const results: ReminderResult[] = [];
    const now = new Date();
    let sentD1 = 0;
    let sentD0 = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const tenant of tenantsToProcess) {
      if (!tenant.plan_expires_at) {
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          status: "skipped",
          reason: "Sem data de expiração",
        });
        skippedCount++;
        continue;
      }

      const expiresAt = new Date(tenant.plan_expires_at);
      const hoursLeft = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Determina o tipo de lembrete
      let reminderType: "d1" | "d0" | null = null;

      if (body.reminder_type === "d1" || body.reminder_type === "d0") {
        reminderType = body.reminder_type;
      } else {
        // Lógica automática baseada nas horas restantes:
        // D-1: Falta entre 12h e 36h (aprox. 1 dia restante)
        // D-0: Falta 12h ou menos (vence hoje ou venceu nas últimas 12h)
        if (hoursLeft > 12 && hoursLeft <= 36) {
          reminderType = "d1";
        } else if (hoursLeft <= 12 && hoursLeft >= -12) {
          reminderType = "d0";
        }
      }

      if (!reminderType && action !== "send_single") {
        // Fora das janelas D-1 e D-0
        skippedCount++;
        continue;
      }

      if (!reminderType && action === "send_single") {
        // Fallback para envio manual caso as horas não casem com a janela exata
        reminderType = hoursLeft > 24 ? "d1" : "d0";
      }

      // Verifica se já enviou neste ciclo
      if (!force) {
        if (reminderType === "d1" && tenant.reminder_d1_sent_at) {
          const sentAt = new Date(tenant.reminder_d1_sent_at);
          // Se enviou nas últimas 36 horas ou após a data de expiração - 48h, pula
          if (now.getTime() - sentAt.getTime() < 36 * 60 * 60 * 1000) {
            results.push({
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              type: "d1",
              status: "skipped",
              reason: "Lembrete D-1 já enviado recentemente",
            });
            skippedCount++;
            continue;
          }
        }

        if (reminderType === "d0" && tenant.reminder_d0_sent_at) {
          const sentAt = new Date(tenant.reminder_d0_sent_at);
          if (now.getTime() - sentAt.getTime() < 24 * 60 * 60 * 1000) {
            results.push({
              tenant_id: tenant.id,
              tenant_name: tenant.name,
              type: "d0",
              status: "skipped",
              reason: "Lembrete D-0 já enviado recentemente",
            });
            skippedCount++;
            continue;
          }
        }
      }

      // Obtém ou resolve o Discord do dono
      let discordId = tenant.owner_discord_id;

      if (!discordId) {
        // Tenta buscar pelo user_roles
        const { data: roleRow } = await admin
          .from("user_roles")
          .select("user_id")
          .eq("tenant_id", tenant.id)
          .eq("role", "owner")
          .limit(1)
          .maybeSingle();

        if (roleRow?.user_id) {
          const { data: userProfile } = await admin
            .from("profiles")
            .select("discord_id, discord_username")
            .eq("id", roleRow.user_id)
            .maybeSingle();

          if (userProfile?.discord_id) {
            discordId = userProfile.discord_id;
            // Salva no tenant para as próximas vezes
            await admin
              .from("tenants")
              .update({
                owner_discord_id: userProfile.discord_id,
                owner_discord_username: userProfile.discord_username || tenant.owner_discord_username,
              })
              .eq("id", tenant.id);
          }
        }
      }

      if (!discordId) {
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          type: reminderType,
          status: "skipped",
          reason: "Cliente sem Discord vinculado no sistema",
        });
        skippedCount++;
        continue;
      }

      // Formatação dos dados
      const formattedDate = expiresAt.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const planCapitalized =
        tenant.plan === "master"
          ? "Master"
          : tenant.plan === "pro"
          ? "Básico (Pro)"
          : tenant.plan || "Plano";

      const recipientName = tenant.owner_discord_username ? `@${tenant.owner_discord_username}` : "Lojista";
      const storeName = tenant.bot_name || tenant.name || "Sua Loja";

      // Constrói Embed e Botão
      let embed: any;
      let buttonLabel: string;
      let buttonEmoji: string;

      if (reminderType === "d1") {
        embed = {
          title: "⏰ Lembrete de Assinatura • Falta 1 Dia!",
          description: `Olá **${recipientName}**! 👋\n\nA assinatura da sua loja **${storeName}** no **Drika Hub** está próxima de expirar.\n\nResta apenas **1 dia** de vigência do seu plano **${planCapitalized}**.\n\n💡 *Renove com antecedência para não ter seu bot, automações ou vendas interrompidas.*`,
          color: 0xfaa61a, // Âmbar / Laranja
          fields: [
            { name: "🏪 Loja", value: `\`${storeName}\``, inline: true },
            { name: "📦 Plano Atual", value: `**${planCapitalized}**`, inline: true },
            { name: "📅 Data de Vencimento", value: `${formattedDate}`, inline: true },
            { name: "⏳ Situação", value: "🟡 **Expira amanhã (D-1)**", inline: false },
          ],
          footer: {
            text: "Drika Hub • Notificação Automática de Vencimento",
          },
          timestamp: new Date().toISOString(),
        };
        buttonLabel = "Renovar Assinatura";
        buttonEmoji = "💳";
      } else {
        embed = {
          title: "🚨 Atenção: Sua Assinatura Vence Hoje!",
          description: `Olá **${recipientName}**! ⚠️\n\nA assinatura da sua loja **${storeName}** no **Drika Hub** **vence hoje**!\n\nSeu plano **${planCapitalized}** expira em **${formattedDate}**.\n\n🔴 *Evite a suspensão do bot e interrupção das suas vendas renovando sua assinatura agora pelo painel.*`,
          color: 0xed4245, // Vermelho Alerta
          fields: [
            { name: "🏪 Loja", value: `\`${storeName}\``, inline: true },
            { name: "📦 Plano Atual", value: `**${planCapitalized}**`, inline: true },
            { name: "📅 Data de Vencimento", value: `**Hoje às ${formattedDate.split(" ")[1] || formattedDate}**`, inline: true },
            { name: "⚠️ Situação", value: "🔴 **Vence Hoje (D-0)**", inline: false },
          ],
          footer: {
            text: "Drika Hub • Notificação Urgente de Vencimento",
          },
          timestamp: new Date().toISOString(),
        };
        buttonLabel = "Renovar Agora no Painel";
        buttonEmoji = "⚡";
      }

      const buttons = [
        {
          type: 2, // BUTTON
          style: 5, // LINK
          label: buttonLabel,
          url: renewalUrl,
          emoji: { name: buttonEmoji },
        },
      ];

      // Envia a mensagem via Discord API
      try {
        // 1. Abrir canal de DM
        const dmChannelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ recipient_id: discordId }),
        });

        if (!dmChannelRes.ok) {
          const errText = await dmChannelRes.text();
          throw new Error(`Falha ao abrir DM (HTTP ${dmChannelRes.status}): ${errText.slice(0, 150)}`);
        }

        const dmChannel = await dmChannelRes.json();

        // 2. Enviar embed com botão de renovação
        const sendRes = await fetch(`${DISCORD_API}/channels/${dmChannel.id}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            embeds: [embed],
            components: [{ type: 1, components: buttons }],
          }),
        });

        if (!sendRes.ok) {
          const errText = await sendRes.text();
          throw new Error(`Falha ao enviar mensagem (HTTP ${sendRes.status}): ${errText.slice(0, 150)}`);
        }

        // 3. Atualizar carimbo no banco para evitar reenvio
        const updateField = reminderType === "d1" ? "reminder_d1_sent_at" : "reminder_d0_sent_at";
        await admin
          .from("tenants")
          .update({ [updateField]: now.toISOString() })
          .eq("id", tenant.id);

        if (reminderType === "d1") sentD1++;
        if (reminderType === "d0") sentD0++;

        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          discord_id: discordId,
          type: reminderType,
          status: "sent",
        });
      } catch (err: any) {
        console.error(`Erro ao enviar lembrete para tenant ${tenant.id} (${tenant.name}):`, err);
        errorCount++;
        results.push({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          discord_id: discordId,
          type: reminderType,
          status: "error",
          reason: err.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_checked: tenantsToProcess.length,
          sent_d1: sentD1,
          sent_d0: sentD0,
          skipped: skippedCount,
          errors: errorCount,
        },
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro na função send-subscription-reminder:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
