import { Hash, MessageSquare, Shield, Users, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const channelSections = [
  {
    title: "Sistema",
    icon: Volume2,
    channels: [
      { key: "logs_system", label: "Logs do Sistema" },
      { key: "logs_commands", label: "Logs de Comandos" },
    ],
  },
  {
    title: "Loja",
    icon: Hash,
    channels: [
      { key: "logs_sales", label: "Logs de Vendas" },
      { key: "logs_events", label: "Eventos de Compra" },
      { key: "logs_feedback", label: "Feedback" },
    ],
  },
  {
    title: "Membros",
    icon: Users,
    channels: [
      { key: "welcome", label: "Boas-vindas" },
      { key: "member_join", label: "Entrada" },
      { key: "member_leave", label: "Saída" },
      { key: "traffic", label: "Tráfego" },
    ],
  },
  {
    title: "Moderação",
    icon: Shield,
    channels: [
      { key: "logs_moderation_bans", label: "Bans" },
      { key: "logs_moderation_kicks", label: "Kicks" },
      { key: "logs_moderation_timeouts", label: "Timeouts" },
    ],
  },
];

const mockChannels = [
  { id: "ch1", name: "# logs-vendas" },
  { id: "ch2", name: "# geral" },
  { id: "ch3", name: "# boas-vindas" },
  { id: "ch4", name: "# moderação" },
  { id: "ch5", name: "# feedback" },
];

const ChannelsPage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Canais</h1>
          <p className="text-muted-foreground">Configure os canais de log do Discord</p>
        </div>
        <Button variant="outline">Sincronizar Canais</Button>
      </div>

      <div className="space-y-6">
        {channelSections.map((section) => (
          <div key={section.title} className="rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <section.icon className="h-5 w-5 text-primary" />
              <h2 className="font-display font-semibold">{section.title}</h2>
            </div>
            <div className="divide-y divide-border">
              {section.channels.map((ch) => (
                <div key={ch.key} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm">{ch.label}</span>
                  <Select>
                    <SelectTrigger className="w-56 bg-muted border-none">
                      <SelectValue placeholder="Selecionar canal" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockChannels.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChannelsPage;
