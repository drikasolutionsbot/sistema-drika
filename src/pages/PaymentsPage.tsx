import { CreditCard, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const providers = [
  { key: "mercadopago", name: "Mercado Pago", color: "bg-blue-500/10 text-blue-400" },
  { key: "misticpay", name: "Mistic Pay", color: "bg-purple-500/10 text-purple-400" },
  { key: "efi", name: "Efí", color: "bg-emerald-500/10 text-emerald-400" },
  { key: "pushinpay", name: "PushinPay", color: "bg-orange-500/10 text-orange-400" },
];

const PaymentsPage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Pagamentos</h1>
        <p className="text-muted-foreground">Configure seus provedores de pagamento PIX</p>
      </div>

      <Tabs defaultValue="mercadopago">
        <TabsList className="bg-muted">
          {providers.map(p => (
            <TabsTrigger key={p.key} value={p.key}>{p.name}</TabsTrigger>
          ))}
        </TabsList>

        {providers.map(p => (
          <TabsContent key={p.key} value={p.key}>
            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2.5 ${p.color}`}>
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">Configure as credenciais de acesso</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>API Key / Token</Label>
                  <Input type="password" placeholder="••••••••••••••••" className="bg-muted border-none" />
                </div>
                <div className="space-y-2">
                  <Label>Secret Key</Label>
                  <Input type="password" placeholder="••••••••••••••••" className="bg-muted border-none" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={`https://api.drikasolutions.com/webhooks/${p.key}`} className="bg-muted border-none font-mono text-xs" />
                  <Button variant="outline" size="sm">Copiar</Button>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Configure essa URL no painel do {p.name}
                </p>
              </div>

              <div className="flex gap-3">
                <Button className="gradient-pink text-primary-foreground border-none hover:opacity-90">
                  <Check className="mr-2 h-4 w-4" /> Salvar
                </Button>
                <Button variant="outline">Testar Conexão</Button>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default PaymentsPage;
