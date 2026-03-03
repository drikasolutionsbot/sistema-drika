import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Upload, Palette, Users, CreditCard, QrCode, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/contexts/TenantContext";
import PixGeneratorDialog from "@/components/pix/PixGeneratorDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

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
      <div>
        <h1 className="font-display text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Personalize seu painel</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="bg-muted">
          <TabsTrigger value="branding"><Palette className="mr-2 h-4 w-4" /> Marca</TabsTrigger>
          <TabsTrigger value="pix"><QrCode className="mr-2 h-4 w-4" /> PIX</TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" /> Usuários</TabsTrigger>
          <TabsTrigger value="plan"><CreditCard className="mr-2 h-4 w-4" /> Plano</TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <form onSubmit={handleSaveBranding} className="rounded-xl border border-border bg-card p-6 space-y-6">
            <h3 className="font-display font-semibold">White-label</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome da Loja</Label>
                <Input name="name" defaultValue={tenant.name} className="bg-muted border-none" />
              </div>
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Button type="button" variant="outline" size="sm">Upload</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor Primária</Label>
                <div className="flex gap-2">
                  <div className="h-10 w-10 rounded-lg gradient-pink" />
                  <Input name="primary_color" defaultValue={tenant.primary_color} className="bg-muted border-none font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor Secundária</Label>
                <div className="flex gap-2">
                  <div className="h-10 w-10 rounded-lg gradient-gold" />
                  <Input name="secondary_color" defaultValue={tenant.secondary_color} className="bg-muted border-none font-mono" />
                </div>
              </div>
            </div>
            <Button type="submit" className="gradient-pink text-primary-foreground border-none hover:opacity-90">Salvar</Button>
          </form>
        </TabsContent>

        {/* PIX Tab */}
        <TabsContent value="pix">
          <div className="space-y-6">
            {/* Static PIX Key */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <QrCode className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold">Chave PIX Estática</h3>
                  <p className="text-sm text-muted-foreground">
                    Usada para gerar QR Code e PIX copia e cola nos produtos
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de Chave</Label>
                  <Select value={pixKeyType} onValueChange={setPixKeyType}>
                    <SelectTrigger className="bg-muted border-none">
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
                  <Label>Chave PIX</Label>
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
                      className="bg-muted border-none font-mono"
                    />
                    {pixKey && (
                      <Button type="button" variant="outline" size="icon" onClick={copyPixKey} title="Copiar">
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {pixKey && pixKeyType && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400">
                    Chave PIX configurada — QR Code será gerado automaticamente nos produtos
                  </span>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={handleSavePix}
                  disabled={savingPix}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {savingPix && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar Chave PIX
                </Button>
                {pixKey && pixKeyType && (
                  <PixGeneratorDialog
                    trigger={
                      <Button variant="outline">
                        <QrCode className="h-4 w-4 mr-2" /> Testar QR Code
                      </Button>
                    }
                  />
                )}
              </div>
            </div>

            {/* Payment Gateways */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              <div>
                <h3 className="font-display font-semibold">Gateways de Pagamento</h3>
                <p className="text-sm text-muted-foreground">
                  Ative gateways para gerar PIX dinâmico com valor e expiração automáticos
                </p>
              </div>

              {providersLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : providers.length === 0 ? (
                <div className="rounded-lg bg-muted p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    Nenhum gateway configurado ainda.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Configure seus gateways na página de{" "}
                    <a href="/payments" className="text-primary hover:underline">Pagamentos</a>
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {providers.map(p => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background text-xs font-bold uppercase">
                          {p.provider_key.slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">{p.provider_key.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.api_key_encrypted ? "Credenciais configuradas" : "Sem credenciais"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={p.active ? "default" : "secondary"} className="text-xs">
                          {p.active ? "Ativo" : "Inativo"}
                        </Badge>
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
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h3 className="font-display font-semibold">Usuários e Permissões</h3>
              <Button variant="outline" size="sm">Convidar</Button>
            </div>
            {rolesLoading ? (
              <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
            ) : (
              <div className="divide-y divide-border">
                {userRoles.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-pink text-xs font-bold text-primary-foreground">
                        {(u.profiles?.discord_username || "?")[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{u.profiles?.discord_username || "Usuário"}</span>
                    </div>
                    <Select defaultValue={u.role}>
                      <SelectTrigger className="w-32 bg-muted border-none"><SelectValue /></SelectTrigger>
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
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="font-display font-semibold">Plano Atual</h3>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gradient-pink capitalize">{tenant.plan || "Free"}</p>
                  <p className="text-sm text-muted-foreground">Plano atual</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">Ativo</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;