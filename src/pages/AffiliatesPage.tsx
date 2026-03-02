import { Plus, Users, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";

const mockAffiliates = [
  { id: "1", name: "João Silva", code: "JOAO10", commission: 10, sales: 42, revenue: 12540 },
  { id: "2", name: "Maria Souza", code: "MARIA15", commission: 15, sales: 28, revenue: 8320 },
  { id: "3", name: "Pedro Lima", code: "PEDRO5", commission: 5, sales: 65, revenue: 5200 },
];

const AffiliatesPage = () => {
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockAffiliates.map((aff) => (
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
                <p className="text-lg font-bold font-display">{aff.commission}%</p>
                <p className="text-xs text-muted-foreground">Comissão</p>
              </div>
              <div>
                <p className="text-lg font-bold font-display">{aff.sales}</p>
                <p className="text-xs text-muted-foreground">Vendas</p>
              </div>
              <div>
                <p className="text-lg font-bold font-display">R$ {(aff.revenue / 100).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Receita</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AffiliatesPage;
