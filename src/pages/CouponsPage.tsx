import { useState } from "react";
import { Plus, Tag, Edit, Search } from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantQuery } from "@/hooks/useSupabaseQuery";

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: number;
  max_uses: number;
  used_count: number;
  active: boolean;
  expires_at: string | null;
}

const CouponsPage = () => {
  const [search, setSearch] = useState("");
  const { data: coupons = [], isLoading } = useTenantQuery<Coupon>("coupons", "coupons");
  const filtered = coupons.filter(c => c.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Cupons</h1>
          <p className="text-muted-foreground">Gerencie cupons de desconto</p>
        </div>
        <Button className="gradient-pink text-primary-foreground border-none hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" /> Novo Cupom
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar cupons..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-muted border-none" />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum cupom encontrado</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((coupon) => (
            <div key={coupon.id} className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <span className="font-mono text-sm font-bold">{coupon.code}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${coupon.active ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                  {coupon.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <div className="text-2xl font-bold font-display">
                {coupon.type === "percent" ? `${coupon.value}%` : `R$ ${(coupon.value / 100).toFixed(2)}`}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{coupon.used_count}/{coupon.max_uses} usos</span>
                {coupon.expires_at && <span>Expira: {new Date(coupon.expires_at).toLocaleDateString("pt-BR")}</span>}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground"><Edit className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"><TrashIcon className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CouponsPage;
