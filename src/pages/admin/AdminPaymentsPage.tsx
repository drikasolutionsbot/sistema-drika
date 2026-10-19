import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Plug, Zap, Settings2 } from "lucide-react";
import abacatePayIcon from "@/assets/abacatepay-icon.png";
import SubscriptionPaymentsTab from "@/components/admin/SubscriptionPaymentsTab";
import EfiIntegrationTab from "@/components/admin/EfiIntegrationTab";
import PushinPayIntegrationTab from "@/components/admin/PushinPayIntegrationTab";
import AbacatePayIntegrationTab from "@/components/admin/AbacatePayIntegrationTab";
import GatewaySettingsTab from "@/components/admin/GatewaySettingsTab";
import ColdPaymentsIntegrationTab from "@/components/admin/ColdPaymentsIntegrationTab";

const AdminPaymentsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Assinaturas</h1>
        <p className="text-muted-foreground">Pagamentos de assinatura e integração com provedores PIX</p>
      </div>

      <Tabs defaultValue="payments" className="space-y-6">
        <div className="overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="bg-card border border-border w-max min-w-full sm:w-auto">
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="gateways" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Gateways
            </TabsTrigger>
            <TabsTrigger value="efi" className="gap-2">
              <Plug className="h-4 w-4" />
              Efí
            </TabsTrigger>
            <TabsTrigger value="pushinpay" className="gap-2">
              <Zap className="h-4 w-4" />
              PushinPay
            </TabsTrigger>
            <TabsTrigger value="abacatepay" className="gap-2">
              <img src={abacatePayIcon} alt="AbacatePay" className="h-4 w-4 object-contain" />
              AbacatePay
            </TabsTrigger>
            <TabsTrigger value="coldpayments" className="gap-2">
              <Zap className="h-4 w-4 text-sky-400" />
              ColdPayments
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="payments">
          <SubscriptionPaymentsTab />
        </TabsContent>

        <TabsContent value="gateways">
          <div className="space-y-2">
            <div>
              <h2 className="text-base font-semibold">Controle de Gateways</h2>
              <p className="text-sm text-muted-foreground">
                Ative, desative ou oculte gateways de pagamento para todos os clientes da plataforma.
              </p>
            </div>
            <GatewaySettingsTab />
          </div>
        </TabsContent>

        <TabsContent value="efi">
          <EfiIntegrationTab />
        </TabsContent>

        <TabsContent value="pushinpay">
          <PushinPayIntegrationTab />
        </TabsContent>

        <TabsContent value="abacatepay">
          <AbacatePayIntegrationTab />
        </TabsContent>

        <TabsContent value="coldpayments">
          <ColdPaymentsIntegrationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPaymentsPage;
