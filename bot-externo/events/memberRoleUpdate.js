// Detecta quando um membro ganha cargo de staff. Tickets novos usam permissões por cargo,
// então não adicionamos membros individualmente para evitar mensagens de sistema no Discord.
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

    console.log(
      `[STAFF_SYNC] ${newMember.user.username} agora possui cargo de staff no tenant ${tenant.name}; acesso aos tickets é herdado por permissões de cargo.`
    );
  } catch (err) {
    console.error("[memberRoleUpdate] Error:", err.message);
  }
};
