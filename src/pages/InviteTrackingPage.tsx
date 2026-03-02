import { Link2 } from "lucide-react";

const InviteTrackingPage = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Link2 className="h-6 w-6 text-primary" />
      <h1 className="font-display text-2xl font-bold">Rastreamento de Convites</h1>
    </div>
    <p className="text-muted-foreground">Acompanhe e gerencie os convites do servidor.</p>
  </div>
);

export default InviteTrackingPage;
