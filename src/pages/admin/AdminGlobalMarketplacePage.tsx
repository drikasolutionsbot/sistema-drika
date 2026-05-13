import { useEffect, useState } from "react";
import { Globe, Check, X, ExternalLink, Loader2, Settings } from "lucide-react";
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

const GLOBAL_CATEGORIES = ["Contas", "Serviços", "Bots", "Outros"];

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
  tenants: { name: string; plan: string };
}

const AdminGlobalMarketplacePage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("pending");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [approveTarget, setApproveTarget] = useState<Listing | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Listing | null>(null);
  const [category, setCategory] = useState(GLOBAL_CATEGORIES[0]);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  // Config
  const [config, setConfig] = useState<any>(null);

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

  useEffect(() => {
    if (tab === "config") fetchConfig();
    else fetchListings(tab);
  }, [tab]);

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
                    {l.rejection_reason && (
                      <p className="text-xs text-destructive">Motivo: {l.rejection_reason}</p>
                    )}
                    {s === "approved" && (
                      <p className="text-xs text-muted-foreground">{l.total_sales} vendas • R$ {(l.total_revenue_cents / 100).toFixed(2)}</p>
                    )}
                    {s === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => { setApproveTarget(l); setCategory(GLOBAL_CATEGORIES[0]); }}>
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
                <Input
                  value={config.global_marketplace_guild_id || ""}
                  onChange={(e) => setConfig({ ...config, global_marketplace_guild_id: e.target.value })}
                  placeholder="123456789012345678"
                />
              </div>

              <div>
                <Label>Discord IDs aprovadores (separados por vírgula)</Label>
                <Textarea
                  value={(config.global_marketplace_approver_discord_ids || []).join(", ")}
                  onChange={(e) => setConfig({ ...config, global_marketplace_approver_discord_ids: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                  placeholder="111..., 222..."
                  rows={2}
                />
              </div>

              <div>
                <Label>Mapeamento categoria → canal Discord</Label>
                <div className="space-y-2 mt-2">
                  {GLOBAL_CATEGORIES.map((cat) => (
                    <div key={cat} className="flex items-center gap-2">
                      <Badge variant="outline" className="w-24 justify-center">{cat}</Badge>
                      <Input
                        placeholder="Channel ID"
                        value={config.global_marketplace_category_channels?.[cat] || ""}
                        onChange={(e) => setConfig({
                          ...config,
                          global_marketplace_category_channels: {
                            ...(config.global_marketplace_category_channels || {}),
                            [cat]: e.target.value,
                          },
                        })}
                      />
                    </div>
                  ))}
                </div>
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
                  {GLOBAL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
