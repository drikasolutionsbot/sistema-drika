import { useState, useEffect, useCallback } from "react";
import { Palette, Loader2, Sparkles, Bot, Zap, Shield, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/contexts/TenantContext";
import EmbedBuilder from "@/components/customization/EmbedBuilder";

const CustomizationPage = () => {
  const { tenant, tenantId, refetch } = useTenant();
  const [status, setStatus] = useState("");
  const [interval, setStatusInterval] = useState("30");
  const [prefix, setPrefix] = useState("d!");
  const [savingConfig, setSavingConfig] = useState(false);
  const [botOnline, setBotOnline] = useState<boolean | null>(null);
  const [checkingBot, setCheckingBot] = useState(false);
  const [guildInfo, setGuildInfo] = useState<{ name: string; member_count: number; presence_count: number; icon: string | null } | null>(null);

  useEffect(() => {
    if (tenant) {
      setStatus((tenant as any).bot_status || "/panel");
      setStatusInterval(String((tenant as any).bot_status_interval || 30));
      setPrefix((tenant as any).bot_prefix || "d!");
    }
  }, [tenant]);

  const botName = tenant?.name || "Drika Bot";
  const botId = tenant?.discord_guild_id || "000000000000000000";

  // Check bot status from Discord API
  const checkBotStatus = useCallback(async () => {
    if (!tenant?.discord_guild_id) {
      setBotOnline(false);
      return;
    }
    try {
      const { data: guild, error } = await supabase.functions.invoke("discord-guild-info", {
        body: { guild_id: tenant.discord_guild_id },
      });
      if (!error && guild && !guild.error) {
        setGuildInfo(guild);
        setBotOnline(true);
      } else {
        setBotOnline(false);
      }
    } catch {
      setBotOnline(false);
    }
  }, [tenant?.discord_guild_id]);

  // Initial check + polling every 30s
  useEffect(() => {
    checkBotStatus();
    const iv = setInterval(checkBotStatus, 30000);
    return () => clearInterval(iv);
  }, [checkBotStatus]);

  // Realtime subscription for tenant changes
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`customization-tenant-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tenants", filter: `id=eq.${tenantId}` },
        (payload) => {
          const row = payload.new as any;
          setStatus(row.bot_status || "/panel");
          setStatusInterval(String(row.bot_status_interval || 30));
          setPrefix(row.bot_prefix || "d!");
          refetch();
          toast.info("🔄 Configurações atualizadas em tempo real");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, refetch]);

  const handleRefreshBot = async () => {
    setCheckingBot(true);
    await checkBotStatus();
    setCheckingBot(false);
  };

  const handleSaveConfig = async () => {
    if (!tenantId) return;
    setSavingConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            bot_status: status,
            bot_status_interval: parseInt(interval) || 30,
            bot_prefix: prefix,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Configurações salvas e sincronizadas!");
      refetch();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "Tente novamente"));
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Palette className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl font-bold">Personalização</h1>
            {botOnline !== null && (
              <Badge variant={botOnline ? "default" : "destructive"} className="gap-1.5">
                <span className={`h-2 w-2 rounded-full ${botOnline ? "bg-emerald-400 animate-pulse" : "bg-destructive-foreground"}`} />
                {botOnline ? "Online" : "Offline"}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Configure o <span className="font-semibold text-foreground">{botName}</span> para o seu estilo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 hidden sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">Realtime</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefreshBot} disabled={checkingBot} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${checkingBot ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Verificar</span>
          </Button>
        </div>
      </div>

      {/* Bot Showcase Banner */}
      <div className="relative rounded-xl overflow-hidden border border-border bg-card">
        <div className="h-36 relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-accent/15">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-8 h-24 w-24 rounded-full bg-primary/30 blur-3xl" />
            <div className="absolute bottom-2 right-12 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
            <div className="absolute top-6 right-1/3 h-16 w-16 rounded-full bg-primary/20 blur-2xl" />
          </div>
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute top-4 right-4 flex gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-sm border border-border text-[11px] font-medium text-muted-foreground">
              <Zap className="h-3 w-3 text-primary" /> Automações
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-sm border border-border text-[11px] font-medium text-muted-foreground">
              <Shield className="h-3 w-3 text-primary" /> Proteção
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 backdrop-blur-sm border border-border text-[11px] font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> Loja
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card via-card/95 to-transparent px-6 pb-4 pt-14">
          <div className="flex items-end gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-sidebar border-4 border-card flex items-center justify-center overflow-hidden shadow-lg shadow-primary/10">
                {tenant?.logo_url ? (
                  <img src={tenant.logo_url} alt={botName} className="h-full w-full object-cover" />
                ) : (
                  <Bot className="h-7 w-7 text-primary" />
                )}
              </div>
              <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card ${botOnline ? "bg-green-500" : botOnline === false ? "bg-destructive" : "bg-muted"}`} />
            </div>
            <div className="pb-1 flex-1">
              <h2 className="text-lg font-bold text-foreground">{botName}</h2>
              <p className="text-xs text-muted-foreground font-mono">Server ID: {botId}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral">
        <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start px-0 gap-4">
          <TabsTrigger
            value="geral"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent px-1 pb-2"
          >
            Geral
          </TabsTrigger>
          <TabsTrigger
            value="embeds"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent px-1 pb-2"
          >
            Embeds
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 space-y-5 bg-sidebar border-border">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <span className="h-5 w-1 rounded-full bg-primary inline-block" />
                  Status
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">Configurações de status do bot.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Status (um por linha)</label>
                <Textarea
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  rows={4}
                  className="bg-background border-border resize-none font-mono text-sm"
                  placeholder={"/panel\nDrika Solutions\nOnline"}
                />
                <p className="text-xs text-muted-foreground">
                  O bot alternará entre esses status a cada <strong>{interval}s</strong>.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Intervalo de Status (segundos)</label>
                <Input
                  type="number"
                  value={interval}
                  onChange={(e) => setStatusInterval(e.target.value)}
                  className="bg-background border-border font-mono"
                  min={10}
                />
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="p-5 space-y-4 bg-sidebar border-border">
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-primary inline-block" />
                    Informações do Servidor
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Dados em tempo real do Discord.</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Nome da Aplicação</span>
                    <span className="text-sm font-semibold text-foreground">{botName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">ID da Aplicação</span>
                    <span className="text-sm font-mono text-foreground">{botId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status do Bot</span>
                    <span className={`text-sm font-semibold flex items-center gap-1.5 ${botOnline ? "text-emerald-500" : botOnline === false ? "text-destructive" : "text-muted-foreground"}`}>
                      {botOnline ? <Wifi className="h-3.5 w-3.5" /> : botOnline === false ? <WifiOff className="h-3.5 w-3.5" /> : null}
                      {botOnline === null ? "Verificando..." : botOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                  {guildInfo && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Servidor</span>
                        <span className="text-sm font-semibold text-foreground">{guildInfo.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Membros</span>
                        <span className="text-sm text-foreground">
                          {guildInfo.member_count.toLocaleString("pt-BR")} total · <span className="text-emerald-500">{guildInfo.presence_count} online</span>
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Guild ID</span>
                    <span className="text-xs font-mono text-muted-foreground">{tenant?.discord_guild_id || "—"}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-4 bg-sidebar border-border">
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-primary inline-block" />
                    Prefixo
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Prefixo para comandos do bot.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Prefixo do Bot</label>
                  <Input
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="bg-background border-border font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Exemplo: <code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono">{prefix}help</code>
                  </p>
                </div>
              </Card>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleSaveConfig} disabled={savingConfig}>
              {savingConfig && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar e Sincronizar
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="embeds" className="mt-6">
          <EmbedBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomizationPage;
