import { useState } from "react";
import {
  Plus, DollarSign, Check, Clock, XCircle, CalendarDays, User, FileText, ArrowUpRight,
} from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Affiliate, AffiliatePayout, formatBRL, payoutStatusLabels } from "./types";

interface Props {
  affiliates: Affiliate[];
  tenantId: string | null;
  payouts: AffiliatePayout[];
  onRefresh: () => void;
  adminMode?: boolean;
}

const statusConfig: Record<string, { icon: typeof Clock; label: string; color: string; bg: string; border: string }> = {
  pending: {
    icon: Clock,
    label: "Aguardando liberação",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/30",
  },
  paid: {
    icon: Check,
    label: "Pago",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/30",
  },
  canceled: {
    icon: XCircle,
    label: "Cancelado",
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
  },
};

const AffiliatePayouts = ({ affiliates, tenantId, payouts, onRefresh, adminMode }: Props) => {
  const getAffTenantId = (affId: string) => tenantId || (affiliates.find(a => a.id === affId) as any)?.tenant_id || null;
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    affiliate_id: "",
    amount_cents: 0,
    notes: "",
    status: "pending",
  });

  const openCreate = () => {
    setForm({ affiliate_id: affiliates[0]?.id ?? "", amount_cents: 0, notes: "", status: "pending" });
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!form.affiliate_id || form.amount_cents <= 0) return;
    const effectiveTenantId = getAffTenantId(form.affiliate_id);
    if (!effectiveTenantId) return;
    setSaving(true);
    try {
      await supabase.functions.invoke("manage-affiliates", {
        body: {
          action: "create_payout",
          tenant_id: effectiveTenantId,
          affiliate_id: form.affiliate_id,
          payout: {
            amount_cents: form.amount_cents,
            notes: form.notes || null,
            status: form.status,
          },
        },
      });
      toast({ title: "Pagamento registrado ✅" });
      setModalOpen(false);
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleUpdateStatus = async (payoutId: string, newStatus: string) => {
    const payout = payouts.find(p => p.id === payoutId);
    const effectiveTenantId = payout ? getAffTenantId(payout.affiliate_id) : tenantId;
    try {
      await supabase.functions.invoke("manage-affiliates", {
        body: {
          action: "update_payout",
          tenant_id: effectiveTenantId,
          payout_id: payoutId,
          payout: { status: newStatus },
        },
      });
      const label = payoutStatusLabels[newStatus] || newStatus;
      toast({ title: `Status atualizado para "${label}" ✅` });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (payoutId: string) => {
    const payout = payouts.find(p => p.id === payoutId);
    const effectiveTenantId = payout ? getAffTenantId(payout.affiliate_id) : tenantId;
    try {
      await supabase.functions.invoke("manage-affiliates", {
        body: { action: "delete_payout", tenant_id: effectiveTenantId, payout_id: payoutId },
      });
      toast({ title: "Pagamento removido" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const getAffiliateName = (id: string) => affiliates.find((a) => a.id === id)?.name ?? "Desconhecido";

  const totalPending = payouts.filter(p => p.status === "pending").reduce((s, p) => s + p.amount_cents, 0);
  const totalPaid = payouts.filter(p => p.status === "paid").reduce((s, p) => s + p.amount_cents, 0);
  const totalCanceled = payouts.filter(p => p.status === "canceled").reduce((s, p) => s + p.amount_cents, 0);

  const pendingCount = payouts.filter(p => p.status === "pending").length;
  const paidCount = payouts.filter(p => p.status === "paid").length;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {[
          { icon: Clock, label: "Pendente", value: totalPending, count: pendingCount, color: "text-amber-400", glow: "shadow-amber-500/5" },
          { icon: Check, label: "Pago", value: totalPaid, count: paidCount, color: "text-emerald-400", glow: "shadow-emerald-500/5" },
          { icon: DollarSign, label: "Total", value: totalPending + totalPaid, count: payouts.length, color: "text-primary", glow: "shadow-primary/5" },
        ].map(({ icon: Icon, label, value, count, color, glow }) => (
          <div key={label} className={`relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-5 space-y-2 ${glow} shadow-lg`}>
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br from-primary/5 to-transparent -translate-y-8 translate-x-8" />
            <div className="flex items-center justify-between relative">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color} bg-current/10`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              </div>
              {count > 0 && (
                <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                  {count}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold font-display tracking-tight relative">{formatBRL(value)}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={openCreate} className="gradient-pink text-primary-foreground border-none hover:opacity-90 gap-2 rounded-xl shadow-lg shadow-primary/10" disabled={affiliates.length === 0}>
          <Plus className="h-4 w-4" /> Registrar Pagamento
        </Button>
      </div>

      {/* Payouts list */}
      {payouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <DollarSign className="h-10 w-10 text-primary/60" />
            </div>
            <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-muted border border-border">
              <FileText className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground/80">Nenhum pagamento registrado</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Pagamentos de comissão aparecerão aqui quando indicações forem aprovadas
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((p) => {
            const sc = statusConfig[p.status] || statusConfig.pending;
            const StatusIcon = sc.icon;
            return (
              <div
                key={p.id}
                className={`group relative overflow-hidden rounded-2xl border ${sc.border} bg-card/60 backdrop-blur-md p-5 transition-all duration-200 hover:bg-card/80 hover:shadow-lg`}
              >
                {/* Status accent line */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${sc.bg}`}>
                  <div className={`h-full w-full ${sc.color.replace('text-', 'bg-')} opacity-60`} />
                </div>

                <div className="flex items-start gap-4 pl-3">
                  {/* Avatar / Icon */}
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${sc.bg} border ${sc.border}`}>
                    <User className={`h-5 w-5 ${sc.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{getAffiliateName(p.affiliate_id)}</p>
                      <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.bg} ${sc.color} border ${sc.border}`}>
                        <StatusIcon className="h-3 w-3" />
                        {sc.label}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {p.paid_at
                          ? `Pago em ${new Date(p.paid_at).toLocaleDateString("pt-BR")}`
                          : `Criado em ${new Date(p.created_at).toLocaleDateString("pt-BR")}`}
                      </span>
                    </div>

                    {p.notes && (
                      <p className="text-[11px] text-muted-foreground/80 leading-relaxed line-clamp-2 bg-muted/30 rounded-lg px-2.5 py-1.5 border border-border/30">
                        {p.notes}
                      </p>
                    )}
                  </div>

                  {/* Amount + Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className={`text-lg font-bold font-display ${p.status === "paid" ? "text-emerald-400" : p.status === "canceled" ? "text-red-400/50 line-through" : "text-foreground"}`}>
                        {formatBRL(p.amount_cents)}
                      </p>
                    </div>

                    <Select value={p.status} onValueChange={(v) => handleUpdateStatus(p.id, v)}>
                      <SelectTrigger className={`w-[130px] h-9 text-xs rounded-xl border ${sc.border} ${sc.bg} ${sc.color} font-semibold`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-amber-400" /> Pendente
                          </span>
                        </SelectItem>
                        <SelectItem value="paid">
                          <span className="flex items-center gap-1.5">
                            <Check className="h-3 w-3 text-emerald-400" /> Pago
                          </span>
                        </SelectItem>
                        <SelectItem value="canceled">
                          <span className="flex items-center gap-1.5">
                            <XCircle className="h-3 w-3 text-red-400" /> Cancelado
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover pagamento?</AlertDialogTitle>
                          <AlertDialogDescription>Este registro será removido permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

      {/* Create payout modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              Registrar Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Afiliado</Label>
              <Select value={form.affiliate_id} onValueChange={(v) => setForm({ ...form, affiliate_id: v })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {affiliates.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                className="rounded-xl"
                value={(form.amount_cents / 100).toFixed(2)}
                onChange={(e) => setForm({ ...form, amount_cents: Math.round(Number(e.target.value) * 100) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="PIX enviado, transferência bancária..."
                className="rounded-xl"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !form.affiliate_id || form.amount_cents <= 0}
              className="gradient-pink text-primary-foreground border-none rounded-xl"
            >
              {saving ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AffiliatePayouts;
