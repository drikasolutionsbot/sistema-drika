import { useState, useEffect } from "react";
import { Loader2, Save, RefreshCw, PackagePlus, Hash, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
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
}

interface RestockConfigTabProps {
  discordChannels: DiscordChannel[];
  discordCategories: DiscordCategory[];
  loadingChannels: boolean;
}

interface RestockConfig {
  restock_channel_id: string | null;
  restock_embed_color: string;
  restock_embed_title: string;
  restock_embed_description: string;
  restock_embed_footer: string;
  restock_embed_image_url: string;
  restock_embed_thumbnail_url: string;
  restock_mention_role_id: string | null;
}

const DEFAULT_CONFIG: RestockConfig = {
  restock_channel_id: null,
  restock_embed_color: "#57F287",
  restock_embed_title: "🔄 RESTOCK! O produto {product} acabou de receber novos itens!",
  restock_embed_description: "Corra para garantir o seu antes que acabe!",
  restock_embed_footer: "",
  restock_embed_image_url: "",
  restock_embed_thumbnail_url: "",
  restock_mention_role_id: null,
};

export default function RestockConfigTab({ discordChannels, discordCategories, loadingChannels }: RestockConfigTabProps) {
  const { tenantId, tenant } = useTenant();
  const [config, setConfig] = useState<RestockConfig>({ ...DEFAULT_CONFIG });
  const [originalConfig, setOriginalConfig] = useState<RestockConfig>({ ...DEFAULT_CONFIG });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // Channel select - canal salvo em channel_configs (key: restock_channel)
  const [restockChannelConfigId, setRestockChannelConfigId] = useState<string | null>(null);

  // Load existing config
  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      setLoading(true);
      try {
        // Load store_configs fields
        const { data: sc } = await supabase
          .from("store_configs" as any)
          .select("restock_channel_id, restock_embed_color, restock_embed_title, restock_embed_description, restock_embed_footer, restock_embed_image_url, restock_embed_thumbnail_url, restock_mention_role_id")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        // Load channel_configs for restock_channel key
        const { data: cc } = await supabase
          .from("channel_configs")
          .select("discord_channel_id")
          .eq("tenant_id", tenantId)
          .eq("channel_key", "restock_channel")
          .maybeSingle();

        const loaded: RestockConfig = {
          restock_channel_id: cc?.discord_channel_id || (sc as any)?.restock_channel_id || null,
          restock_embed_color: (sc as any)?.restock_embed_color || DEFAULT_CONFIG.restock_embed_color,
          restock_embed_title: (sc as any)?.restock_embed_title || DEFAULT_CONFIG.restock_embed_title,
          restock_embed_description: (sc as any)?.restock_embed_description || DEFAULT_CONFIG.restock_embed_description,
          restock_embed_footer: (sc as any)?.restock_embed_footer || "",
          restock_embed_image_url: (sc as any)?.restock_embed_image_url || "",
          restock_embed_thumbnail_url: (sc as any)?.restock_embed_thumbnail_url || "",
          restock_mention_role_id: (sc as any)?.restock_mention_role_id || null,
        };
        setConfig(loaded);
        setOriginalConfig(loaded);
        if (cc?.discord_channel_id) setRestockChannelConfigId(cc.discord_channel_id);
      } catch (e) {
        console.error("Failed to load restock config:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenantId]);

  // Load Discord roles
  useEffect(() => {
    const guildId = tenant?.discord_guild_id;
    if (!guildId) return;
    setLoadingRoles(true);
    supabase.functions.invoke("discord-channels", { body: { guild_id: guildId } })
      .then(({ data }) => { setRoles(data?.roles || []); })
      .catch(() => {})
      .finally(() => setLoadingRoles(false));
  }, [tenant?.discord_guild_id]);

  const channelsByCategory = (() => {
    const groups: { label: string; channels: DiscordChannel[] }[] = [];
    const sorted = [...discordCategories].sort((a, b) => a.position - b.position);
    sorted.forEach(cat => {
      const chans = discordChannels.filter(ch => ch.parent_id === cat.id).sort((a, b) => a.position - b.position);
      if (chans.length > 0) groups.push({ label: cat.name, channels: chans });
    });
    const uncategorized = discordChannels.filter(ch => !ch.parent_id).sort((a, b) => a.position - b.position);
    if (uncategorized.length > 0) groups.unshift({ label: "Sem Categoria", channels: uncategorized });
    return groups;
  })();

  const hasChanges = JSON.stringify(config) !== JSON.stringify(originalConfig);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      // Save store_configs fields (embed customization + mention role)
      await supabase.functions.invoke("manage-store-config", {
        body: {
          action: "upsert",
          tenant_id: tenantId,
          config: {
            restock_embed_color: config.restock_embed_color,
            restock_embed_title: config.restock_embed_title,
            restock_embed_description: config.restock_embed_description,
            restock_embed_footer: config.restock_embed_footer,
            restock_embed_image_url: config.restock_embed_image_url,
            restock_embed_thumbnail_url: config.restock_embed_thumbnail_url,
            restock_mention_role_id: config.restock_mention_role_id,
          },
        },
      });

      // Save channel in channel_configs (key: restock_channel)
      if (config.restock_channel_id !== originalConfig.restock_channel_id) {
        await supabase.functions.invoke("manage-channel-configs", {
          body: {
            tenant_id: tenantId,
            channels: { restock_channel: config.restock_channel_id },
          },
        });
      }

      setOriginalConfig({ ...config });
      toast({ title: "Configurações de Restock salvas! ✅" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Live embed preview color
  const previewColor = config.restock_embed_color || "#57F287";

  const VARIABLES_HINT = "Variáveis: {product} = nome do produto · {qty} = quantidade adicionada · {total_stock} = estoque total";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-lime-500/20 bg-lime-500/5">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-lime-500/10 border border-lime-500/20">
          <PackagePlus className="h-5 w-5 text-lime-400" />
        </div>
        <div>
          <p className="font-semibold text-sm">Canal de Restock</p>
          <p className="text-xs text-muted-foreground">Quando um produto receber novo estoque, o bot envia automaticamente um embed neste canal.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Config form */}
        <div className="space-y-5">
          {/* Canal */}
          <div className="rounded-xl border border-white/5 bg-card/40 p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Hash className="h-4 w-4 text-lime-400" /> Canal & Menção
            </h3>

            <div className="space-y-1.5">
              <Label className="text-xs">Canal de Restock</Label>
              <Select
                value={config.restock_channel_id || ""}
                onValueChange={(v) => setConfig(prev => ({ ...prev, restock_channel_id: v === "__clear__" ? null : v }))}
              >
                <SelectTrigger className={cn("h-9 text-sm", config.restock_channel_id ? "border-lime-500/30 bg-lime-500/10 text-lime-400" : "border-white/10")}>
                  <div className="flex items-center gap-1.5 truncate">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Selecionar canal..." />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {config.restock_channel_id && (
                    <SelectItem value="__clear__" className="text-red-400">✕ Remover canal</SelectItem>
                  )}
                  {channelsByCategory.map(group => (
                    <SelectGroup key={group.label}>
                      <SelectLabel className="text-xs text-muted-foreground uppercase">{group.label}</SelectLabel>
                      {group.channels.map(ch => (
                        <SelectItem key={ch.id} value={ch.id}># {ch.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                  {channelsByCategory.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-3">Sincronize os canais primeiro</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <AtSign className="h-3.5 w-3.5 text-muted-foreground" /> Mencionar Cargo (opcional)
              </Label>
              <Select
                value={config.restock_mention_role_id || "none"}
                onValueChange={(v) => setConfig(prev => ({ ...prev, restock_mention_role_id: v === "none" ? null : v }))}
              >
                <SelectTrigger className="h-9 text-sm border-white/10">
                  <SelectValue placeholder="Nenhum cargo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (sem menção)</SelectItem>
                  {roles.filter(r => r.name !== "@everyone").sort((a, b) => b.position - a.position).map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      <span style={{ color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : undefined }}>
                        @{r.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">O bot vai @mencionar este cargo junto com o embed de restock.</p>
            </div>
          </div>

          {/* Embed customização */}
          <div className="rounded-xl border border-white/5 bg-card/40 p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <PackagePlus className="h-4 w-4 text-lime-400" /> Personalização do Embed
            </h3>

            <div className="space-y-1.5">
              <Label className="text-xs">Cor da Barra Lateral</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.restock_embed_color}
                  onChange={(e) => setConfig(prev => ({ ...prev, restock_embed_color: e.target.value }))}
                  className="h-9 w-12 rounded-md border border-white/10 bg-background cursor-pointer p-1"
                />
                <Input
                  value={config.restock_embed_color}
                  onChange={(e) => setConfig(prev => ({ ...prev, restock_embed_color: e.target.value }))}
                  className="h-9 font-mono text-sm flex-1 border-white/10"
                  placeholder="#57F287"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input
                value={config.restock_embed_title}
                onChange={(e) => setConfig(prev => ({ ...prev, restock_embed_title: e.target.value }))}
                className="h-9 text-sm border-white/10"
                placeholder="🔄 RESTOCK! O produto {product} acabou de receber novos itens!"
              />
              <p className="text-[11px] text-muted-foreground">{VARIABLES_HINT}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input
                value={config.restock_embed_description}
                onChange={(e) => setConfig(prev => ({ ...prev, restock_embed_description: e.target.value }))}
                className="h-9 text-sm border-white/10"
                placeholder="Corra para garantir o seu antes que acabe!"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Footer (opcional)</Label>
              <Input
                value={config.restock_embed_footer}
                onChange={(e) => setConfig(prev => ({ ...prev, restock_embed_footer: e.target.value }))}
                className="h-9 text-sm border-white/10"
                placeholder="Ex: Minha Loja • Restock Automático"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">URL da Thumbnail (opcional)</Label>
              <Input
                value={config.restock_embed_thumbnail_url}
                onChange={(e) => setConfig(prev => ({ ...prev, restock_embed_thumbnail_url: e.target.value }))}
                className="h-9 text-sm border-white/10"
                placeholder="https://..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">URL da Imagem (opcional)</Label>
              <Input
                value={config.restock_embed_image_url}
                onChange={(e) => setConfig(prev => ({ ...prev, restock_embed_image_url: e.target.value }))}
                className="h-9 text-sm border-white/10"
                placeholder="https://..."
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving || !hasChanges} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Configurações
          </Button>
        </div>

        {/* Right — Embed Preview */}
        <div className="space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">Preview do Embed</p>
          <div className="rounded-xl border border-white/5 bg-[#313338] p-4 font-sans">
            {/* Bot avatar + name mockup */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-lime-500/20 border border-lime-500/30 flex items-center justify-center">
                <PackagePlus className="h-4 w-4 text-lime-400" />
              </div>
              <span className="text-white text-sm font-semibold">Bot da Loja</span>
              <span className="text-xs bg-[#5865F2] text-white rounded px-1 py-0.5 font-bold">APP</span>
            </div>

            {/* Embed */}
            <div
              className="rounded-r-md border-l-4 pl-3 py-3 pr-3 bg-[#2b2d31] space-y-2"
              style={{ borderColor: previewColor }}
            >
              <p className="text-white font-bold text-sm leading-snug">
                {(config.restock_embed_title || "🔄 RESTOCK! O produto {product} acabou de receber novos itens!")
                  .replace("{product}", "Minecraft Premium")
                  .replace("{qty}", "4")
                  .replace("{total_stock}", "16")}
              </p>
              {config.restock_embed_description && (
                <p className="text-[#dbdee1] text-xs">{config.restock_embed_description}</p>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                <div>
                  <p className="text-[#b5bac1] text-[10px] font-bold uppercase">🔑 • Campo</p>
                  <p className="text-[#dbdee1] text-xs font-mono bg-[#1e1f22] rounded px-1.5 py-0.5 inline-block">Nitrada Mensal</p>
                </div>
                <div>
                  <p className="text-[#b5bac1] text-[10px] font-bold uppercase">📦 • Adicionados</p>
                  <p className="text-[#dbdee1] text-xs font-mono bg-[#1e1f22] rounded px-1.5 py-0.5 inline-block">4x</p>
                </div>
                <div>
                  <p className="text-[#b5bac1] text-[10px] font-bold uppercase">📊 • Estoque total</p>
                  <p className="text-[#dbdee1] text-xs font-mono bg-[#1e1f22] rounded px-1.5 py-0.5 inline-block">16x</p>
                </div>
                <div>
                  <p className="text-[#b5bac1] text-[10px] font-bold uppercase">🕐 • Data</p>
                  <p className="text-[#dbdee1] text-xs">terça-feira, 10 de setembro de 2026 20:41</p>
                </div>
              </div>

              {config.restock_embed_footer && (
                <p className="text-[#87898c] text-[10px] pt-1 border-t border-white/5">{config.restock_embed_footer}</p>
              )}
            </div>

            {/* Button mockup */}
            <div className="mt-2">
              <button className="flex items-center gap-1.5 rounded-sm bg-[#4e5058] hover:bg-[#6d6f78] px-3 py-1.5 text-white text-xs font-medium transition-colors">
                🛒 Comprar Agora 
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-lime-500/10 bg-lime-500/5 p-3 space-y-1">
            <p className="text-xs font-semibold text-lime-400">ℹ️ Como funciona</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Detecta automaticamente quando qualquer produto recebe estoque</li>
              <li>Agrupa múltiplos itens adicionados em 3s (sem spam)</li>
              <li>Mostra: produto, campo/variante, qtd adicionada e total</li>
              <li>Botão "Comprar Agora" aparece se a loja tiver URL configurada</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
