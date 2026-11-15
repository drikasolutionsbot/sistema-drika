import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Eye, EyeOff, MessageSquare, Loader2, RefreshCw, Hash, Save,
  ChevronDown, ChevronRight, Minus, Check, X, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DiscordChannel {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
}

interface DiscordCategory {
  id: string;
  name: string;
  position: number;
}

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

interface PermOverwrite {
  id: string;
  type: number;
  allow: string;
  deny: string;
}

type PermState = "allow" | "deny" | "neutral";

const PERM_BITS: Record<string, bigint> = {
  view_channel: BigInt(1) << BigInt(10),
  send_messages: BigInt(1) << BigInt(11),
  read_message_history: BigInt(1) << BigInt(16),
  add_reactions: BigInt(1) << BigInt(6),
  attach_files: BigInt(1) << BigInt(15),
  embed_links: BigInt(1) << BigInt(14),
};

const PERM_LABELS: Record<string, { label: string; icon: typeof Eye }> = {
  view_channel: { label: "Ver Canal", icon: Eye },
  send_messages: { label: "Enviar Mensagens", icon: MessageSquare },
};

function getPermState(allow: string, deny: string, bit: bigint): PermState {
  const a = BigInt(allow || "0");
  const d = BigInt(deny || "0");
  if ((a & bit) !== BigInt(0)) return "allow";
  if ((d & bit) !== BigInt(0)) return "deny";
  return "neutral";
}

const colorToHex = (color: number) =>
  color === 0 ? "#99AAB5" : `#${color.toString(16).padStart(6, "0")}`;

