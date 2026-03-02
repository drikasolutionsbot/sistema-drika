import { useState } from "react";
import { Plus, Tag, Trash2, Edit, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const mockCoupons = [
  { id: "1", code: "WELCOME10", type: "percent", value: 10, maxUses: 100, usedCount: 23, active: true, expiresAt: "2026-04-01" },
  { id: "2", code: "VIP50", type: "fixed", value: 5000, maxUses: 10, usedCount: 7, active: true, expiresAt: null },
  { id: "3", code: "SUMMER20", type: "percent", value: 20, maxUses: 50, usedCount: 50, active: false, expiresAt: "2026-02-01" },
];

const CouponsPage = () => {
  const [search, setSearch] = useState("");
  const filtered = mockCoupons.filter(c => c.code.toLowerCase().includes(search.toLowerCase()));

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
              <span>{coupon.usedCount}/{coupon.maxUses} usos</span>
              {coupon.expiresAt && <span>Expira: {coupon.expiresAt}</span>}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground"><Edit className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CouponsPage;
