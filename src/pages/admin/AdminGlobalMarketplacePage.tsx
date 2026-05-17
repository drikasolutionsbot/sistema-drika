import { useEffect, useState } from "react";
import { Globe, Check, X, ExternalLink, Loader2, Settings, Plus, Trash2, Hash, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_CATEGORIES = ["Contas", "Serviços", "Bots", "Outros"];

interface Listing {
  id: string;
  product_id: string;
  tenant_id: string;
  global_status: string;
  category_global: string | null;
  rejection_reason: string | null;
  submitted_at: string;
  total_sales: number;
  total_revenue_cents: number;
  products: { name: string; icon_url: string | null; banner_url: string | null; price_cents: number; description: string | null; type: string };
  tenants: { name: string; plan: string; email?: string | null; whatsapp?: string | null; owner_discord_username?: string | null; owner_discord_id?: string | null; pix_key?: string | null; pix_key_type?: string | null };
}

const AdminGlobalMarketplacePage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("pending");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [approveTarget, setApproveTarget] = useState<Listing | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Listing | null>(null);
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  // Config
  const [config, setConfig] = useState<any>(null);
  const [channels, setChannels] = useState<{ id: string; name: string; parent_id: string | null }[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const fetchListings = async (status: string) => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("manage-global-marketplace", {
      body: { action: "list_all", status },
    });
    setLoading(false);
    if (Array.isArray(data)) setListings(data);
  };

  const fetchConfig = async () => {
    const { data } = await supabase.functions.invoke("manage-global-marketplace", {
      body: { action: "get_config" },
    });
    setConfig(data);
  };

  const fetchChannels = async (guildId: string) => {
    if (!guildId || guildId.length < 10) {
      setChannels([]);
      return;
    }
    setLoadingChannels(true);
    const { data, error } = await supabase.functions.invoke("discord-channels", {
      body: { guild_id: guildId },
    });
    setLoadingChannels(false);
    if (error || data?.error) {
      setChannels([]);
      toast({ title: "Erro ao listar canais", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    setChannels(data?.channels || []);
  };

  useEffect(() => {
    if (tab === "config") fetchConfig();
    else fetchListings(tab);
  }, [tab]);

  useEffect(() => { fetchConfig(); }, []);

  useEffect(() => {
    if (config?.global_marketplace_guild_id) {
      fetchChannels(config.global_marketplace_guild_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.global_marketplace_guild_id]);

  const approve = async () => {
    if (!approveTarget) return;
    setActing(true);
    const { error, data } = await supabase.functions.invoke("manage-global-marketplace", {
      body: { action: "approve", listing_id: approveTarget.id, category_global: category, reviewer_id: user?.id },
    });
    setActing(false);
    if (error || data?.error) return toast({ title: "Erro", description: error?.message || data?.error, variant: "destructive" });
    toast({ title: "Produto aprovado! 🌍" });
    setApproveTarget(null);
    fetchListings(tab);
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setActing(true);
    const { error } = await supabase.functions.invoke("manage-global-marketplace", {
      body: { action: "reject", listing_id: rejectTarget.id, reason: rejectReason, reviewer_id: user?.id },
    });
    setActing(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Produto rejeitado" });
    setRejectTarget(null);
    setRejectReason("");
    fetchListings(tab);
  };

  const saveConfig = async () => {
    setActing(true);
    const { error } = await supabase.functions.invoke("manage-global-marketplace", {
      body: { action: "update_config", config },
    });
    setActing(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Configurações salvas" });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" /> Marketplace Global
        </h1>
        <p className="text-muted-foreground">Aprove produtos enviados pelos lojistas e configure o fluxo global.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovados</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
          <TabsTrigger value="config"><Settings className="h-3.5 w-3.5 mr-1" /> Configurações</TabsTrigger>
        </TabsList>

        {(["pending", "approved", "rejected"] as const).map((s) => (
          <TabsContent key={s} value={s} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : listings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto opacity-20 mb-2" />
                <p>Nenhum produto {s === "pending" ? "pendente" : s === "approved" ? "aprovado" : "rejeitado"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {listings.map((l) => (
                  <div key={l.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {l.products?.icon_url && (
                        <img src={l.products.icon_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{l.products?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">por {l.tenants?.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">R$ {((l.products?.price_cents || 0) / 100).toFixed(2)}</Badge>
                          <Badge variant="outline" className="text-xs">{l.tenants?.plan}</Badge>
                          {l.category_global && <Badge variant="outline" className="text-xs">{l.category_global}</Badge>}
                        </div>
                      </div>
                    </div>
                    {l.products?.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{l.products.description}</p>
                    )}
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 space-y-1 text-xs">
                      <p className="font-semibold text-foreground/80 uppercase tracking-wide text-[10px]">Identificação do vendedor</p>
                      {l.tenants?.owner_discord_username && (
                        <p><span className="text-muted-foreground">Discord:</span> {l.tenants.owner_discord_username}{l.tenants.owner_discord_id ? ` (${l.tenants.owner_discord_id})` : ""}</p>
                      )}
                      {l.tenants?.email && (<p><span className="text-muted-foreground">Email:</span> {l.tenants.email}</p>)}
                      {l.tenants?.whatsapp && (<p><span className="text-muted-foreground">WhatsApp:</span> {l.tenants.whatsapp}</p>)}
                      {l.tenants?.pix_key ? (
                        <p><span className="text-muted-foreground">PIX{l.tenants.pix_key_type ? ` (${l.tenants.pix_key_type})` : ""}:</span> <span className="font-mono">{l.tenants.pix_key}</span></p>
                      ) : (
                        <p className="text-destructive/80">⚠ Sem PIX cadastrado</p>
                      )}
                      <p className="text-muted-foreground pt-1">Tenant: <span className="font-mono">{l.tenant_id.slice(0, 8)}…</span></p>
                    </div>
                    {l.rejection_reason && (
                      <p className="text-xs text-destructive">Motivo: {l.rejection_reason}</p>
                    )}
                    {s === "approved" && (
                      <>
                        <p className="text-xs text-muted-foreground">{l.total_sales} vendas • R$ {(l.total_revenue_cents / 100).toFixed(2)}</p>
                        <Button size="sm" variant="outline" className="w-full" onClick={async () => {
                          const { data, error } = await supabase.functions.invoke("manage-global-marketplace", {
                            body: { action: "repost", listing_id: l.id },
                          });
                          if (error || data?.error) return toast({ title: "Erro", description: error?.message || data?.error, variant: "destructive" });
                          toast({ title: "Enviado para o Marketplace! 🌍" });
                        }}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reenviar para o Marketplace
                        </Button>
                      </>
                    )}
                    {s === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => { setApproveTarget(l); setCategory(DEFAULT_CATEGORIES[0]); }}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/30" onClick={() => setRejectTarget(l)}>
                          <X className="h-3.5 w-3.5 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}

        <TabsContent value="config" className="mt-4">
          {!config ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
          ) : (
            <div className="rounded-xl border border-border bg-card p-6 space-y-4 max-w-2xl">
              <div>
                <Label>Comissão SaaS (%)</Label>
                <Input
                  type="number" min={0} max={50}
                  value={config.global_marketplace_commission_percent}
                  onChange={(e) => setConfig({ ...config, global_marketplace_commission_percent: parseInt(e.target.value || "0") })}
                />
                <p className="text-xs text-muted-foreground mt-1">% retida em cada venda global. Vendedor recebe o restante.</p>
              </div>

              <div>
                <Label>Discord Guild ID (servidor da dona)</Label>
                <div className="flex gap-2">
                  <Input
                    value={config.global_marketplace_guild_id || ""}
                    onChange={(e) => setConfig({ ...config, global_marketplace_guild_id: e.target.value })}
                    placeholder="123456789012345678"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fetchChannels(config.global_marketplace_guild_id)}
                    disabled={loadingChannels || !config.global_marketplace_guild_id}
                    title="Recarregar canais"
                  >
                    {loadingChannels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
                {channels.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {channels.length} canais sincronizados do servidor.
                  </p>
                )}
              </div>



              <div>
                <Label>Categorias e canais de envio</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Cada categoria recebe os anúncios aprovados no canal escolhido.
                </p>
                <div className="space-y-2">
                  {Object.entries(config.global_marketplace_category_channels || {}).length === 0 && !loadingChannels && (
                    <p className="text-xs text-muted-foreground italic">Nenhuma categoria criada ainda.</p>
                  )}
                  {Object.entries(config.global_marketplace_category_channels || {}).map(([cat, channelId]) => (
                    <div key={cat} className="flex items-center gap-2">
                      <Badge variant="outline" className="min-w-24 justify-center">{cat}</Badge>
                      <Select
                        value={(channelId as string) || ""}
                        onValueChange={(v) => setConfig({
                          ...config,
                          global_marketplace_category_channels: {
                            ...(config.global_marketplace_category_channels || {}),
                            [cat]: v,
                          },
                        })}
                        disabled={channels.length === 0}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={channels.length === 0 ? "Defina o Guild ID primeiro" : "Escolha um canal"} />
                        </SelectTrigger>
                        <SelectContent>
                          {channels.map((ch) => (
                            <SelectItem key={ch.id} value={ch.id}>
                              <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{ch.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const next = { ...(config.global_marketplace_category_channels || {}) };
                          delete next[cat];
                          setConfig({ ...config, global_marketplace_category_channels: next });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Nova categoria (ex: Contas, Bots, Serviços...)"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const name = newCategoryName.trim();
                        if (!name) return;
                        setConfig({
                          ...config,
                          global_marketplace_category_channels: {
                            ...(config.global_marketplace_category_channels || {}),
                            [name]: "",
                          },
                        });
                        setNewCategoryName("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const name = newCategoryName.trim();
                      if (!name) return;
                      setConfig({
                        ...config,
                        global_marketplace_category_channels: {
                          ...(config.global_marketplace_category_channels || {}),
                          [name]: "",
                        },
                      });
                      setNewCategoryName("");
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </Button>
                </div>

                {DEFAULT_CATEGORIES.some((c) => !(config.global_marketplace_category_channels || {})[c]) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-xs text-muted-foreground self-center">Sugestões:</span>
                    {DEFAULT_CATEGORIES.filter((c) => !(config.global_marketplace_category_channels || {})[c]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setConfig({
                          ...config,
                          global_marketplace_category_channels: {
                            ...(config.global_marketplace_category_channels || {}),
                            [c]: "",
                          },
                        })}
                        className="text-xs px-2 py-0.5 rounded-full border border-border hover:bg-muted transition-colors"
                      >
                        + {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {(() => {
                const tpl = config.global_marketplace_embed_template || {};
                const setTpl = (patch: any) => setConfig({ ...config, global_marketplace_embed_template: { ...tpl, ...patch } });
                return (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
                    <div>
                      <Label className="text-sm font-semibold">Modal do produto no Discord</Label>
                      <p className="text-xs text-muted-foreground">
                        Personalize o embed enviado ao canal. Variáveis: <code className="text-[10px]">{"{product_name}"}</code>, <code className="text-[10px]">{"{product_description}"}</code>, <code className="text-[10px]">{"{price}"}</code>, <code className="text-[10px]">{"{seller}"}</code>, <code className="text-[10px]">{"{category}"}</code>.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Título</Label>
                        <Input value={tpl.title ?? "{product_name}"} onChange={(e) => setTpl({ title: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Cor (hex)</Label>
                        <Input type="color" value={tpl.color ?? "#FF1493"} onChange={(e) => setTpl({ color: e.target.value })} className="h-10 p-1" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Descrição</Label>
                      <Textarea rows={2} value={tpl.description ?? "{product_description}"} onChange={(e) => setTpl({ description: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Rodapé</Label>
                      <Input value={tpl.footer ?? ""} onChange={(e) => setTpl({ footer: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      {[
                        ["show_price", "Preço"],
                        ["show_seller", "Vendedor"],
                        ["show_category", "Categoria"],
                        ["show_thumbnail", "Ícone"],
                        ["show_banner", "Banner"],
                      ].map(([k, lbl]) => (
                        <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tpl[k as string] !== false}
                            onChange={(e) => setTpl({ [k as string]: e.target.checked })}
                          />
                          {lbl}
                        </label>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-border/40">
                      <Label className="text-sm font-semibold">Botão de compra</Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                        <div>
                          <Label className="text-xs">Texto</Label>
                          <Input value={tpl.button_label ?? "Comprar"} onChange={(e) => setTpl({ button_label: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Emoji</Label>
                          <Input value={tpl.button_emoji ?? "🛒"} onChange={(e) => setTpl({ button_emoji: e.target.value })} placeholder="🛒" />
                        </div>
                        <div>
                          <Label className="text-xs">Estilo</Label>
                          <Select value={String(tpl.button_style ?? 1)} onValueChange={(v) => setTpl({ button_style: parseInt(v) })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Azul (Primary)</SelectItem>
                              <SelectItem value="2">Cinza (Secondary)</SelectItem>
                              <SelectItem value="3">Verde (Success)</SelectItem>
                              <SelectItem value="4">Vermelho (Danger)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div>
                <Label>Gateway PIX</Label>
                <Select
                  value={config.global_marketplace_payment_provider || ""}
                  onValueChange={(v) => setConfig({ ...config, global_marketplace_payment_provider: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Escolha o gateway" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efi">Efí</SelectItem>
                    <SelectItem value="pushinpay">PushinPay</SelectItem>
                    <SelectItem value="abacatepay">AbacatePay</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={saveConfig} disabled={acting}>
                {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Salvar configurações
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Approve modal */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Aprovar e categorizar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{approveTarget?.products?.name}</p>
            <div>
              <Label>Categoria global</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(config?.global_marketplace_category_channels || {}).length > 0
                    ? Object.keys(config.global_marketplace_category_channels)
                    : DEFAULT_CATEGORIES
                  ).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Cancelar</Button>
            <Button onClick={approve} disabled={acting}>
              {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />} Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject modal */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rejeitar produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{rejectTarget?.products?.name}</p>
            <div>
              <Label>Motivo (visível ao lojista)</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Ex: descrição insuficiente, banner inadequado..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={reject} disabled={acting || !rejectReason.trim()}>
              {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />} Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGlobalMarketplacePage;
