import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantQuery } from "@/hooks/useSupabaseQuery";

interface Affiliate {
  id: string;
  name: string;
  code: string;
  commission_percent: number;
  total_sales: number;
  total_revenue_cents: number;
}

const AffiliatesPage = () => {
  const { data: affiliates = [], isLoading } = useTenantQuery<Affiliate>("affiliates", "affiliates");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Afiliados</h1>
          <p className="text-muted-foreground">Gerencie seus afiliados e comissões</p>
        </div>
        <Button className="gradient-pink text-primary-foreground border-none hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" /> Novo Afiliado
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-36" />)}</div>
      ) : affiliates.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum afiliado cadastrado</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {affiliates.map((aff) => (
            <div key={aff.id} className="rounded-xl border border-border bg-card p-5 space-y-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-pink">
                  <Users className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{aff.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{aff.code}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold font-display">{aff.commission_percent}%</p>
                  <p className="text-xs text-muted-foreground">Comissão</p>
                </div>
                <div>
                  <p className="text-lg font-bold font-display">{aff.total_sales}</p>
                  <p className="text-xs text-muted-foreground">Vendas</p>
                </div>
                <div>
                  <p className="text-lg font-bold font-display">R$ {(aff.total_revenue_cents / 100).toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Receita</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AffiliatesPage;
