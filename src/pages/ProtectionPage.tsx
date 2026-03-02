import { Shield } from "lucide-react";

const ProtectionPage = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Shield className="h-6 w-6 text-primary" />
      <h1 className="font-display text-2xl font-bold">Proteção</h1>
    </div>
    <p className="text-muted-foreground">Configure anti-raid, anti-spam e outras proteções do servidor.</p>
  </div>
);

export default ProtectionPage;
