import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Upload, Paintbrush, Users, Crown, QrCode, Loader2, Copy, CheckCircle2, UserPlus, Sparkles, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useTenant } from "@/contexts/TenantContext";
import PixGeneratorDialog from "@/components/pix/PixGeneratorDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import "@/components/wallet/wallet-card.css";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  profiles: { discord_username: string | null; avatar_url: string | null } | null;
}

const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave Aleatória" },
];

const SettingsPage = () => {
  const { tenant, tenantId, refetch: refetchTenant } = useTenant();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "branding";
  const { user } = useAuth();

  // PIX state
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("");
  const [savingPix, setSavingPix] = useState(false);
  const [pixLoaded, setPixLoaded] = useState(false);

  // Load PIX data from tenant
  if (tenant && !pixLoaded) {
    setPixKey((tenant as any).pix_key || "");
    setPixKeyType((tenant as any).pix_key_type || "");
    setPixLoaded(true);
  }

  const { data: userRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await (supabase as any)
        .from("user_roles")
        .select("id, user_id, role, profiles:user_id(discord_username, avatar_url)")
        .eq("tenant_id", tenantId);
      return (data ?? []) as UserRole[];
    },
    enabled: !!tenantId,
  });

  // Payment providers for this tenant
  const { data: providers = [], isLoading: providersLoading, refetch: refetchProviders } = useQuery({
    queryKey: ["payment-providers", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("payment_providers")
        .select("*")
        .eq("tenant_id", tenantId);
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const handleSaveBranding = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tenantId) return;
    const form = new FormData(e.currentTarget);
    await (supabase as any).from("tenants").update({
      name: form.get("name"),
      primary_color: form.get("primary_color"),
      secondary_color: form.get("secondary_color"),
    }).eq("id", tenantId);
    refetchTenant();
    toast({ title: "Configurações salvas" });
  };

  const handleSavePix = async () => {
    if (!tenantId) return;
    setSavingPix(true);
    try {
      const { error } = await (supabase as any)
        .from("tenants")
        .update({
          pix_key: pixKey.trim() || null,
          pix_key_type: pixKeyType || null,
        })
        .eq("id", tenantId);
      if (error) throw error;
      refetchTenant();
      toast({ title: "Chave PIX salva com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSavingPix(false);
    }
  };

  const toggleProvider = async (providerId: string, currentActive: boolean) => {
    await supabase
      .from("payment_providers")
      .update({ active: !currentActive })
      .eq("id", providerId);
    refetchProviders();
  };

  const copyPixKey = () => {
    if (pixKey) {
      navigator.clipboard.writeText(pixKey);
      toast({ title: "Chave PIX copiada!" });
    }
  };

  if (!tenant) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with gradient bg */}
      <div className="relative rounded-2xl overflow-hidden p-6 pb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/5" />
        <div className="absolute inset-0 border border-primary/10 rounded-2xl" />
        <div className="relative">
          <h1 className="font-display text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Personalize seu painel</p>
        </div>

        <Tabs defaultValue={defaultTab} className="relative mt-5">
          <TabsList className="bg-muted/60 backdrop-blur-sm border border-border/50 p-1 h-auto gap-1">
            <TabsTrigger value="branding" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-4 py-2">
              <Paintbrush className="h-4 w-4" /> Marca
            </TabsTrigger>
            <TabsTrigger value="pix" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-4 py-2">
              <QrCode className="h-4 w-4" /> PIX
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-4 py-2">
              <Users className="h-4 w-4" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="plan" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-4 py-2">
              <Crown className="h-4 w-4" /> Plano
            </TabsTrigger>
          </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <div className="wallet-section">
            <div className="wallet-section-header mb-5">
              <div className="wallet-section-icon">
                <Paintbrush className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-white font-display font-semibold text-sm">White-label</h3>
                <p className="text-[11px] text-white/30 mt-0.5">Personalize a identidade visual da sua loja</p>
              </div>
            </div>
            <form onSubmit={handleSaveBranding} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs uppercase tracking-wider">Nome da Loja</Label>
                  <Input name="name" defaultValue={tenant.name} className="wallet-input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs uppercase tracking-wider">Logo</Label>
                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-white/5">
                      <Upload className="h-5 w-5 text-white/30" />
                    </div>
                    <Button type="button" variant="outline" size="sm" className="border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white">Upload</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs uppercase tracking-wider">Cor Primária</Label>
                  <div className="flex gap-2 items-center">
                    <label className="relative h-10 w-10 rounded-lg flex-shrink-0 cursor-pointer overflow-hidden border border-white/10" style={{ backgroundColor: tenant.primary_color || '#FF69B4' }}>
                      <input
                        type="color"
                        name="primary_color_picker"
                        defaultValue={tenant.primary_color || '#FF69B4'}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        onChange={(e) => {
                          const input = e.target.closest('form')?.querySelector<HTMLInputElement>('input[name="primary_color"]');
                          if (input) { input.value = e.target.value; }
                          (e.target.parentElement as HTMLElement).style.backgroundColor = e.target.value;
                        }}
                      />
                    </label>
                    <Input name="primary_color" defaultValue={tenant.primary_color} className="wallet-input font-mono" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs uppercase tracking-wider">Cor Secundária</Label>
                  <div className="flex gap-2 items-center">
                    <label className="relative h-10 w-10 rounded-lg flex-shrink-0 cursor-pointer overflow-hidden border border-white/10" style={{ backgroundColor: tenant.secondary_color || '#00d019' }}>
                      <input
                        type="color"
                        name="secondary_color_picker"
                        defaultValue={tenant.secondary_color || '#00d019'}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        onChange={(e) => {
                          const input = e.target.closest('form')?.querySelector<HTMLInputElement>('input[name="secondary_color"]');
                          if (input) { input.value = e.target.value; }
                          (e.target.parentElement as HTMLElement).style.backgroundColor = e.target.value;
                        }}
                      />
                    </label>
                    <Input name="secondary_color" defaultValue={tenant.secondary_color} className="wallet-input font-mono" />
                  </div>
                </div>
              </div>
              <Button type="submit" className="gradient-pink text-primary-foreground border-none hover:opacity-90">Salvar</Button>
            </form>
          </div>
        </TabsContent>

        {/* PIX Tab */}
        <TabsContent value="pix">
          <div className="space-y-6">
            {/* Static PIX Key */}
            <div className="wallet-section">
              <div className="wallet-section-header mb-5">
                <div className="wallet-section-icon">
                  <QrCode className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-white font-display font-semibold text-sm">Chave PIX Estática</h3>
                  <p className="text-[11px] text-white/30 mt-0.5">Usada para gerar QR Code e PIX copia e cola nos produtos</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs uppercase tracking-wider">Tipo de Chave</Label>
                  <Select value={pixKeyType} onValueChange={setPixKeyType}>
                    <SelectTrigger className="wallet-input">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {PIX_KEY_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs uppercase tracking-wider">Chave PIX</Label>
                  <div className="flex gap-2">
                    <Input
                      value={pixKey}
                      onChange={e => setPixKey(e.target.value)}
                      placeholder={
                        pixKeyType === "cpf" ? "000.000.000-00" :
                        pixKeyType === "cnpj" ? "00.000.000/0000-00" :
                        pixKeyType === "email" ? "email@exemplo.com" :
                        pixKeyType === "telefone" ? "+5511999999999" :
                        "Cole sua chave aleatória"
                      }
                      className="wallet-input font-mono"
                    />
                    {pixKey && (
                      <Button type="button" size="icon" onClick={copyPixKey} title="Copiar" className="border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white flex-shrink-0">
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {pixKey && pixKeyType && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 mt-4">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400">
                    Chave PIX configurada — QR Code será gerado automaticamente nos produtos
                  </span>
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <Button
                  onClick={handleSavePix}
                  disabled={savingPix}
                  className="gradient-pink text-primary-foreground border-none hover:opacity-90"
                >
                  {savingPix && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar Chave PIX
                </Button>
                {pixKey && pixKeyType && (
                  <PixGeneratorDialog
                    trigger={
                      <Button className="border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white">
                        <QrCode className="h-4 w-4 mr-2" /> Testar QR Code
                      </Button>
                    }
                  />
                )}
              </div>
            </div>

            {/* Payment Gateways */}
            <div className="wallet-section">
              <div className="wallet-section-header mb-5">
                <div className="wallet-section-icon">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-white font-display font-semibold text-sm">Gateways de Pagamento</h3>
                  <p className="text-[11px] text-white/30 mt-0.5">Ative gateways para gerar PIX dinâmico com valor e expiração automáticos</p>
                </div>
              </div>

              {providersLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl bg-white/5" />)}
                </div>
              ) : providers.length === 0 ? (
                <div className="rounded-xl bg-white/5 border border-white/8 p-6 text-center">
                  <p className="text-sm text-white/40 mb-2">Nenhum gateway configurado ainda.</p>
                  <p className="text-xs text-white/25">
                    Configure seus gateways na página de{" "}
                    <a href="/payments" className="text-primary hover:underline">Pagamentos</a>
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {providers.map(p => (
                    <div key={p.id} className="wallet-tx-row">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-xs font-bold uppercase text-white/70">
                          {p.provider_key.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white capitalize">{p.provider_key.replace(/_/g, " ")}</p>
                          <p className="text-[11px] text-white/30">
                            {p.api_key_encrypted ? "Credenciais configuradas" : "Sem credenciais"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`wallet-tx-badge ${p.active ? "completed" : "pending"}`}>
                          {p.active ? "Ativo" : "Inativo"}
                        </span>
                        <Switch
                          checked={p.active}
                          onCheckedChange={() => toggleProvider(p.id, p.active)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <div className="wallet-section">
            <div className="flex items-center justify-between mb-5">
              <div className="wallet-section-header">
                <div className="wallet-section-icon">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-white font-display font-semibold text-sm">Usuários e Permissões</h3>
                  <p className="text-[11px] text-white/30 mt-0.5">Gerencie os acessos ao painel</p>
                </div>
              </div>
              <Button size="sm" className="gap-2 border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white">
                <UserPlus className="h-3.5 w-3.5" /> Convidar
              </Button>
            </div>
            {rolesLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl bg-white/5" />)}</div>
            ) : (
              <div className="space-y-2">
                {userRoles.map(u => (
                  <div key={u.id} className="wallet-tx-row">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-pink text-xs font-bold text-white">
                        {(u.profiles?.discord_username || "?")[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-white">{u.profiles?.discord_username || "Usuário"}</span>
                    </div>
                    <Select defaultValue={u.role}>
                      <SelectTrigger className="w-32 wallet-input text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Plan Tab */}
        <TabsContent value="plan">
          <div className="wallet-section">
            <div className="wallet-section-header mb-5">
              <div className="wallet-section-icon">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-white font-display font-semibold text-sm">Plano Atual</h3>
                <p className="text-[11px] text-white/30 mt-0.5">Detalhes da sua assinatura</p>
              </div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/8 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-gradient-pink capitalize">{tenant.plan || "Free"}</p>
                  <p className="text-xs text-white/30 mt-1">Plano ativo</p>
                </div>
                <span className="wallet-tx-badge completed">Ativo</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl bg-white/5 border border-white/8 p-4 text-center">
                <p className="text-lg font-bold text-white">∞</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Produtos</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/8 p-4 text-center">
                <p className="text-lg font-bold text-white">∞</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Vendas</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/8 p-4 text-center">
                <p className="text-lg font-bold text-white">24/7</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">Suporte</p>
              </div>
            </div>
          </div>
        </TabsContent>

      </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;