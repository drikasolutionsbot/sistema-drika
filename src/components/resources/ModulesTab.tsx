import { useState } from "react";
import {
  HandMetal, Store, Shield, Gift, Crown, Link2, Ticket, Zap, Cloud, MessageSquare,
  Plus, Puzzle,
} from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface BotModule {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  color: string;
  custom?: boolean;
}

const defaultModules: BotModule[] = [
  { id: "welcome", name: "Boas-Vindas", description: "Mensagens automáticas ao entrar no servidor", icon: HandMetal, enabled: true, color: "text-green-400" },
  { id: "store", name: "Loja", description: "Sistema de vendas com pagamentos integrados", icon: Store, enabled: true, color: "text-secondary" },
  { id: "tickets", name: "Tickets", description: "Suporte via canais privados", icon: Ticket, enabled: true, color: "text-blue-400" },
  { id: "protection", name: "Proteção", description: "Anti-raid, anti-spam e verificação", icon: Shield, enabled: true, color: "text-destructive" },
  { id: "automations", name: "Ações Automáticas", description: "Respostas automáticas e triggers", icon: Zap, enabled: false, color: "text-amber-400" },
  { id: "giveaways", name: "Sorteios", description: "Crie e gerencie sorteios no servidor", icon: Gift, enabled: false, color: "text-purple-400" },
  { id: "vips", name: "VIPs", description: "Planos de assinatura com cargos automáticos", icon: Crown, enabled: false, color: "text-yellow-400" },
  { id: "invite-tracking", name: "Rastreamento de Convites", description: "Acompanhe quem convidou quem", icon: Link2, enabled: false, color: "text-cyan-400" },
  { id: "ecloud", name: "eCloud", description: "Hospedagem e armazenamento de arquivos", icon: Cloud, enabled: false, color: "text-sky-400" },
  { id: "logs", name: "Logs", description: "Registro de ações no servidor", icon: MessageSquare, enabled: true, color: "text-muted-foreground" },
];

export const ModulesTab = () => {
  const [modules, setModules] = useState<BotModule[]>(defaultModules);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const toggleModule = (id: string) => {
    setModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const addModule = () => {
    if (!newName.trim() || !newDesc.trim()) {
      toast({ title: "Preencha nome e descrição", variant: "destructive" });
      return;
    }
    if (modules.some((m) => m.name.toLowerCase() === newName.trim().toLowerCase())) {
      toast({ title: "Módulo já existe", variant: "destructive" });
      return;
    }
    setModules((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: newName.trim(),
        description: newDesc.trim(),
        icon: Puzzle,
        enabled: true,
        color: "text-primary",
        custom: true,
      },
    ]);
    setNewName("");
    setNewDesc("");
    setCreateOpen(false);
    toast({ title: "Módulo criado!" });
  };

  const removeModule = (id: string) => {
    setModules((prev) => prev.filter((m) => m.id !== id));
  };

  const activeCount = modules.filter((m) => m.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Ative ou desative os módulos do bot para este servidor.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{activeCount} ativos</span>
            <span>/</span>
            <span>{modules.length} total</span>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Criar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.id}
              className={cn(
                "flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all",
                !mod.enabled && "opacity-50"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0")}>
                  <Icon className={cn("h-5 w-5", mod.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{mod.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{mod.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={mod.enabled}
                  onCheckedChange={() => toggleModule(mod.id)}
                />
                {mod.custom && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeModule(mod.id)}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Módulo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do módulo</Label>
              <Input
                placeholder="Meu Módulo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                placeholder="O que este módulo faz..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={addModule}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};