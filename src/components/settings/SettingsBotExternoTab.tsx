import { useState } from "react";
import { Bot, Server, Check, AlertTriangle, Loader2, Package, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface Props {
  tenant: any;
  tenantId: string | null;
  refetchTenant: () => void;
}

const SettingsBotExternoTab = ({ tenant, tenantId, refetchTenant }: Props) => {
  const [saving, setSaving] = useState(false);
  const [guildId, setGuildId] = useState(tenant?.discord_guild_id || "");
  const [botPrefix, setBotPrefix] = useState(tenant?.bot_prefix || "!");
  const [botStatus, setBotStatus] = useState(tenant?.bot_status || "online");

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

  const handleSave = async () => {
    if (!tenantId) return;
    const trimmedGuild = guildId.trim();

    if (trimmedGuild && !/^\d{17,20}$/.test(trimmedGuild)) {
      toast({ title: "ID inválido", description: "O Guild ID deve conter 17-20 dígitos.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            discord_guild_id: trimmedGuild || null,
            bot_prefix: botPrefix.trim() || "!",
            bot_status: botStatus,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      toast({ title: "Configurações do bot salvas! ✅" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isConnected = !!tenant?.discord_guild_id;
  const activeProducts = products.filter((p: any) => p.active);
  const totalStock = products.reduce((sum: number, p: any) => sum + (p.stock || 0), 0);

  return (
    <div className="space-y-6">
      {/* Bot Connection Status */}
      <div className="wallet-section">
        <div className="wallet-section-header mb-5">
          <div className="wallet-section-icon">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-display font-semibold text-sm">Bot Externo</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Configure o bot Discord que roda externamente e lê dados deste Supabase
            </p>
          </div>
        </div>

        {/* Connection status badge */}
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-5 ${
          isConnected 
            ? "bg-emerald-500/10 border border-emerald-500/20" 
            : "bg-amber-500/10 border border-amber-500/20"
        }`}>
          {isConnected ? (
            <>
              <Wifi className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-400">Bot vinculado ao servidor</p>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                  Guild ID: {tenant.discord_guild_id}
                </p>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-400">Nenhum servidor vinculado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Informe o Guild ID para que o bot externo identifique este tenant
                </p>
              </div>
            </>
          )}
        </div>

        {/* Guild ID */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Discord Guild ID</Label>
            <Input
              value={guildId}
              onChange={(e) => setGuildId(e.target.value)}
              placeholder="Cole o ID do servidor Discord (ex: 123456789012345678)"
              className="font-mono"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              O bot externo usa este ID para identificar o servidor e carregar as configurações corretas.
            </p>
          </div>

          {/* Bot Prefix */}
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

          {/* Bot Status */}
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
            onClick={handleSave}
            disabled={saving}
            className="gradient-pink text-primary-foreground border-none hover:opacity-90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Salvar configurações
          </Button>
        </div>
      </div>

      {/* Products linked to this tenant (read by bot) */}
      <div className="wallet-section">
        <div className="wallet-section-header mb-5">
          <div className="wallet-section-icon">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-display font-semibold text-sm">Produtos visíveis pelo Bot</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              O bot externo lê estes produtos da tabela <code className="bg-muted px-1 rounded text-[10px]">products</code> filtrado por <code className="bg-muted px-1 rounded text-[10px]">tenant_id</code>
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

        {/* Quick stats */}
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

      {/* How it works */}
      <div className="wallet-section">
        <div className="wallet-section-header mb-4">
          <div className="wallet-section-icon">
            <Server className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-display font-semibold text-sm">Como funciona</h3>
          </div>
        </div>

        <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
          <div className="flex items-start gap-2">
            <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
            <p>O <span className="text-foreground font-medium">painel web</span> (este sistema) salva todas as configurações no Supabase: produtos, preços, estoque, guild ID, etc.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
            <p>O <span className="text-foreground font-medium">bot externo</span> (rodando 24h em VPS) lê essas configurações via Supabase SDK, filtrando por <code className="bg-muted px-1 rounded">discord_guild_id</code>.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
            <p>O bot exibe produtos, processa vendas e envia entregas no Discord, sempre usando os dados mais recentes do banco.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsBotExternoTab;
