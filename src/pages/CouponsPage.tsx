import { useState, useEffect } from "react";
import {
  Plus, Tag, Search, Percent, DollarSign, Copy,
  ChevronDown, ChevronUp, Ticket, Calendar, Hash,
} from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

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

const emptyCoupon = {
  code: "",
  type: "percent" as "percent" | "fixed",
  value: 10,
  max_uses: 100,
  expires_at: "",
  product_id: "" as string,
};

const CouponsPage = () => {
  const { tenantId } = useTenant();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCoupon, setNewCoupon] = useState(emptyCoupon);

  const { data: products = [] } = useQuery<{id: string, name: string}[]>({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.functions.invoke("manage-products", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error || data?.error) return [];
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const fetchCoupons = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-coupons", {
      body: { action: "list", tenant_id: tenantId },
    });
    if (!error && !data?.error) {
      setCoupons(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, [tenantId]);

  const handleCreate = async () => {
    if (!tenantId || !newCoupon.code.trim()) {
      toast({ title: "Informe o código do cupom", variant: "destructive" });
      return;
    }
    if (newCoupon.value <= 0) {
      toast({ title: "O valor do desconto deve ser maior que zero", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("manage-coupons", {
      body: {
        action: "create",
        tenant_id: tenantId,
        product_id: newCoupon.product_id || null,
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
      setNewCoupon(emptyCoupon);
      setShowCreate(false);
      toast({ title: "Cupom criado com sucesso!" });
    }
    setCreating(false);
  };

  const handleUpdate = async (coupon: Coupon) => {
    if (!tenantId) return;
    setSaving(coupon.id);
    const { data, error } = await supabase.functions.invoke("manage-coupons", {
      body: {
        action: "update",
        tenant_id: tenantId,
        coupon_id: coupon.id,
        product_id: coupon.product_id,
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
      toast({ title: "Erro ao salvar cupom", variant: "destructive" });
    } else {
      setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? data : c)));
      toast({ title: "Cupom atualizado!" });
    }
    setSaving(null);
  };

  const handleDelete = async (couponId: string) => {
    if (!tenantId) return;
    const { data, error } = await supabase.functions.invoke("manage-coupons", {
      body: { action: "delete", tenant_id: tenantId, coupon_id: couponId },
    });
    if (error || data?.error) {
      toast({ title: "Erro ao excluir cupom", variant: "destructive" });
    } else {
      setCoupons((prev) => prev.filter((c) => c.id !== couponId));
      if (expandedId === couponId) setExpandedId(null);
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

  const filtered = coupons.filter((c) =>
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = coupons.filter((c) => c.active).length;
  const totalUses = coupons.reduce((acc, c) => acc + c.used_count, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Cupons</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie cupons de desconto da sua loja
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="gradient-pink text-primary-foreground border-none hover:opacity-90"
        >
          <Plus className="mr-2 h-4 w-4" /> Novo Cupom
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm shadow-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -z-10 translate-x-1/3 -translate-y-1/3" />
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Tag className="h-3.5 w-3.5" /> Total
          </div>
          <p className="text-2xl font-bold font-display">{coupons.length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm shadow-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -z-10 translate-x-1/3 -translate-y-1/3" />
          <div className="flex items-center gap-2 text-emerald-400 text-xs mb-1">
            <Ticket className="h-3.5 w-3.5" /> Ativos
          </div>
          <p className="text-2xl font-bold font-display">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm shadow-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -z-10 translate-x-1/3 -translate-y-1/3" />
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Hash className="h-3.5 w-3.5" /> Usos totais
          </div>
          <p className="text-2xl font-bold font-display">{totalUses}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cupons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/[0.02] border-white/5 h-11 rounded-xl"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground relative">
          <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full" />
          <Ticket className="h-12 w-12 mb-3 text-primary/40 relative z-10" />
          <p className="font-medium text-white/80 relative z-10">Nenhum cupom encontrado</p>
          <p className="text-xs mt-1 text-white/50 relative z-10">Crie seu primeiro cupom de desconto</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((coupon) => {
            const isExpanded = expandedId === coupon.id;
            const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
            const isMaxed = coupon.max_uses !== null && coupon.used_count >= coupon.max_uses;

            return (
              <div
                key={coupon.id}
                className={`rounded-2xl border transition-all duration-300 relative overflow-hidden shadow-sm ${
                  isExpanded
                    ? "border-primary/30 bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.05)]"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10"
                }`}
              >
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    {coupon.type === "percent" ? (
                      <Percent className="h-5 w-5 text-primary" />
                    ) : (
                      <DollarSign className="h-5 w-5 text-primary" />
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
                      {coupon.product_id && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                          Produto
                        </Badge>
                      )}
                      {!coupon.product_id && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-400">
                          Global
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDiscount(coupon)} de desconto · {coupon.used_count}
                      {coupon.max_uses ? `/${coupon.max_uses}` : ""} usos
                      {" · "}
                      <span className="text-foreground/80 font-medium">
                        {coupon.product_id 
                          ? (products.find((p) => p.id === coupon.product_id)?.name || "Produto Específico") 
                          : "Global (Todos)"}
                      </span>
                      {coupon.expires_at && (
                        <>
                          {" "}· <Calendar className="inline h-3 w-3" />{" "}
                          {new Date(coupon.expires_at).toLocaleDateString("pt-BR")}
                        </>
                      )}
                    </p>
                  </div>
                  <Switch
                    checked={coupon.active}
                    onCheckedChange={() => handleToggle(coupon)}
                  />
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : coupon.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Expanded edit */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-border space-y-4 animate-fade-in">
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
                          placeholder="Ilimitado"
                          className="mt-1.5 h-9 bg-muted/50 border-border text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Aplicar a</Label>
                        <Select
                          value={coupon.product_id || "all"}
                          onValueChange={(val) => updateCoupon(coupon.id, { product_id: val === "all" ? null : val })}
                        >
                          <SelectTrigger className="mt-1.5 h-9 bg-muted/50 border-border text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Global (Todos os Produtos)</SelectItem>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Expira em (opcional)</Label>
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
                        {saving === coupon.id ? "Salvando..." : "Salvar Alterações"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Novo Cupom
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Código do cupom</Label>
              <Input
                value={newCoupon.code}
                onChange={(e) => setNewCoupon((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="EX: DESCONTO10"
                className="mt-1.5 bg-muted/50 border-border uppercase"
                maxLength={30}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo de desconto</Label>
                <Select
                  value={newCoupon.type}
                  onValueChange={(val) => setNewCoupon((p) => ({ ...p, type: val as "percent" | "fixed" }))}
                >
                  <SelectTrigger className="mt-1.5 bg-muted/50 border-border text-sm">
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
                  className="mt-1.5 bg-muted/50 border-border text-sm"
                  min={1}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Aplicar a</Label>
                <Select
                  value={newCoupon.product_id || "all"}
                  onValueChange={(val) => setNewCoupon((p) => ({ ...p, product_id: val === "all" ? "" : val }))}
                >
                  <SelectTrigger className="mt-1.5 bg-muted/50 border-border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Global (Todos os Produtos)</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Limite de usos</Label>
                <Input
                  type="number"
                  value={newCoupon.max_uses ?? ""}
                  onChange={(e) => setNewCoupon((p) => ({ ...p, max_uses: parseInt(e.target.value) || 0 }))}
                  placeholder="Ilimitado"
                  className="mt-1.5 bg-muted/50 border-border text-sm"
                  min={0}
                />
              </div>
              <div>
                <Label className="text-xs">Expira em (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={newCoupon.expires_at}
                  onChange={(e) => setNewCoupon((p) => ({ ...p, expires_at: e.target.value }))}
                  className="mt-1.5 bg-muted/50 border-border text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="gradient-pink text-primary-foreground border-none hover:opacity-90"
            >
              {creating ? "Criando..." : "Criar Cupom"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CouponsPage;
