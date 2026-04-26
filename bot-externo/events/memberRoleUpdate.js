// Detecta quando um membro ganha um cargo de staff e o adiciona
// automaticamente a todos os tickets abertos do tenant.
const { getStoreConfig, supabase } = require("../supabase");

async function getEffectiveStaffRoleIds(tenant, guild) {
  const storeConfig = await getStoreConfig(tenant.id);
  let staffRoleIds = (storeConfig?.ticket_staff_role_id || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Fallback: cargos do painel com permissões de gestão
  if (staffRoleIds.length === 0) {
    const { data: fallbackRoles } = await supabase
      .from("tenant_roles")
      .select("discord_role_id")
      .eq("tenant_id", tenant.id)
      .or(
        "can_manage_app.eq.true,can_manage_permissions.eq.true,can_manage_store.eq.true,can_manage_stock.eq.true,can_manage_resources.eq.true,can_manage_protection.eq.true"
      );
    staffRoleIds = [
      ...new Set((fallbackRoles || []).map((r) => r.discord_role_id).filter(Boolean)),
    ];
  }

  // Adicionar cargos com permissão Administrador no servidor
  try {
    const guildRoles = await guild.roles.fetch();
    const adminRoleIds = [...guildRoles.filter((r) => r.permissions.has("Administrator")).keys()];
    return new Set([...staffRoleIds, ...adminRoleIds]);
  } catch {
    return new Set(staffRoleIds);
  }
}

module.exports = async function onMemberRoleUpdate(client, oldMember, newMember) {
  try {
    if (newMember.user.bot) return;

    const oldRoleIds = new Set(oldMember.roles.cache.keys());
    const newRoleIds = new Set(newMember.roles.cache.keys());

    // Detecta cargos adicionados
    const addedRoles = [...newRoleIds].filter((id) => !oldRoleIds.has(id));
    if (addedRoles.length === 0) return;

    const tenant = await client.resolveTenant(newMember.guild.id);
    if (!tenant) return;

    const effectiveStaffRoleIds = await getEffectiveStaffRoleIds(tenant, newMember.guild);
    const becameStaff = addedRoles.some((id) => effectiveStaffRoleIds.has(id));
    if (!becameStaff) return;

    // Buscar tickets abertos do tenant
    const { data: openTickets } = await supabase
      .from("tickets")
      .select("id, discord_channel_id")
      .eq("tenant_id", tenant.id)
      .eq("status", "open");

    if (!openTickets?.length) return;

    let added = 0;
    for (const t of openTickets) {
      if (!t.discord_channel_id) continue;
      try {
        const ch = await newMember.guild.channels.fetch(t.discord_channel_id);
        if (!ch || ch.archived) continue;
        const existing = await ch.members.fetch();
        if (existing.has(newMember.user.id)) continue;
        await ch.members.add(newMember.user.id);
        added += 1;
      } catch {}
    }

    if (added > 0) {
      console.log(
        `[STAFF_SYNC] ${newMember.user.username} adicionado automaticamente a ${added} ticket(s) abertos do tenant ${tenant.name}.`
      );
    }
  } catch (err) {
    console.error("[memberRoleUpdate] Error:", err.message);
  }
};
