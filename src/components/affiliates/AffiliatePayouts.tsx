import { useState, useEffect, useCallback } from "react";
import {
  Plus, DollarSign, Search, Check, Clock,
} from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    try {
      await supabase.functions.invoke("manage-affiliates", {
        body: {
          action: "update_payout",
          tenant_id: tenantId,
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
    try {
      await supabase.functions.invoke("manage-affiliates", {
        body: { action: "delete_payout", tenant_id: tenantId, payout_id: payoutId },
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

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4 space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-muted-foreground">Pendente</span>
          </div>
          <p className="text-xl font-bold font-display">{formatBRL(totalPending)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4 space-y-1">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Pago</span>
          </div>
          <p className="text-xl font-bold font-display">{formatBRL(totalPaid)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4 space-y-1">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="text-xl font-bold font-display">{formatBRL(totalPending + totalPaid)}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={openCreate} className="gradient-pink text-primary-foreground border-none hover:opacity-90" disabled={affiliates.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Registrar Pagamento
        </Button>
      </div>

      {/* Payouts list */}
      {payouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Nenhum pagamento de comissão registrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payouts.map((p) => (
            <div key={p.id} className="flex items-center gap-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{getAffiliateName(p.affiliate_id)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {p.paid_at
                    ? `Pago em ${new Date(p.paid_at).toLocaleDateString("pt-BR")}`
                    : `Criado em ${new Date(p.created_at).toLocaleDateString("pt-BR")}`}
                  {p.notes && ` • ${p.notes}`}
                </p>
              </div>
              <p className="text-sm font-bold">{formatBRL(p.amount_cents)}</p>
              <Select value={p.status} onValueChange={(v) => handleUpdateStatus(p.id, v)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ Pendente</SelectItem>
                  <SelectItem value="paid">✅ Pago</SelectItem>
                  <SelectItem value="canceled">❌ Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                    <TrashIcon className="h-3.5 w-3.5" />
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
          ))}
        </div>
      )}

      {/* Create payout modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento de Comissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Afiliado</Label>
              <Select value={form.affiliate_id} onValueChange={(v) => setForm({ ...form, affiliate_id: v })}>
                <SelectTrigger>
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
                value={(form.amount_cents / 100).toFixed(2)}
                onChange={(e) => setForm({ ...form, amount_cents: Math.round(Number(e.target.value) * 100) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
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
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !form.affiliate_id || form.amount_cents <= 0}
              className="gradient-pink text-primary-foreground border-none"
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
