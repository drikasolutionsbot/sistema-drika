import { useState } from "react";
import { Bot, Server, Check, Loader2, Package, RefreshCw, Wifi, WifiOff, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface Props {
  tenant: any;
  tenantId: string | null;
  refetchTenant: () => void;
}

interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

const SettingsBotExternoTab = ({ tenant, tenantId, refetchTenant }: Props) => {
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [botPrefix, setBotPrefix] = useState(tenant?.bot_prefix || "!");
  const [botStatus, setBotStatus] = useState(tenant?.bot_status || "online");

  // Fetch available guilds from the bot
  const { data: guilds = [], isLoading: guildsLoading, refetch: refetchGuilds } = useQuery({
    queryKey: ["bot-guilds", tenantId],
    queryFn: async () => {
      const tokenSession = sessionStorage.getItem("token_session");
      const body: any = { tenant_id: tenantId };
      if (tokenSession) {
        try { body.token = JSON.parse(tokenSession).token; } catch {}
      }
      const { data, error } = await supabase.functions.invoke("discord-bot-guilds", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const guildList = Array.isArray(data) ? data : (data?.guilds ?? []);
      return guildList as Guild[];
    },
    enabled: !!tenantId,
  });

  // Fetch products linked to this tenant
  const { data: products = [], isLoading: productsLoading, refetch: refetchProducts } = useQuery({
    queryKey: ["bot-products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.functions.invoke("manage-products", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const handleConnectGuild = async (guild: Guild) => {
    if (!tenantId) return;
    setConnecting(guild.id);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: { discord_guild_id: guild.id },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      await refetchGuilds();
      toast({ title: `Conectado ao servidor ${guild.name}! ✅` });
    } catch (err: any) {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async () => {
    if (!tenantId) return;
    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: { discord_guild_id: null },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      await refetchGuilds();
      toast({ title: "Servidor desconectado" });
    } catch (err: any) {
      toast({ title: "Erro ao desconectar", description: err.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            bot_prefix: botPrefix.trim() || "!",
            bot_status: botStatus,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      toast({ title: "Configurações salvas! ✅" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isConnected = !!tenant?.discord_guild_id;
  const safeGuilds = Array.isArray(guilds) ? guilds : [];
  const connectedGuild = safeGuilds.find((g) => g.id === tenant?.discord_guild_id);
  const activeProducts = products.filter((p: any) => p.active);
  const totalStock = products.reduce((sum: number, p: any) => sum + (p.stock || 0), 0);

  return (
    <div className="space-y-6">
      {/* Server Connection */}
      <div className="wallet-section">
        <div className="wallet-section-header mb-5">
          <div className="wallet-section-icon">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-display font-semibold text-sm">Conectar Servidor</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Selecione o servidor onde o bot está presente para vincular ao seu painel
            </p>
          </div>
          {!isConnected && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetchGuilds()}
              className="ml-auto h-8 w-8"
              title="Atualizar lista"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Connected state */}
        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-emerald-500/10 border border-emerald-500/20">
              <Wifi className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {connectedGuild?.icon ? (
                  <img src={connectedGuild.icon} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {(connectedGuild?.name || "S").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-emerald-400 truncate">
                    {connectedGuild?.name || "Servidor conectado"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                    ID: {tenant.discord_guild_id}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5 mr-1.5" />}
                Desconectar
              </Button>
            </div>
          </div>
        ) : (
          /* Server picker */
          <div className="space-y-3">
            {guildsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            ) : guilds.length === 0 ? (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-5 text-center">
                <WifiOff className="h-8 w-8 text-amber-400/60 mx-auto mb-2" />
                <p className="text-sm font-medium text-amber-400">Nenhum servidor encontrado</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Certifique-se de que o bot foi adicionado ao seu servidor Discord e que você é o dono do servidor.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchGuilds()}
                  className="mt-3"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Servidores disponíveis onde o bot está presente ({guilds.length}):
                </p>
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {guilds.map((guild) => (
                    <div
                      key={guild.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors px-4 py-3"
                    >
                      {guild.icon ? (
                        <img src={guild.icon} alt="" className="h-10 w-10 rounded-full shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                          {guild.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{guild.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{guild.id}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleConnectGuild(guild)}
                        disabled={connecting === guild.id}
                        className="gradient-pink text-primary-foreground border-none hover:opacity-90 shrink-0"
                      >
                        {connecting === guild.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Wifi className="h-3.5 w-3.5 mr-1.5" />
                            Conectar
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bot Settings (only shown when connected) */}
      {isConnected && (
        <div className="wallet-section">
          <div className="wallet-section-header mb-5">
            <div className="wallet-section-icon">
              <Server className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-foreground font-display font-semibold text-sm">Configurações do Bot</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Prefixo e status de presença do bot externo
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Prefixo do Bot</Label>
              <Input
                value={botPrefix}
                onChange={(e) => setBotPrefix(e.target.value)}
                placeholder="!"
                className="font-mono w-24"
                maxLength={5}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Status do Bot</Label>
              <div className="flex gap-2 flex-wrap">
                {["online", "idle", "dnd", "invisible"].map((s) => (
                  <Button
                    key={s}
                    variant={botStatus === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBotStatus(s)}
                    className={botStatus === s ? "gradient-pink text-primary-foreground border-none" : ""}
                  >
                    <span className={`h-2 w-2 rounded-full mr-2 ${
                      s === "online" ? "bg-emerald-400" :
                      s === "idle" ? "bg-amber-400" :
                      s === "dnd" ? "bg-red-400" :
                      "bg-gray-400"
                    }`} />
                    {s === "online" ? "Online" : s === "idle" ? "Ausente" : s === "dnd" ? "Não Perturbe" : "Invisível"}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSaveSettings}
              disabled={saving}
              className="gradient-pink text-primary-foreground border-none hover:opacity-90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Salvar configurações
            </Button>
          </div>
        </div>
      )}

      {/* Products linked to this tenant */}
      {isConnected && (
        <div className="wallet-section">
          <div className="wallet-section-header mb-5">
            <div className="wallet-section-icon">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-foreground font-display font-semibold text-sm">Produtos visíveis pelo Bot</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Produtos que o bot exibe no Discord
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetchProducts()}
              className="ml-auto h-8 w-8"
              title="Atualizar"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-muted/50 border border-border px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-foreground">{products.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
            </div>
            <div className="rounded-xl bg-muted/50 border border-border px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">{activeProducts.length}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ativos</p>
            </div>
            <div className="rounded-xl bg-muted/50 border border-border px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-primary">{totalStock}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Estoque</p>
            </div>
          </div>

          {productsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl bg-muted/50 border border-border p-6 text-center">
              <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Crie produtos na aba <a href="/store" className="text-primary hover:underline">Loja</a> para que o bot exiba no Discord.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {products.map((p: any) => (
                <div key={p.id} className="wallet-tx-row">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.icon_url ? (
                      <img src={p.icon_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {p.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        R$ {((p.price_cents || 0) / 100).toFixed(2)} · Estoque: {p.stock ?? "∞"}
                      </p>
                    </div>
                  </div>
                  <span className={`wallet-tx-badge ${p.active ? "completed" : "pending"}`}>
                    {p.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <a
            href="/store"
            className="flex items-center justify-center gap-2 mt-4 rounded-xl border border-dashed border-border bg-muted/30 hover:bg-muted/60 transition-colors px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
          >
            <Package className="h-4 w-4" />
            Gerenciar produtos na Loja
          </a>
        </div>
      )}
    </div>
  );
};

export default SettingsBotExternoTab;
