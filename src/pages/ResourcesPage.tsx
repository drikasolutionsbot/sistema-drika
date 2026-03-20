import { Box } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RolesTab } from "@/components/resources/RolesTab";
import { CommandsTab } from "@/components/resources/CommandsTab";
import { ModulesTab } from "@/components/resources/ModulesTab";

const ResourcesPage = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Box className="h-6 w-6 text-primary" />
      <h1 className="font-display text-2xl font-bold">Recursos</h1>
    </div>

    <Tabs defaultValue="comandos" className="space-y-4">
      <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
        <TabsList className="bg-muted w-max min-w-full sm:w-auto">
          <TabsTrigger value="cargos">Cargos</TabsTrigger>
          <TabsTrigger value="comandos">Comandos</TabsTrigger>
          <TabsTrigger value="modulos">Módulos</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="cargos" className="mt-0">
        <RolesTab />
      </TabsContent>
      <TabsContent value="comandos" className="mt-0">
        <CommandsTab />
      </TabsContent>
      <TabsContent value="modulos" className="mt-0">
        <ModulesTab />
      </TabsContent>
    </Tabs>
  </div>
);

export default ResourcesPage;
