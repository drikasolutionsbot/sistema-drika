import { Crown } from "lucide-react";

const VipsPage = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Crown className="h-6 w-6 text-primary" />
      <h1 className="font-display text-2xl font-bold">VIPs</h1>
    </div>
    <p className="text-muted-foreground">Gerencie os planos VIP e membros premium.</p>
  </div>
);

export default VipsPage;
