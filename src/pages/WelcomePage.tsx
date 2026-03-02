import { HandMetal } from "lucide-react";

const WelcomePage = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <HandMetal className="h-6 w-6 text-primary" />
      <h1 className="font-display text-2xl font-bold">Boas Vindas</h1>
    </div>
    <p className="text-muted-foreground">Configure as mensagens de boas-vindas para novos membros.</p>
  </div>
);

export default WelcomePage;
