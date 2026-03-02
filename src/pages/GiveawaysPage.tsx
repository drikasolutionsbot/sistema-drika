import { Gift } from "lucide-react";

const GiveawaysPage = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Gift className="h-6 w-6 text-primary" />
      <h1 className="font-display text-2xl font-bold">Sorteios</h1>
    </div>
    <p className="text-muted-foreground">Crie e gerencie sorteios no servidor.</p>
  </div>
);

export default GiveawaysPage;
