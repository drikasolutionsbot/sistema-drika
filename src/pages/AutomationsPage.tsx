import { Zap } from "lucide-react";

const AutomationsPage = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Zap className="h-6 w-6 text-primary" />
      <h1 className="font-display text-2xl font-bold">Ações Automáticas</h1>
    </div>
    <p className="text-muted-foreground">Configure automações e ações automáticas do bot.</p>
  </div>
);

export default AutomationsPage;
