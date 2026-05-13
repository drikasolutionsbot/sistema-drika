import { useEffect, useState } from "react";
import { Globe, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { isPaidPlan } from "@/lib/plans";
import { toast } from "@/hooks/use-toast";

interface Props {
  productId: string;
  productName: string;
  productPriceCents: number;
}

type Status = "not_submitted" | "pending" | "approved" | "rejected" | "removed";

interface Listing {
  id: string;
  global_status: Status;
  rejection_reason?: string | null;
  category_global?: string | null;
  total_sales?: number;
}

export const GlobalMarketplaceSubmitButton = ({ productId, productName, productPriceCents }: Props) => {
  const { tenantId, tenant } = useTenant();
  const [listing, setListing] = useState<Listing | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const paid = isPaidPlan(tenant?.plan);

  const refresh = async () => {
    if (!tenantId) return;
    const { data } = await supabase.functions.invoke("manage-global-marketplace", {
      body: { action: "list_own", tenant_id: tenantId },
    });
    if (Array.isArray(data)) {
      const found = data.find((l: any) => l.product_id === productId && l.global_status !== "removed");
      setListing(found || null);
    }
  };

  useEffect(() => { refresh(); }, [tenantId, productId]);

  const status: Status = listing?.global_status || "not_submitted";

  const submit = async () => {
    if (!tenantId) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("manage-global-marketplace", {
      body: { action: "submit", tenant_id: tenantId, product_id: productId },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast({ title: "Erro", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Enviado para análise! 🌍", description: "Você será notificado quando for revisado." });
    setOpen(false);
    refresh();
  };

  const cancel = async () => {
    if (!tenantId || !listing) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("manage-global-marketplace", {
      body: { action: "cancel", tenant_id: tenantId, listing_id: listing.id },
    });
    setSubmitting(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Submissão cancelada" });
    refresh();
  };

  const config: Record<Status, { label: string; icon: any; variant: any; cls: string }> = {
    not_submitted: { label: "Marketplace Global", icon: Globe, variant: "outline", cls: "" },
    pending: { label: "Em análise", icon: Clock, variant: "outline", cls: "border-amber-500/40 text-amber-500" },
    approved: { label: "Publicado globalmente", icon: CheckCircle2, variant: "outline", cls: "border-emerald-500/40 text-emerald-500" },
    rejected: { label: "Rejeitado", icon: XCircle, variant: "outline", cls: "border-destructive/40 text-destructive" },
    removed: { label: "Marketplace Global", icon: Globe, variant: "outline", cls: "" },
  };
  const c = config[status];

  if (!paid) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={`text-xs px-2 sm:px-3 ${c.cls}`}
        onClick={() => setOpen(true)}
      >
        <c.icon className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">{c.label}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Marketplace Global
            </DialogTitle>
            <DialogDescription>
              Publique este produto na vitrine global da Drika para alcançar mais compradores.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-border p-3 bg-muted/30">
              <p className="text-sm font-medium">{productName}</p>
              <p className="text-xs text-muted-foreground">
                Preço: R$ {(productPriceCents / 100).toFixed(2)} • Comissão SaaS: 2%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Você recebe: R$ {((productPriceCents * 0.98) / 100).toFixed(2)} por venda
              </p>
            </div>

            {status === "not_submitted" && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Aprovação manual feita pela equipe Drika</p>
                <p>• Pagamento via PIX centralizado, split automático</p>
                <p>• Entrega usa o mesmo fluxo da sua loja</p>
              </div>
            )}

            {status === "pending" && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                <Clock className="h-3 w-3 mr-1" /> Aguardando aprovação
              </Badge>
            )}

            {status === "approved" && (
              <div className="space-y-1">
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Publicado em "{listing?.category_global}"
                </Badge>
                <p className="text-xs text-muted-foreground">{listing?.total_sales || 0} vendas globais</p>
              </div>
            )}

            {status === "rejected" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-medium text-destructive">Motivo da rejeição:</p>
                <p className="text-xs text-muted-foreground mt-1">{listing?.rejection_reason}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            {status === "not_submitted" || status === "rejected" ? (
              <Button onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
                Enviar para aprovação
              </Button>
            ) : status === "pending" ? (
              <Button variant="outline" onClick={cancel} disabled={submitting}>
                Cancelar submissão
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
