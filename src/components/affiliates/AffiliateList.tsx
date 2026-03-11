import { useState } from "react";
import {
  Plus, Users, Copy, Check, Search, Link2, BarChart3,
  Percent, Power, PowerOff, Edit2, Mail, Phone, MessageCircle,
  Calendar, Hash, ExternalLink, DollarSign,
} from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Affiliate, AffiliateOrder, AffiliatePayout, formatBRL, statusLabels, payoutStatusLabels, getCommissionLabel, calcCommission } from "./types";

interface Props {
  affiliates: Affiliate[];
  loading: boolean;
  tenantId: string | null;
  onRefresh: () => void;
  adminMode?: boolean;
}

interface AffiliateForm {
  name: string;
  code: string;
  commission_type: "percent" | "fixed";
  commission_percent: number;
  commission_fixed_cents: number;
  discord_username: string;
  email: string;
  whatsapp: string;
}

const emptyForm: AffiliateForm = {
  name: "", code: "", commission_type: "percent", commission_percent: 5, commission_fixed_cents: 0,
  discord_username: "", email: "", whatsapp: "",
};

const AffiliateList = ({ affiliates, loading, tenantId, onRefresh, adminMode }: Props) => {
  const getTenantId = (aff?: Affiliate | null) => tenantId || (aff as any)?.tenant_id || null;
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Affiliate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AffiliateForm>(emptyForm);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Stats modal
  const [statsAffiliate, setStatsAffiliate] = useState<Affiliate | null>(null);
  const [statsOrders, setStatsOrders] = useState<AffiliateOrder[]>([]);
  const [statsPayouts, setStatsPayouts] = useState<AffiliatePayout[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (aff: Affiliate) => {
    setEditing(aff);
    setForm({
      name: aff.name,
      code: aff.code,
      commission_type: aff.commission_type || "percent",
      commission_percent: aff.commission_percent,
      commission_fixed_cents: aff.commission_fixed_cents || 0,
      discord_username: aff.discord_username ?? "",
      email: aff.email ?? "",
      whatsapp: aff.whatsapp ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const effectiveTenantId = getTenantId(editing);
    if (!effectiveTenantId || !form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code,
        commission_type: form.commission_type,
        commission_percent: form.commission_percent,
        commission_fixed_cents: form.commission_fixed_cents,
        discord_username: form.discord_username.trim() || null,
        email: form.email.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
      };
      if (editing) {
        await supabase.functions.invoke("manage-affiliates", {
          body: { action: "update", tenant_id: effectiveTenantId, affiliate_id: editing.id, affiliate: payload },
        });
        toast({ title: "Afiliado atualizado ✅" });
      } else {
        await supabase.functions.invoke("manage-affiliates", {
          body: { action: "create", tenant_id: effectiveTenantId, affiliate: payload },
        });
        toast({ title: "Afiliado criado ✅" });
      }
      setModalOpen(false);
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleToggle = async (aff: Affiliate) => {
    try {
      await supabase.functions.invoke("manage-affiliates", {
        body: { action: "update", tenant_id: getTenantId(aff), affiliate_id: aff.id, affiliate: { active: !aff.active } },
      });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    const aff = affiliates.find(a => a.id === id);
    try {
      await supabase.functions.invoke("manage-affiliates", {
        body: { action: "delete", tenant_id: getTenantId(aff), affiliate_id: id },
      });
      toast({ title: "Afiliado removido" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const getFullLink = (code: string) => `${window.location.origin}?ref=${code}`;

  const copyLink = (aff: Affiliate) => {
    const link = getFullLink(aff.code);
    navigator.clipboard.writeText(link);
    setCopiedId(aff.id);
    toast({ title: "Link copiado! 📋", description: link });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openStats = async (aff: Affiliate) => {
    setStatsAffiliate(aff);
    setStatsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-affiliates", {
        body: { action: "stats", tenant_id: getTenantId(aff), affiliate_id: aff.id },
      });
      if (error) throw error;
      setStatsOrders(data?.orders ?? []);
      setStatsPayouts(data?.payouts ?? []);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setStatsLoading(false);
  };

  const filtered = affiliates.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      (a.discord_username && a.discord_username.toLowerCase().includes(search.toLowerCase())) ||
      (a.email && a.email.toLowerCase().includes(search.toLowerCase())) ||
      (a.whatsapp && a.whatsapp.includes(search))
  );

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

  return (
    <div className="space-y-4">
      {/* Search + Create */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, código, discord, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate} className="gradient-pink text-primary-foreground border-none hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" /> Novo Afiliado
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground">
            {search ? "Nenhum afiliado encontrado" : "Nenhum afiliado cadastrado ainda"}
          </p>
          {!search && (
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Criar primeiro afiliado
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((aff) => {
            const commissionEarned = calcCommission(aff, aff.total_revenue_cents);
            return (
              <div
                key={aff.id}
                className="group relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-5 space-y-3 hover:border-primary/30 transition-all duration-300 overflow-hidden"
              >
                {/* Accent line */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] ${aff.active ? "bg-gradient-to-r from-primary to-violet-500" : "bg-muted"} opacity-60`} />

                {/* Top: Name + Actions */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${aff.active ? "gradient-pink" : "bg-muted"}`}>
                      <Users className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{aff.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant={aff.active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {aff.active ? "Ativo" : "Inativo"}
                        </Badge>
                        <span className="font-mono text-[10px] text-muted-foreground">{aff.code}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(aff)}>
                      {copiedId === aff.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(aff)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-1.5">
                  {aff.discord_username && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MessageCircle className="h-3.5 w-3.5 text-[hsl(235,86%,65%)]" />
                      <span className="truncate">{aff.discord_username}</span>
                    </div>
                  )}
                  {aff.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 text-amber-400" />
                      <span className="truncate">{aff.email}</span>
                    </div>
                  )}
                  {aff.whatsapp && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="truncate">{aff.whatsapp}</span>
                    </div>
                  )}
                  {!aff.discord_username && !aff.email && !aff.whatsapp && (
                    <p className="text-[11px] text-muted-foreground/50 italic">Nenhum contato cadastrado</p>
                  )}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/20 border border-border/30 py-2">
                    <p className="text-sm font-bold font-display flex items-center justify-center gap-1">
                      {aff.commission_type === "fixed"
                        ? <><DollarSign className="h-3 w-3 text-primary" /> {formatBRL(aff.commission_fixed_cents)}</>
                        : <><Percent className="h-3 w-3 text-primary" /> {aff.commission_percent}%</>
                      }
                    </p>
                    <p className="text-[10px] text-muted-foreground">Comissão</p>
                  </div>
                  <div className="rounded-lg bg-muted/20 border border-border/30 py-2">
                    <p className="text-sm font-bold font-display">{aff.total_sales}</p>
                    <p className="text-[10px] text-muted-foreground">Vendas</p>
                  </div>
                  <div className="rounded-lg bg-muted/20 border border-border/30 py-2">
                    <p className="text-sm font-bold font-display text-primary">{formatBRL(commissionEarned)}</p>
                    <p className="text-[10px] text-muted-foreground">Ganhos</p>
                  </div>
                </div>

                {/* Referral link */}
                <div className="flex items-center gap-2 rounded-lg bg-muted/10 border border-border/30 px-3 py-2">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="text-xs font-mono text-muted-foreground truncate flex-1">{getFullLink(aff.code)}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyLink(aff)}>
                    {copiedId === aff.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>

                {/* Date + Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Criado em {formatDate(aff.created_at)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openStats(aff)}>
                      <BarChart3 className="h-3.5 w-3.5" /> Detalhes
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleToggle(aff)}>
                      {aff.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                          <TrashIcon className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover afiliado?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O afiliado <strong>{aff.name}</strong> será removido permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(aff.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {editing ? "Editar Afiliado" : "Novo Afiliado"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome do afiliado *</Label>
                <Input
                  placeholder="Ex: João Silva"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Código de referência *</Label>
                <Input
                  placeholder="Ex: JOAO10"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, "") })}
                  className="font-mono uppercase"
                />
              </div>
            </div>

            {/* Commission config */}
            <div className="border-t border-border/50 pt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Premiação / Comissão</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Tipo de comissão</Label>
                  <Select value={form.commission_type} onValueChange={(v: "percent" | "fixed") => setForm({ ...form, commission_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Porcentagem sobre a venda (%)</SelectItem>
                      <SelectItem value="fixed">Valor fixo por venda (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.commission_type === "percent" ? (
                  <div className="space-y-2">
                    <Label>Porcentagem (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form.commission_percent}
                      onChange={(e) => setForm({ ...form, commission_percent: Number(e.target.value) })}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Valor fixo por venda (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={(form.commission_fixed_cents / 100).toFixed(2)}
                      onChange={(e) => setForm({ ...form, commission_fixed_cents: Math.round(Number(e.target.value) * 100) })}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Contact fields */}
            <div className="border-t border-border/50 pt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Informações de contato</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <MessageCircle className="h-3.5 w-3.5 text-[hsl(235,86%,65%)]" /> Discord
                  </Label>
                  <Input
                    placeholder="Ex: joaosilva ou joao#1234"
                    value={form.discord_username}
                    onChange={(e) => setForm({ ...form, discord_username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-amber-400" /> E-mail
                  </Label>
                  <Input
                    type="email"
                    placeholder="Ex: joao@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp
                  </Label>
                  <Input
                    placeholder="Ex: (11) 99999-9999"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Link gerado: <span className="font-mono text-primary">{window.location.origin}?ref={form.code || "..."}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.code.trim()}
              className="gradient-pink text-primary-foreground border-none"
            >
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar Afiliado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Stats / Detail Modal ── */}
      <Dialog open={!!statsAffiliate} onOpenChange={(o) => !o && setStatsAffiliate(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Detalhes — {statsAffiliate?.name}
            </DialogTitle>
          </DialogHeader>

          {statsAffiliate && (
            <div className="space-y-4">
              {/* Contact info */}
              <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contato</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-4 w-4 text-[hsl(235,86%,65%)]" />
                    <span className="truncate">{statsAffiliate.discord_username || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-amber-400" />
                    <span className="truncate">{statsAffiliate.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-emerald-400" />
                    <span className="truncate">{statsAffiliate.whatsapp || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-xl bg-muted/20 border border-border/30 p-3 text-center">
                  <p className="text-lg font-bold">{getCommissionLabel(statsAffiliate)}</p>
                  <p className="text-[10px] text-muted-foreground">Comissão</p>
                </div>
                <div className="rounded-xl bg-muted/20 border border-border/30 p-3 text-center">
                  <p className="text-lg font-bold">{statsAffiliate.total_sales}</p>
                  <p className="text-[10px] text-muted-foreground">Vendas</p>
                </div>
                <div className="rounded-xl bg-muted/20 border border-border/30 p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{formatBRL(statsAffiliate.total_revenue_cents)}</p>
                  <p className="text-[10px] text-muted-foreground">Receita</p>
                </div>
                <div className="rounded-xl bg-muted/20 border border-border/30 p-3 text-center">
                  <p className="text-lg font-bold text-primary">
                    {formatBRL(calcCommission(statsAffiliate, statsAffiliate.total_revenue_cents))}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Ganhos</p>
                </div>
              </div>

              {/* Link */}
              <div className="flex items-center gap-2 rounded-lg bg-muted/10 border border-border/30 px-3 py-2">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="text-xs font-mono text-muted-foreground truncate flex-1">
                  {getFullLink(statsAffiliate.code)}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyLink(statsAffiliate)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>

              {/* Tabs: Orders & Payouts */}
              {statsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
              ) : (
                <Tabs defaultValue="orders" className="space-y-3">
                  <TabsList className="w-full">
                    <TabsTrigger value="orders" className="flex-1">Pedidos ({statsOrders.length})</TabsTrigger>
                    <TabsTrigger value="payouts" className="flex-1">Pagamentos ({statsPayouts.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="orders">
                    {statsOrders.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-6">Nenhum pedido vinculado</p>
                    ) : (
                      <div className="max-h-[250px] overflow-y-auto space-y-2">
                        {statsOrders.map((order) => (
                          <div key={order.id} className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/10 p-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                <Hash className="h-3 w-3 inline text-muted-foreground" />
                                {order.order_number} — {order.product_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {order.discord_username || "Desconhecido"} • {formatDate(order.created_at)}
                              </p>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="text-sm font-bold">{formatBRL(order.total_cents)}</p>
                              <Badge variant="outline" className="text-[10px]">
                                {statusLabels[order.status] || order.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="payouts">
                    {statsPayouts.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-6">Nenhum pagamento registrado</p>
                    ) : (
                      <div className="max-h-[250px] overflow-y-auto space-y-2">
                        {statsPayouts.map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/10 p-3">
                            <div>
                              <p className="text-sm font-bold">{formatBRL(p.amount_cents)}</p>
                              <p className="text-[11px] text-muted-foreground">{formatDate(p.created_at)}</p>
                            </div>
                            <Badge
                              variant={p.status === "paid" ? "default" : p.status === "canceled" ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {payoutStatusLabels[p.status] || p.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              <p className="text-[10px] text-muted-foreground text-center">
                Cadastrado em {formatDate(statsAffiliate.created_at)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AffiliateList;
