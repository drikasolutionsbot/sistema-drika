import { useState, useEffect } from "react";
import {
  Plus,
  Ticket,
  Percent,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";

interface Coupon {
  id: string;
  tenant_id: string;
  product_id: string | null;
  code: string;
  type: "percent" | "fixed";
  value: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface ProductDetailCouponsProps {
  productId: string;
}

export const ProductDetailCoupons = ({ productId }: ProductDetailCouponsProps) => {
  const { tenantId } = useTenant();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    type: "percent" as "percent" | "fixed",
    value: 10,
    max_uses: 100,
    expires_at: "",
  });

  const fetchCoupons = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-coupons", {
      body: { action: "list_product", tenant_id: tenantId, product_id: productId },
    });
    if (!error && !data?.error) {
      setCoupons(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, [productId, tenantId]);

  const handleCreate = async () => {
    if (!tenantId || !newCoupon.code.trim()) {
      toast({ title: "Informe o código do cupom", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.functions.invoke("manage-coupons", {
      body: {
        action: "create",
        tenant_id: tenantId,
        product_id: productId,
        coupon: {
          code: newCoupon.code,
          type: newCoupon.type,
          value: newCoupon.value,
          max_uses: newCoupon.max_uses || null,
          expires_at: newCoupon.expires_at || null,
        },
      },
    });
    if (error || data?.error) {
      toast({ title: "Erro ao criar cupom", description: error?.message || data?.error, variant: "destructive" });
    } else {
      setCoupons((prev) => [data, ...prev]);
      setNewCoupon({ code: "", type: "percent", value: 10, max_uses: 100, expires_at: "" });
      setShowCreate(false);
      toast({ title: "Cupom criado!" });
    }
  };

  const handleUpdate = async (coupon: Coupon) => {
    if (!tenantId) return;
    setSaving(coupon.id);
    const { data, error } = await supabase.functions.invoke("manage-coupons", {
      body: {
        action: "update",
        tenant_id: tenantId,
        coupon_id: coupon.id,
        coupon: {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          max_uses: coupon.max_uses,
          active: coupon.active,
          expires_at: coupon.expires_at,
        },
      },
    });
    if (error || data?.error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } else {
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? data : c)));
      toast({ title: "Cupom salvo!" });
    }
    setSaving(null);
  };

  const handleDelete = async (couponId: string) => {
    if (!tenantId) return;
    const { data, error } = await supabase.functions.invoke("manage-coupons", {
      body: { action: "delete", tenant_id: tenantId, coupon_id: couponId },
    });
    if (error || data?.error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      setCoupons((prev) => prev.filter((c) => c.id !== couponId));
      toast({ title: "Cupom removido!" });
    }
  };

  const handleToggle = async (coupon: Coupon) => {
    const updated = { ...coupon, active: !coupon.active };
    setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? updated : c)));
    await handleUpdate(updated);
  };

  const updateCoupon = (id: string, updates: Partial<Coupon>) => {
    setCoupons((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Código copiado!" });
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.type === "percent") return `${coupon.value}%`;
    return `R$ ${(coupon.value / 100).toFixed(2).replace(".", ",")}`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Cupons do Produto</h3>
          <p className="text-xs text-muted-foreground">
            Cupons de desconto vinculados a este produto
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Novo Cupom
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-4 animate-fade-in">
          <p className="text-sm font-semibold">Criar novo cupom</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Código</Label>
              <Input
                value={newCoupon.code}
                onChange={(e) => setNewCoupon((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="EX: DESCONTO10"
                className="mt-1.5 h-9 bg-muted/50 border-border text-sm uppercase"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={newCoupon.type}
                onValueChange={(val) => setNewCoupon((p) => ({ ...p, type: val as "percent" | "fixed" }))}
              >
                <SelectTrigger className="mt-1.5 h-9 bg-muted/50 border-border text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">
                {newCoupon.type === "percent" ? "Desconto (%)" : "Desconto (centavos)"}
              </Label>
              <Input
                type="number"
                value={newCoupon.value}
                onChange={(e) => setNewCoupon((p) => ({ ...p, value: parseInt(e.target.value) || 0 }))}
                className="mt-1.5 h-9 bg-muted/50 border-border text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Limite de usos</Label>
              <Input
                type="number"
                value={newCoupon.max_uses}
                onChange={(e) => setNewCoupon((p) => ({ ...p, max_uses: parseInt(e.target.value) || 0 }))}
                className="mt-1.5 h-9 bg-muted/50 border-border text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Expira em (opcional)</Label>
              <Input
                type="datetime-local"
                value={newCoupon.expires_at}
                onChange={(e) => setNewCoupon((p) => ({ ...p, expires_at: e.target.value }))}
                className="mt-1.5 h-9 bg-muted/50 border-border text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              className="gradient-pink text-primary-foreground border-none hover:opacity-90 text-xs"
            >
              Criar Cupom
            </Button>
          </div>
        </div>
      )}

      {/* Coupons list */}
      {coupons.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Ticket className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">Nenhum cupom vinculado</p>
          <p className="text-xs mt-1">Crie um cupom exclusivo para este produto</p>
        </div>
      ) : (
        <div className="space-y-2">
          {coupons.map((coupon) => {
            const isExpanded = expandedId === coupon.id;
            const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
            const isMaxed = coupon.max_uses !== null && coupon.used_count >= coupon.max_uses;

            return (
              <div
                key={coupon.id}
                className={`rounded-xl border transition-all duration-200 ${
                  isExpanded ? "border-primary/30 bg-card" : "border-border bg-muted/20 hover:bg-muted/40"
                }`}
              >
                {/* Coupon header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    {coupon.type === "percent" ? (
                      <Percent className="h-4 w-4 text-primary" />
                    ) : (
                      <DollarSign className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-bold font-mono">{coupon.code}</code>
                      <button
                        onClick={() => copyCode(coupon.code)}
                        className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          isExpired || isMaxed
                            ? "border-destructive/40 text-destructive"
                            : coupon.active
                            ? "border-emerald-500/40 text-emerald-400"
                            : "border-muted-foreground/40 text-muted-foreground"
                        }`}
                      >
                        {isExpired ? "Expirado" : isMaxed ? "Esgotado" : coupon.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDiscount(coupon)} de desconto · {coupon.used_count}
                      {coupon.max_uses ? `/${coupon.max_uses}` : ""} usos
                    </p>
                  </div>
                  <Switch
                    checked={coupon.active}
                    onCheckedChange={() => handleToggle(coupon)}
                    className="mr-1"
                  />
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : coupon.id)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Expanded edit */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-border space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Código</Label>
                        <Input
                          value={coupon.code}
                          onChange={(e) => updateCoupon(coupon.id, { code: e.target.value.toUpperCase() })}
                          className="mt-1.5 h-9 bg-muted/50 border-border text-sm uppercase"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select
                          value={coupon.type}
                          onValueChange={(val) => updateCoupon(coupon.id, { type: val as "percent" | "fixed" })}
                        >
                          <SelectTrigger className="mt-1.5 h-9 bg-muted/50 border-border text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">Percentual (%)</SelectItem>
                            <SelectItem value="fixed">Fixo (R$)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">
                          {coupon.type === "percent" ? "Desconto (%)" : "Desconto (centavos)"}
                        </Label>
                        <Input
                          type="number"
                          value={coupon.value}
                          onChange={(e) => updateCoupon(coupon.id, { value: parseInt(e.target.value) || 0 })}
                          className="mt-1.5 h-9 bg-muted/50 border-border text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Limite de usos</Label>
                        <Input
                          type="number"
                          value={coupon.max_uses ?? ""}
                          onChange={(e) =>
                            updateCoupon(coupon.id, {
                              max_uses: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                          className="mt-1.5 h-9 bg-muted/50 border-border text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Expira em</Label>
                        <Input
                          type="datetime-local"
                          value={coupon.expires_at ? coupon.expires_at.slice(0, 16) : ""}
                          onChange={(e) => updateCoupon(coupon.id, { expires_at: e.target.value || null })}
                          className="mt-1.5 h-9 bg-muted/50 border-border text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                        onClick={() => handleDelete(coupon.id)}
                      >
                        <TrashIcon className="h-3.5 w-3.5 mr-1.5" />
                        Excluir
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(coupon)}
                        disabled={saving === coupon.id}
                        className="gradient-pink text-primary-foreground border-none hover:opacity-90 text-xs"
                      >
                        {saving === coupon.id ? "Salvando..." : "Salvar Cupom"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
