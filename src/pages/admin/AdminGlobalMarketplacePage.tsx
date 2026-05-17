import { useEffect, useState } from "react";
import { Globe, Check, X, ExternalLink, Loader2, Settings, Plus, Trash2, Hash, RefreshCw, Sparkles, Store, AlertTriangle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_CATEGORIES = ["Contas", "Serviços", "Bots", "Outros"];

const SAMPLE_VARS = {
  product_name: "Conta Premium Steam",
  product_description: "Conta verificada com 50+ jogos. Entrega imediata após pagamento.",
  price: "R$ 49,90",
  seller: "LojaExemplo",
  category: "Contas",
};
const applyVars = (s: string, v: Record<string, string>) =>
  String(s ?? "").replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`);

const DISCORD_BTN_STYLES: Record<number, string> = {
  1: "bg-[#5865F2] hover:bg-[#4752c4] text-white",
  2: "bg-[#4E5058] hover:bg-[#6D6F78] text-white",
  3: "bg-[#248046] hover:bg-[#1a6334] text-white",
  4: "bg-[#DA373C] hover:bg-[#a12d31] text-white",
  5: "bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20",
};

function DiscordEmbedPreview({ tpl }: { tpl: any }) {
  const color = tpl.color || "#FF1493";
  const title = applyVars(tpl.title || "{product_name}", SAMPLE_VARS);
  const description = applyVars(tpl.description || "{product_description}", SAMPLE_VARS);
  const footer = applyVars(tpl.footer || "Marketplace Global • DRIKA HUB", SAMPLE_VARS);
  const fields: { name: string; value: string }[] = [];
  if (tpl.show_price !== false) fields.push({ name: "Preço", value: SAMPLE_VARS.price });
  if (tpl.show_seller !== false) fields.push({ name: "Vendedor", value: SAMPLE_VARS.seller });
  if (tpl.show_category !== false) fields.push({ name: "Categoria", value: SAMPLE_VARS.category });

  const btnStyle = DISCORD_BTN_STYLES[[1, 2, 3, 4, 5].includes(tpl.button_style) ? tpl.button_style : 1];
  const btnLabel = tpl.button_label || "Comprar";
  const btnEmoji = tpl.button_emoji || "";

  const now = new Date();
  const timestamp = now.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-md bg-[#313338] p-3 font-[system-ui,sans-serif]" translate="no">
      {/* Mensagem do bot */}
      <div className="flex gap-3">
        <div className="h-10 w-10 rounded-full bg-[#FF1493] shrink-0 flex items-center justify-center text-white text-xs font-bold">DH</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white text-sm font-medium">DRIKA HUB</span>
            <span className="text-[10px] bg-[#5865F2] text-white px-1 rounded">APP</span>
            <span className="text-[10px] text-[#949ba4]">hoje às {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          {/* Embed */}
          <div className="flex rounded overflow-hidden bg-[#2B2D31] max-w-[520px]">
            <div className="w-1 shrink-0" style={{ background: color }} />
            <div className="flex-1 p-3 min-w-0">
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  {title && <div className="text-white text-[15px] font-semibold mb-1 break-words">{title}</div>}
                  {description && <div className="text-[#dbdee1] text-sm mb-2 whitespace-pre-wrap break-words">{description}</div>}
                  {fields.length > 0 && (
                    <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2">
                      {fields.map((f) => (
                        <div key={f.name} className="min-w-0">
                          <div className="text-white text-xs font-semibold">{f.name}</div>
                          <div className="text-[#dbdee1] text-sm">{f.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {tpl.show_thumbnail !== false && (
                  <div className="h-16 w-16 shrink-0 rounded bg-[#1e1f22] flex items-center justify-center text-[10px] text-[#949ba4]">
                    ícone
                  </div>
                )}
              </div>
              {tpl.show_banner !== false && (
                <div className="mt-2 h-32 rounded bg-[#1e1f22] flex items-center justify-center text-xs text-[#949ba4]">
                  banner do produto
                </div>
              )}
              {footer && (
                <div className="mt-2 text-[11px] text-[#949ba4] flex items-center gap-1">
                  <span>{footer}</span>
                  <span>•</span>
                  <span>{timestamp}</span>
                </div>
              )}
            </div>
          </div>
          {/* Botão */}
          <div className="mt-2">
            <button
              type="button"
              disabled
              className={`inline-flex items-center gap-1.5 px-3 h-8 rounded text-sm font-medium cursor-default ${btnStyle}`}
            >
              {btnEmoji && <span>{btnEmoji}</span>}
              <span>{btnLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


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
  seller_pix_key: string | null;
  seller_pix_key_type: string | null;
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
  const [removeTarget, setRemoveTarget] = useState<Listing | null>(null);
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

  // Pedidos (vendas globais)
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersFilter, setOrdersFilter] = useState<"paid" | "pending" | "all">("paid");
  const [loadingOrders, setLoadingOrders] = useState(false);

  const fetchOrders = async (status: string) => {
    setLoadingOrders(true);
    const { data } = await supabase.functions.invoke("manage-global-marketplace", {
      body: { action: "list_orders", status: status === "all" ? undefined : status },
    });
    setLoadingOrders(false);
    if (Array.isArray(data)) setOrders(data);
  };

  useEffect(() => {
    if (tab === "config") fetchConfig();
    else if (tab === "orders") fetchOrders(ordersFilter);
    else fetchListings(tab);
  }, [tab, ordersFilter]);

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
      body: { action: "approve", listing_id: approveTarget.id, category_global: category, reviewer_id: user?.id, reviewer_email: user?.email },
    });
    setActing(false);
    if (error || data?.error) return toast({ title: "Erro", description: error?.message || data?.error, variant: "destructive" });
    if (data?.discord_post && !data.discord_post.ok) {
      toast({ title: "Aprovado, mas falhou ao postar no Discord", description: data.discord_post.error, variant: "destructive" });
    } else {
      toast({ title: "Produto aprovado e postado no Discord! 🌍" });
    }
    setApproveTarget(null);
    fetchListings(tab);
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setActing(true);
    const { error } = await supabase.functions.invoke("manage-global-marketplace", {
      body: { action: "reject", listing_id: rejectTarget.id, reason: rejectReason, reviewer_id: user?.id, reviewer_email: user?.email },
    });
    setActing(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Produto rejeitado" });
    setRejectTarget(null);
    setRejectReason("");
    fetchListings(tab);
  };

  const removeListing = async () => {
    if (!removeTarget) return;
    setActing(true);
    const { error, data } = await supabase.functions.invoke("manage-global-marketplace", {
      body: { action: "remove", listing_id: removeTarget.id, reviewer_id: user?.id, reviewer_email: user?.email },
    });
    setActing(false);
    if (error || data?.error) return toast({ title: "Erro", description: error?.message || data?.error, variant: "destructive" });
    toast({ title: "Listagem excluída" });
    setRemoveTarget(null);
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
          <TabsTrigger value="orders">💰 Pedidos</TabsTrigger>
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
                {listings.map((l) => {
                  const statusStyle = s === "pending"
                    ? { ring: "ring-amber-500/30", bar: "from-amber-500 to-orange-500", label: "Pendente", dot: "bg-amber-400" }
                    : s === "approved"
                    ? { ring: "ring-emerald-500/30", bar: "from-emerald-500 to-teal-500", label: "Aprovado", dot: "bg-emerald-400" }
                    : { ring: "ring-rose-500/30", bar: "from-rose-500 to-red-500", label: "Rejeitado", dot: "bg-rose-400" };
                  return (
                  <div
                    key={l.id}
                    className={`group relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-card/40 shadow-lg hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 ring-1 ${statusStyle.ring}`}
                  >
                    {/* Status bar */}
                    <div className={`h-1 w-full bg-gradient-to-r ${statusStyle.bar}`} />

                    {/* Banner blur background */}
                    {l.products?.banner_url && (
                      <div
                        className="absolute inset-0 opacity-10 bg-cover bg-center blur-2xl pointer-events-none"
                        style={{ backgroundImage: `url(${l.products.banner_url})` }}
                      />
                    )}

                    <div className="relative p-5 space-y-4">
                      {/* Header */}
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          {l.products?.icon_url ? (
                            <img src={l.products.icon_url} alt="" className="h-14 w-14 rounded-xl object-cover ring-2 ring-border/60 shadow-md" />
                          ) : (
                            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                              <Store className="h-6 w-6 text-primary" />
                            </div>
                          )}
                          <span className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${statusStyle.dot} ring-2 ring-card animate-pulse`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-base truncate leading-tight">{l.products?.name}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            por <span className="text-foreground/70 font-medium">{l.tenants?.name}</span>
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <Badge className="text-xs bg-primary/15 text-primary hover:bg-primary/20 border-0 font-bold">
                              R$ {((l.products?.price_cents || 0) / 100).toFixed(2)}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{l.tenants?.plan}</Badge>
                            {l.category_global && (
                              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/90">
                                <Hash className="h-2.5 w-2.5 mr-0.5" />{l.category_global}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {l.products?.description && (
                        <p className="text-xs text-muted-foreground/90 line-clamp-2 leading-relaxed">{l.products.description}</p>
                      )}

                      {/* Seller card */}
                      <div className="rounded-xl border border-border/60 bg-background/40 backdrop-blur-sm p-3 space-y-1.5 text-xs">
                        <p className="font-bold text-foreground/90 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-primary" /> Identificação do vendedor
                        </p>
                        {l.tenants?.owner_discord_username && (
                          <p><span className="text-muted-foreground">Discord:</span> <span className="font-medium">{l.tenants.owner_discord_username}</span>{l.tenants.owner_discord_id ? <span className="text-muted-foreground/60"> ({l.tenants.owner_discord_id})</span> : ""}</p>
                        )}
                        {l.tenants?.email && (<p className="truncate"><span className="text-muted-foreground">Email:</span> {l.tenants.email}</p>)}
                        {l.tenants?.whatsapp && (<p><span className="text-muted-foreground">WhatsApp:</span> {l.tenants.whatsapp}</p>)}
                        {l.seller_pix_key ? (
                          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 mt-1 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> PIX para repasse (98%)
                              {l.seller_pix_key_type && <span className="text-emerald-300/70 normal-case font-medium">· {l.seller_pix_key_type}</span>}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <code className="flex-1 font-mono text-[11px] break-all text-emerald-300/95">{l.seller_pix_key}</code>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 shrink-0 text-emerald-400 hover:bg-emerald-500/10"
                                onClick={() => {
                                  navigator.clipboard.writeText(l.seller_pix_key || "");
                                  toast({ title: "Chave PIX copiada" });
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-amber-500 flex items-center gap-1 text-[11px]">
                            <AlertTriangle className="h-3 w-3" /> Vendedor não informou chave PIX
                          </p>
                        )}
                        <p className="text-muted-foreground/70 pt-1 border-t border-border/40 mt-1.5">Tenant: <span className="font-mono">{l.tenant_id.slice(0, 8)}…</span></p>
                      </div>

                      {l.rejection_reason && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex gap-2">
                          <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span><strong>Rejeitado:</strong> {l.rejection_reason}</span>
                        </div>
                      )}

                      {s === "approved" && (
                        <div className="rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 p-2.5 text-xs flex items-center justify-between">
                          <span className="text-emerald-400/90 font-medium">{l.total_sales} vendas</span>
                          <span className="text-emerald-400 font-bold">R$ {(l.total_revenue_cents / 100).toFixed(2)}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        {s === "pending" && (
                          <>
                            <Button size="sm" className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 shadow-md shadow-emerald-500/20" onClick={() => { setApproveTarget(l); setCategory(DEFAULT_CATEGORIES[0]); }}>
                              <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 text-amber-500 border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400" onClick={() => setRejectTarget(l)}>
                              <X className="h-3.5 w-3.5 mr-1" /> Rejeitar
                            </Button>
                          </>
                        )}
                        {s === "approved" && (
                          <Button size="sm" variant="outline" className="flex-1 border-primary/30 hover:bg-primary/10 hover:text-primary" onClick={async () => {
                            const { data, error } = await supabase.functions.invoke("manage-global-marketplace", {
                              body: { action: "repost", listing_id: l.id, reviewer_id: user?.id, reviewer_email: user?.email },
                            });
                            if (error || data?.error) return toast({ title: "Erro", description: error?.message || data?.error, variant: "destructive" });
                            toast({ title: "Enviado para o Marketplace! 🌍" });
                          }}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reenviar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive shrink-0 px-3"
                          onClick={() => setRemoveTarget(l)}
                          title="Excluir listagem"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}
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
                              <SelectItem value="5">Glass (Transparente)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Prévia ao vivo do embed/botão */}
                    <div className="pt-3 border-t border-border/40">
                      <Label className="text-sm font-semibold">Prévia ao vivo</Label>
                      <p className="text-xs text-muted-foreground mb-2">Assim que vai aparecer no Discord.</p>
                      <DiscordEmbedPreview tpl={tpl} />
                    </div>
                  </div>
                );
              })()}

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

      {/* Confirmar exclusão */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" /> Excluir listagem?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">{removeTarget?.products?.name}</strong> será removido do Marketplace Global
              {removeTarget?.global_status === "approved" && " e a mensagem no Discord será apagada"}.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); removeListing(); }}
              disabled={acting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {acting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminGlobalMarketplacePage;
