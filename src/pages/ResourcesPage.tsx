import { Box } from "lucide-react";

const ResourcesPage = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Box className="h-6 w-6 text-primary" />
      <h1 className="font-display text-2xl font-bold">Recursos</h1>
    </div>
    <p className="text-muted-foreground">Gerencie os recursos e funcionalidades do seu bot.</p>
  </div>
);

export default ResourcesPage;
