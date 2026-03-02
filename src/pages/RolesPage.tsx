import { ShieldCheck } from "lucide-react";

const RolesPage = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <ShieldCheck className="h-6 w-6 text-primary" />
      <h1 className="font-display text-2xl font-bold">Cargos</h1>
    </div>
    <p className="text-muted-foreground">Configure os cargos e permissões do servidor.</p>
  </div>
);

export default RolesPage;
