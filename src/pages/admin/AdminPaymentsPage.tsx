import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Plug } from "lucide-react";
import SubscriptionPaymentsTab from "@/components/admin/SubscriptionPaymentsTab";
import PushinPayIntegrationTab from "@/components/admin/PushinPayIntegrationTab";

const AdminPaymentsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assinaturas</h1>
        <p className="text-muted-foreground">Pagamentos de assinatura e integração com gateway</p>
      </div>

      <Tabs defaultValue="payments" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="integration" className="gap-2">
            <Plug className="h-4 w-4" />
            Integração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <SubscriptionPaymentsTab />
        </TabsContent>

        <TabsContent value="integration">
          <PushinPayIntegrationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPaymentsPage;
