import { useState } from "react";
import {
  Plus, Users, Copy, Check, Search, Link2, BarChart3,
  Percent, Power, PowerOff, Edit2,
} from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Affiliate, AffiliateOrder, AffiliatePayout, formatBRL, statusLabels, payoutStatusLabels } from "./types";

interface Props {
  affiliates: Affiliate[];
  loading: boolean;
  tenantId: string | null;
  onRefresh: () => void;
}

const AffiliateList = ({ affiliates, loading, tenantId, onRefresh }: Props) => {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Affiliate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", commission_percent: 5 });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Stats modal
  const [statsAffiliate, setStatsAffiliate] = useState<Affiliate | null>(null);
  const [statsOrders, setStatsOrders] = useState<AffiliateOrder[]>([]);
  const [statsPayouts, setStatsPayouts] = useState<AffiliatePayout[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", code: "", commission_percent: 5 });
    setModalOpen(true);
  };

  const openEdit = (aff: Affiliate) => {
    setEditing(aff);
    setForm({ name: aff.name, code: aff.code, commission_percent: aff.commission_percent });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!tenantId || !form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await supabase.functions.invoke("manage-affiliates", {
          body: { action: "update", tenant_id: tenantId, affiliate_id: editing.id, affiliate: form },
        });
        toast({ title: "Afiliado atualizado ✅" });
      } else {
        await supabase.functions.invoke("manage-affiliates", {
          body: { action: "create", tenant_id: tenantId, affiliate: form },
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
        body: { action: "update", tenant_id: tenantId, affiliate_id: aff.id, affiliate: { active: !aff.active } },
      });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.functions.invoke("manage-affiliates", {
        body: { action: "delete", tenant_id: tenantId, affiliate_id: id },
      });
      toast({ title: "Afiliado removido" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const getFullLink = (code: string) => {
    const base = window.location.origin;
    return `${base}?ref=${code}`;
  };

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
        body: { action: "stats", tenant_id: tenantId, affiliate_id: aff.id },
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
      a.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Search + Create */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
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
            <Skeleton key={i} className="h-48 rounded-xl" />
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
            const commissionEarned = Math.round(aff.total_revenue_cents * aff.commission_percent / 100);
            return (
              <div
                key={aff.id}
                className="group rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5 space-y-4 hover:border-primary/30 transition-all"
              >
                {/* Top */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gradient-pink">
                      <Users className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{aff.name}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={aff.active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {aff.active ? "Ativo" : "Inativo"}
                        </Badge>
                        <span className="font-mono text-[10px] text-muted-foreground">{aff.code}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(aff)}>
                      {copiedId === aff.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(aff)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/30 py-2">
                    <p className="text-sm font-bold font-display flex items-center justify-center gap-1">
                      <Percent className="h-3 w-3 text-primary" /> {aff.commission_percent}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Comissão</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 py-2">
                    <p className="text-sm font-bold font-display">{aff.total_sales}</p>
                    <p className="text-[10px] text-muted-foreground">Vendas</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 py-2">
                    <p className="text-sm font-bold font-display text-primary">{formatBRL(commissionEarned)}</p>
                    <p className="text-[10px] text-muted-foreground">Ganhos</p>
                  </div>
                </div>

                {/* Referral link */}
                <div className="flex items-center gap-2 rounded-lg bg-muted/20 border border-border px-3 py-2">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="text-xs font-mono text-muted-foreground truncate flex-1">{getFullLink(aff.code)}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyLink(aff)}>
                    {copiedId === aff.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => openStats(aff)}>
                      <BarChart3 className="h-3.5 w-3.5" /> Detalhes
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => handleToggle(aff)}>
                      {aff.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                      {aff.active ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
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
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Afiliado" : "Novo Afiliado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do afiliado</Label>
              <Input
                placeholder="Ex: João Silva"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Código de referência</Label>
              <Input
                placeholder="Ex: JOAO10"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, "") })}
                className="font-mono uppercase"
              />
              <p className="text-[11px] text-muted-foreground">
                Link de indicação: <span className="font-mono text-primary">?ref={form.code || "..."}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Comissão (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.commission_percent}
                onChange={(e) => setForm({ ...form, commission_percent: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.code.trim()}
              className="gradient-pink text-primary-foreground border-none"
            >
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats / Detail Modal */}
      <Dialog open={!!statsAffiliate} onOpenChange={(o) => !o && setStatsAffiliate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Detalhes — {statsAffiliate?.name}
            </DialogTitle>
          </DialogHeader>

          {statsAffiliate && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-lg font-bold">{statsAffiliate.commission_percent}%</p>
                <p className="text-[10px] text-muted-foreground">Comissão</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-lg font-bold">{statsAffiliate.total_sales}</p>
                <p className="text-[10px] text-muted-foreground">Vendas</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-lg font-bold text-primary">
                  {formatBRL(Math.round(statsAffiliate.total_revenue_cents * statsAffiliate.commission_percent / 100))}
                </p>
                <p className="text-[10px] text-muted-foreground">Ganhos</p>
              </div>
            </div>
          )}

          {statsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          ) : (
            <>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">Pedidos recentes</h4>
              {statsOrders.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Nenhum pedido vinculado</p>
              ) : (
                <div className="max-h-[200px] overflow-y-auto space-y-2">
                  {statsOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">#{order.order_number} — {order.product_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {order.discord_username || "Desconhecido"} • {new Date(order.created_at).toLocaleDateString("pt-BR")}
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

              {/* Payouts section */}
              <h4 className="text-xs font-semibold text-muted-foreground mt-4 mb-2">Pagamentos de comissão</h4>
              {statsPayouts.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Nenhum pagamento registrado</p>
              ) : (
                <div className="max-h-[150px] overflow-y-auto space-y-2">
                  {statsPayouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="text-sm font-bold">{formatBRL(p.amount_cents)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.paid_at ? new Date(p.paid_at).toLocaleDateString("pt-BR") : new Date(p.created_at).toLocaleDateString("pt-BR")}
                          {p.notes && ` • ${p.notes}`}
                        </p>
                      </div>
                      <Badge variant={p.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                        {payoutStatusLabels[p.status] || p.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AffiliateList;
