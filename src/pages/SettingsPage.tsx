import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Upload, Users, Crown, QrCode, Loader2, Copy, CheckCircle2, UserPlus, Sparkles, Zap, Shield, HelpCircle, ChevronDown, User, Bot, Palette, LayoutTemplate, Trash2, Database, HardDrive, Plug } from "lucide-react";
import EfiIntegrationTab from "@/components/admin/EfiIntegrationTab";
import PushinPayIntegrationTab from "@/components/admin/PushinPayIntegrationTab";
import AbacatePayIntegrationTab from "@/components/admin/AbacatePayIntegrationTab";
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
import SettingsPlanTab from "@/components/settings/SettingsPlanTab";
import SettingsProfileTab from "@/components/settings/SettingsProfileTab";

import EmbedBuilder from "@/components/customization/EmbedBuilder";

import SettingsBotCustomizationTab from "@/components/settings/SettingsBotCustomizationTab";
import abacatePayIcon from "@/assets/abacatepay-icon.png";
import misticPayIcon from "@/assets/misticpay-icon.png";
import efiIcon from "@/assets/efi-icon.png";
import mercadoPagoIcon from "@/assets/mercadopago-icon.png";
import pushinPayIcon from "@/assets/pushinpay-icon.png";

const PROVIDER_META: Record<string, { name: string; icon: string }> = {
  abacatepay: { name: "AbacatePay", icon: abacatePayIcon },
  misticpay: { name: "Mistic Pay", icon: misticPayIcon },
  efi: { name: "Efí", icon: efiIcon },
  mercadopago: { name: "Mercado Pago", icon: mercadoPagoIcon },
  pushinpay: { name: "PushinPay", icon: pushinPayIcon },
};

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
  const defaultTab = searchParams.get("tab") || "profile";
  const { user } = useAuth();

  // PIX state with draft persistence
  const [savingPix, setSavingPix] = useState(false);
  const [editingPix, setEditingPix] = useState(false);

  const pixStorageKey = tenantId ? `draft:${tenantId}:pix-config` : null;
  const pixInitialized = useRef(false);
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("");

  // Initialize PIX from localStorage or tenant
  useEffect(() => {
    if (!tenant || pixInitialized.current) return;
    pixInitialized.current = true;
    try {
      const saved = pixStorageKey ? localStorage.getItem(pixStorageKey) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        setPixKey(parsed.pixKey || "");
        setPixKeyType(parsed.pixKeyType || "");
      } else {
        setPixKey(tenant.pix_key || "");
        setPixKeyType(tenant.pix_key_type || "");
      }
    } catch {
      setPixKey(tenant.pix_key || "");
      setPixKeyType(tenant.pix_key_type || "");
    }
    setEditingPix(false);
  }, [tenant?.pix_key, tenant?.pix_key_type, pixStorageKey]);

  // Auto-save PIX draft
  useEffect(() => {
    if (!pixStorageKey || !pixInitialized.current) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(pixStorageKey, JSON.stringify({ pixKey, pixKeyType })); } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [pixKey, pixKeyType, pixStorageKey]);

  const clearPixDraft = useCallback(() => {
    if (pixStorageKey) localStorage.removeItem(pixStorageKey);
  }, [pixStorageKey]);

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

  // Payment providers for this tenant (via edge function to bypass RLS for token auth)
  const { data: providers = [], isLoading: providersLoading, refetch: refetchProviders } = useQuery({
    queryKey: ["payment-providers", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.functions.invoke("manage-payment-providers", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });




  const handleSavePix = async () => {
    if (!tenantId) return;
    setSavingPix(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            pix_key: pixKey.trim() || null,
            pix_key_type: pixKeyType || null,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      clearPixDraft();
      toast({ title: "Chave PIX salva com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSavingPix(false);
    }
  };

  const toggleProvider = async (providerId: string, currentActive: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-payment-providers", {
        body: { action: "toggle", tenant_id: tenantId, provider_id: providerId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      refetchProviders();
    } catch (err: any) {
      toast({ title: "Erro ao alternar gateway", description: err.message, variant: "destructive" });
    }
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
          <div className="overflow-x-auto -mx-6 px-6 scrollbar-none">
            <TabsList className="bg-muted/60 backdrop-blur-sm border border-border/50 p-1 h-auto gap-1 w-max min-w-full sm:w-auto">
              <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-3 sm:px-4 py-2 text-xs sm:text-sm">
                <User className="h-4 w-4" /> Perfil
              </TabsTrigger>
              <TabsTrigger value="pix" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-3 sm:px-4 py-2 text-xs sm:text-sm">
                <QrCode className="h-4 w-4" /> PIX
              </TabsTrigger>
              <TabsTrigger value="plan" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-3 sm:px-4 py-2 text-xs sm:text-sm">
                <Crown className="h-4 w-4" /> Plano
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-md px-3 sm:px-4 py-2 text-xs sm:text-sm">
                <HardDrive className="h-4 w-4" /> Avançado
              </TabsTrigger>
            </TabsList>
          </div>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <SettingsProfileTab tenant={tenant} tenantId={tenantId} />
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
                  <h3 className="text-foreground font-display font-semibold text-sm">Chave PIX Estática</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Usada para gerar QR Code e PIX copia e cola nos produtos</p>
                </div>
              </div>

              {/* Como funciona */}
              <details className="group rounded-xl border border-border bg-muted/30 overflow-hidden">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  Como funciona o PIX Estático?
                  <ChevronDown className="h-4 w-4 ml-auto transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 space-y-3 text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
                  <p>
                    Com o <span className="text-foreground font-medium">PIX Estático</span>, um QR Code é gerado automaticamente para cada pedido usando sua chave cadastrada. O cliente escaneia e paga normalmente.
                  </p>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <p><span className="text-foreground font-medium">Entregas automáticas</span> — se o produto estiver configurado com entrega automática, o estoque será enviado assim que você aprovar o pagamento.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <p><span className="text-foreground font-medium">Aprovação manual</span> — como o PIX estático não possui webhook, a confirmação do pagamento é feita manualmente pela aba <span className="text-foreground font-medium">Aprovações</span> no painel ou pelos botões no Discord.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Zap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <p><span className="text-foreground font-medium">Quer aprovação automática?</span> — configure um gateway de pagamento (Mercadopago, Efí ou PushinPay) na seção abaixo para receber confirmações instantâneas via webhook.</p>
                  </div>
                </div>
              </details>

              {/* Active PIX display */}
              {tenant?.pix_key && tenant?.pix_key_type && !editingPix ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-emerald-400">Chave PIX ativa</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {PIX_KEY_TYPES.find(t => t.value === tenant.pix_key_type)?.label || tenant.pix_key_type}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted/50 border border-border px-4 py-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Chave cadastrada</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm text-foreground flex-1 truncate">{tenant.pix_key}</p>
                      <Button type="button" size="icon" variant="ghost" onClick={copyPixKey} title="Copiar" className="text-muted-foreground hover:text-foreground h-8 w-8 shrink-0">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => setEditingPix(true)}
                      variant="outline"
                    >
                      Editar chave
                    </Button>
                    <Button
                      onClick={async () => {
                        setSavingPix(true);
                        try {
                          const { data: d, error: e } = await supabase.functions.invoke("update-tenant", {
                            body: { tenant_id: tenantId, updates: { pix_key: null, pix_key_type: null } },
                          });
                          if (e) throw e;
                          if (d?.error) throw new Error(d.error);
                          await refetchTenant();
                          toast({ title: "Chave PIX desativada" });
                        } catch (err: any) {
                          toast({ title: "Erro", description: err.message, variant: "destructive" });
                        } finally {
                          setSavingPix(false);
                        }
                      }}
                      disabled={savingPix}
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      Desativar
                    </Button>
                    <PixGeneratorDialog
                      trigger={
                        <Button variant="outline">
                          <QrCode className="h-4 w-4 mr-2" /> Testar QR Code
                        </Button>
                      }
                    />
                  </div>
                </div>
              ) : (
                /* Edit / Create form */
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Tipo de Chave</Label>
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
                      <Label className="text-muted-foreground text-xs uppercase tracking-wider">Chave PIX</Label>
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
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleSavePix}
                      disabled={savingPix || !pixKey.trim() || !pixKeyType}
                      className="gradient-pink text-primary-foreground border-none hover:opacity-90"
                    >
                      {savingPix && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Salvar Chave PIX
                    </Button>
                    {editingPix && (
                      <Button
                        onClick={() => {
                          setPixKey(tenant?.pix_key || "");
                          setPixKeyType(tenant?.pix_key_type || "");
                          setEditingPix(false);
                        }}
                        variant="outline"
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Payment Gateways */}
            <div className="wallet-section">
              <div className="wallet-section-header mb-5">
                <div className="wallet-section-icon">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-foreground font-display font-semibold text-sm">Gateways de Pagamento</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Ative gateways para gerar PIX dinâmico com valor e expiração automáticos</p>
                </div>
              </div>

              {providersLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
              ) : providers.length === 0 ? (
                <div className="rounded-xl bg-muted/50 border border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Nenhum gateway configurado ainda.</p>
                  <p className="text-xs text-muted-foreground/60">
                    Configure seus gateways na página de{" "}
                    <a href="/payments" className="text-primary hover:underline">Pagamentos</a>
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {providers.map(p => (
                    <div key={p.id} className="wallet-tx-row">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted overflow-hidden">
                          {PROVIDER_META[p.provider_key]?.icon ? (
                            <img src={PROVIDER_META[p.provider_key].icon} alt={PROVIDER_META[p.provider_key].name} className="h-7 w-7 object-contain" />
                          ) : (
                            <span className="text-xs font-bold uppercase text-muted-foreground">{p.provider_key.slice(0, 2)}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{PROVIDER_META[p.provider_key]?.name ?? p.provider_key.replace(/_/g, " ")}</p>
                          <p className="text-[11px] text-muted-foreground">
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

              <a
                href="/payments"
                className="flex items-center justify-center gap-2 mt-4 rounded-xl border border-dashed border-border bg-muted/30 hover:bg-muted/60 transition-colors px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
              >
                <Zap className="h-4 w-4" />
                Configurar outros gateways
              </a>
            </div>
          </div>
        </TabsContent>


        {/* Plan Tab */}
        <TabsContent value="plan">
          <SettingsPlanTab tenant={tenant} tenantId={tenantId} refetchTenant={refetchTenant} />
        </TabsContent>

        {/* Advanced Tab - Cache */}
        <TabsContent value="advanced">
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div>
                <h3 className="text-lg font-semibold">Limpeza de Cache</h3>
                <p className="text-sm text-muted-foreground mt-1">Resolva conflitos de dados, sessões obsoletas ou bugs visuais limpando o cache do navegador.</p>
              </div>

              <div className="space-y-3">
                {/* Clear drafts */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                      <Trash2 className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Limpar Rascunhos</p>
                      <p className="text-xs text-muted-foreground">Remove rascunhos salvos localmente (formulários não enviados)</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    const keysToRemove: string[] = [];
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i);
                      if (key && key.startsWith("draft:")) keysToRemove.push(key);
                    }
                    keysToRemove.forEach(k => localStorage.removeItem(k));
                    toast({ title: `${keysToRemove.length} rascunho(s) removido(s) ✅` });
                  }}>
                    Limpar
                  </Button>
                </div>

                {/* Clear tenant cache */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                      <Database className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Limpar Cache do Servidor</p>
                      <p className="text-xs text-muted-foreground">Remove dados em cache do servidor/tenant atual</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    const keysToRemove: string[] = [];
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i);
                      if (key && tenantId && key.includes(tenantId)) keysToRemove.push(key);
                    }
                    keysToRemove.forEach(k => localStorage.removeItem(k));
                    toast({ title: `Cache do servidor limpo (${keysToRemove.length} itens) ✅` });
                  }}>
                    Limpar
                  </Button>
                </div>

                {/* Full reset */}
                <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                      <HardDrive className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Limpeza Total</p>
                      <p className="text-xs text-muted-foreground">Remove localStorage, sessionStorage e Cache API. Recarrega a página.</p>
                    </div>
                  </div>
                  <Button variant="destructive" size="sm" onClick={async () => {
                    localStorage.clear();
                    sessionStorage.clear();
                    if ("caches" in window) {
                      const names = await caches.keys();
                      await Promise.all(names.map(n => caches.delete(n)));
                    }
                    toast({ title: "Cache total limpo ✅ Recarregando..." });
                    setTimeout(() => window.location.reload(), 800);
                  }}>
                    Limpar Tudo
                  </Button>
                </div>
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