const PermToggle = ({
  state,
  onChange,
  label,
}: {
  state: PermState;
  onChange: (s: PermState) => void;
  label: string;
}) => {
  const cycle = () => {
    if (state === "neutral") onChange("allow");
    else if (state === "allow") onChange("deny");
    else onChange("neutral");
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={cycle}
            className={cn(
              "h-8 w-8 rounded-md flex items-center justify-center transition-all border",
              state === "allow" && "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
              state === "deny" && "bg-red-500/20 border-red-500/40 text-red-400",
              state === "neutral" && "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
            )}
          >
            {state === "allow" && <Check className="h-4 w-4" />}
            {state === "deny" && <X className="h-4 w-4" />}
            {state === "neutral" && <Minus className="h-3.5 w-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}: {state === "allow" ? "✅ Permitido" : state === "deny" ? "❌ Negado" : "➖ Herdar"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ChannelPermissionsTab = ({
  discordChannels,
  discordCategories,
}: {
  discordChannels: DiscordChannel[];
  discordCategories: DiscordCategory[];
}) => {
  const { tenant, tenantId } = useTenant();
  const guildId = tenant?.discord_guild_id;

  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [overwrites, setOverwrites] = useState<PermOverwrite[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [saving, setSaving] = useState(false);

  // Draft: { roleId: { view_channel: "allow"|"deny"|"neutral", send_messages: ... } }
  const [draft, setDraft] = useState<Record<string, Record<string, PermState>>>({});
  const [originalDraft, setOriginalDraft] = useState<Record<string, Record<string, PermState>>>({});

  // Fetch Discord roles
  useEffect(() => {
    if (!tenantId || !guildId) return;
    setLoadingRoles(true);
    supabase.functions
      .invoke("discord-guild-info", { body: { tenant_id: tenantId } })
      .then(({ data, error }) => {
        if (!error && data?.roles) {
          const filtered = (data.roles as DiscordRole[])
            .filter((r) => r.name !== "@everyone" && !r.managed)
            .sort((a, b) => b.position - a.position);
          setRoles(filtered);
        }
      })
      .finally(() => setLoadingRoles(false));
  }, [tenantId, guildId]);

  // Fetch overwrites for selected channel
  const fetchOverwrites = useCallback(async () => {
    if (!selectedChannel || !tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-channel-permissions", {
        body: { action: "get", tenant_id: tenantId, channel_id: selectedChannel },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const ows: PermOverwrite[] = data.overwrites || [];
      setOverwrites(ows);

      // Build draft from current overwrites
      const newDraft: Record<string, Record<string, PermState>> = {};
      for (const role of roles) {
        const ow = ows.find((o) => o.id === role.id && o.type === 0);
        const perms: Record<string, PermState> = {};
        for (const [key, bit] of Object.entries(PERM_BITS)) {
          if (key in PERM_LABELS) {
            perms[key] = ow ? getPermState(ow.allow, ow.deny, bit) : "neutral";
          }
        }
        newDraft[role.id] = perms;
      }
      setDraft(newDraft);
      setOriginalDraft(JSON.parse(JSON.stringify(newDraft)));
    } catch (err: any) {
      toast({ title: "Erro ao carregar permissões", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedChannel, tenantId, roles]);

  useEffect(() => {
    fetchOverwrites();
  }, [fetchOverwrites]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(originalDraft);
  }, [draft, originalDraft]);

  const updatePerm = (roleId: string, permKey: string, state: PermState) => {
    setDraft((prev) => ({
      ...prev,
      [roleId]: { ...prev[roleId], [permKey]: state },
    }));
  };

  const handleSave = async () => {
    if (!tenantId || !selectedChannel) return;
    setSaving(true);
    try {
      // Build overwrites array from draft
      const owList = Object.entries(draft)
        .filter(([roleId, perms]) => {
          // Only include roles that have non-neutral permissions
          return Object.values(perms).some((v) => v !== "neutral");
        })
        .map(([roleId, perms]) => ({ role_id: roleId, permissions: perms }));

      // Also include roles that were changed to all neutral (to delete their overwrite)
      const allNeutral = Object.entries(draft)
        .filter(([roleId, perms]) => {
          const orig = originalDraft[roleId];
          const wasSet = orig && Object.values(orig).some((v) => v !== "neutral");
          const nowNeutral = Object.values(perms).every((v) => v === "neutral");
          return wasSet && nowNeutral;
        })
        .map(([roleId, perms]) => ({ role_id: roleId, permissions: perms }));

      const allOverwrites = [...owList, ...allNeutral];

      const { data, error } = await supabase.functions.invoke("manage-channel-permissions", {
        body: { action: "update", tenant_id: tenantId, channel_id: selectedChannel, overwrites: allOverwrites },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Permissões atualizadas! ✅" });
      setOriginalDraft(JSON.parse(JSON.stringify(draft)));
    } catch (err: any) {
      toast({ title: "Erro ao salvar permissões", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const channelsByCategory = useMemo(() => {
    const groups: { label: string; channels: DiscordChannel[] }[] = [];
    const sorted = [...discordCategories].sort((a, b) => a.position - b.position);
    sorted.forEach((cat) => {
      const chans = discordChannels.filter((ch) => ch.parent_id === cat.id).sort((a, b) => a.position - b.position);
      if (chans.length > 0) groups.push({ label: cat.name, channels: chans });
    });
    const uncategorized = discordChannels.filter((ch) => !ch.parent_id).sort((a, b) => a.position - b.position);
    if (uncategorized.length > 0) groups.unshift({ label: "Sem Categoria", channels: uncategorized });
    return groups;
  }, [discordChannels, discordCategories]);

  const selectedChannelName = discordChannels.find((c) => c.id === selectedChannel)?.name;

  return (
    <div className="space-y-5">
      {/* Channel selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <div className="w-full sm:flex-1 sm:min-w-[250px] max-w-md">
          <Select value={selectedChannel || undefined} onValueChange={setSelectedChannel}>
            <SelectTrigger className="h-10">
              <div className="flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Selecione um canal para configurar" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {channelsByCategory.map((group) => (
                <div key={group.label}>
                  <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                    {group.label}
                  </div>
                  {group.channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      # {ch.name}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedChannel && (
          <Button variant="outline" size="sm" onClick={fetchOverwrites} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Recarregar
          </Button>
        )}
      </div>

      {/* Save bar */}
      {hasChanges && (
        <div className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 rounded-xl border border-primary/30 bg-primary/5 backdrop-blur-md px-4 sm:px-5 py-3">
          <p className="text-xs sm:text-sm text-foreground font-medium">
            Alterações em #{selectedChannelName} não salvas
          </p>
          <div className="flex gap-2 self-end sm:self-auto">
            <Button variant="ghost" size="sm" onClick={() => setDraft(JSON.parse(JSON.stringify(originalDraft)))}>
              <X className="h-4 w-4 mr-1.5" /> Descartar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* No channel selected */}
      {!selectedChannel && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Shield className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">
            Selecione um canal acima para configurar as permissões por cargo
          </p>
        </div>
      )}

      {/* Loading */}
      {selectedChannel && (loading || loadingRoles) && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      )}

      {/* Roles permissions grid */}
      {selectedChannel && !loading && !loadingRoles && roles.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 bg-muted/30 border-b border-border">
            <div className="flex-1 text-sm font-medium text-foreground">Cargo</div>
            {Object.entries(PERM_LABELS).map(([key, { label, icon: Icon }]) => (
              <div key={key} className="w-24 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Role rows */}
          {roles.map((role) => {
            const rolePerms = draft[role.id] || {};
            const hasOverwrite = Object.values(rolePerms).some((v) => v !== "neutral");

            return (
              <div
                key={role.id}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 border-b border-border/50 last:border-0 transition-colors",
                  hasOverwrite ? "bg-muted/20" : "hover:bg-muted/10"
                )}
              >
                <div className="flex-1 flex items-center gap-2.5 min-w-0">
                  <div
                    className="h-3.5 w-3.5 rounded-full shrink-0 border border-border/50"
                    style={{ backgroundColor: colorToHex(role.color) }}
                  />
                  <span className="text-sm font-medium truncate">{role.name}</span>
                  {hasOverwrite && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                      Personalizado
                    </Badge>
                  )}
                </div>

                {Object.entries(PERM_LABELS).map(([key, { label }]) => (
                  <div key={key} className="w-24 flex justify-center">
                    <PermToggle
                      state={rolePerms[key] || "neutral"}
                      onChange={(s) => updatePerm(role.id, key, s)}
                      label={label}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {selectedChannel && !loading && (
        <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Check className="h-3 w-3 text-emerald-400" />
            </div>
            Permitir
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <X className="h-3 w-3 text-red-400" />
            </div>
            Negar
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded bg-muted/30 border border-border flex items-center justify-center">
              <Minus className="h-3 w-3 text-muted-foreground" />
            </div>
            Herdar (padrão do servidor)
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelPermissionsTab;
