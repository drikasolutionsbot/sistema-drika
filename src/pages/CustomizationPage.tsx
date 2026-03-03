import { useState, useEffect } from "react";
import { Palette, Loader2, Sparkles, Bot, Zap, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/contexts/TenantContext";
import EmbedBuilder from "@/components/customization/EmbedBuilder";

const CustomizationPage = () => {
  const { tenant, tenantId, refetch } = useTenant();
  const [status, setStatus] = useState("");
  const [interval, setStatusInterval] = useState("30");
  const [prefix, setPrefix] = useState("d!");
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (tenant) {
      setStatus((tenant as any).bot_status || "/panel");
      setStatusInterval(String((tenant as any).bot_status_interval || 30));
      setPrefix((tenant as any).bot_prefix || "d!");
    }
  }, [tenant]);

  const botName = tenant?.name || "Drika Bot";
  const botId = tenant?.bot_client_id || "000000000000000000";

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
      toast.success("Configurações salvas com sucesso!");
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
      <div>
        <div className="flex items-center gap-3">
          <Palette className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Personalização</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Configure o <span className="font-semibold text-foreground">{botName}</span> para o seu estilo.
        </p>
      </div>

      {/* Bot Showcase Banner — non-editable, visually rich */}
      <div className="relative rounded-xl overflow-hidden border border-border bg-card">
        {/* Gradient background with animated accent */}
        <div className="h-36 relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-accent/15">
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-8 h-24 w-24 rounded-full bg-primary/30 blur-3xl" />
            <div className="absolute bottom-2 right-12 h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
            <div className="absolute top-6 right-1/3 h-16 w-16 rounded-full bg-primary/20 blur-2xl" />
          </div>
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* Feature pills */}
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
        {/* Bot identity */}
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
              <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-green-500 border-2 border-card" />
            </div>
            <div className="pb-1 flex-1">
              <h2 className="text-lg font-bold text-foreground">{botName}</h2>
              <p className="text-xs text-muted-foreground font-mono">Bot ID: {botId}</p>
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
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Intervalo de Status (segundos)</label>
                <Input
                  type="number"
                  value={interval}
                  onChange={(e) => setStatusInterval(e.target.value)}
                  className="bg-background border-border font-mono"
                />
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="p-5 space-y-4 bg-sidebar border-border">
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <span className="h-5 w-1 rounded-full bg-primary inline-block" />
                    Informações
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Dados da aplicação.</p>
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
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className="text-sm font-semibold text-green-500">Online</span>
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
                </div>
              </Card>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleSaveConfig} disabled={savingConfig}>
              {savingConfig && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Configurações
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
