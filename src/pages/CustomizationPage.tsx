import { Palette } from "lucide-react";

const CustomizationPage = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Palette className="h-6 w-6 text-primary" />
      <h1 className="font-display text-2xl font-bold">Personalização</h1>
    </div>
    <p className="text-muted-foreground">Configure a aparência e identidade visual do seu bot.</p>
  </div>
);

export default CustomizationPage;
