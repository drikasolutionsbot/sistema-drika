import { useState } from "react";
import { Search, Terminal, Upload, Loader2, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BotCommand {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}

const defaultCommands: BotCommand[] = [
  { id: "1", name: "/painel", description: "Abre o painel administrativo no Discord", category: "Admin", enabled: true },
  { id: "2", name: "/comprar", description: "Inicia o fluxo de compra de um produto", category: "Loja", enabled: true },
  { id: "3", name: "/carrinho", description: "Exibe o carrinho do usuário", category: "Loja", enabled: true },
  { id: "4", name: "/estoque", description: "Verifica o estoque de um produto", category: "Loja", enabled: true },
  { id: "5", name: "/ticket", description: "Abre um ticket de suporte", category: "Suporte", enabled: true },
  { id: "6", name: "/fechar", description: "Fecha o ticket atual", category: "Suporte", enabled: true },
  { id: "7", name: "/rank", description: "Exibe o ranking de convites", category: "Convites", enabled: false },
  { id: "8", name: "/convites", description: "Mostra quantos convites o usuário tem", category: "Convites", enabled: false },
  { id: "9", name: "/sortear", description: "Cria um novo sorteio", category: "Sorteios", enabled: false },
  { id: "10", name: "/vip", description: "Ativa um plano VIP para o usuário", category: "VIP", enabled: true },
  { id: "11", name: "/ban", description: "Bane um usuário do servidor", category: "Moderação", enabled: true },
  { id: "12", name: "/kick", description: "Expulsa um usuário do servidor", category: "Moderação", enabled: true },
  { id: "13", name: "/clear", description: "Limpa mensagens do canal", category: "Moderação", enabled: true },
  { id: "14", name: "/afiliado", description: "Gera um link de afiliado", category: "Loja", enabled: false },
];

const categoryColors: Record<string, string> = {
  Admin: "bg-primary/15 text-primary border-primary/20",
  Loja: "bg-secondary/15 text-secondary border-secondary/20",
  Suporte: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Convites: "bg-green-500/15 text-green-400 border-green-500/20",
  Sorteios: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  VIP: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Moderação: "bg-destructive/15 text-destructive border-destructive/20",
};

const AVAILABLE_CATEGORIES = ["Admin", "Loja", "Suporte", "Convites", "Sorteios", "VIP", "Moderação", "Custom"];

export const CommandsTab = () => {
  const [commands, setCommands] = useState<BotCommand[]>(defaultCommands);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const { tenant } = useTenant();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("Custom");

  const filtered = commands.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(commands.map((c) => c.category))];

  const addCommand = () => {
    const name = newName.startsWith("/") ? newName : `/${newName}`;
    if (!newName.trim() || !newDesc.trim()) {
      toast({ title: "Preencha nome e descrição", variant: "destructive" });
      return;
    }
    if (commands.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Comando já existe", variant: "destructive" });
      return;
    }
    setCommands((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: name.toLowerCase(),
        description: newDesc.trim(),
        category: newCategory,
        enabled: true,
      },
    ]);
    setNewName("");
    setNewDesc("");
    setNewCategory("Custom");
    setCreateOpen(false);
    toast({ title: "Comando criado!" });
  };

  const removeCommand = (id: string) => {
    setCommands((prev) => prev.filter((c) => c.id !== id));
  };

  const toggleCommand = (id: string) => {
    setCommands((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleSync = async () => {
    const enabledCommands = commands.filter((c) => c.enabled);
    if (enabledCommands.length === 0) {
      toast({ title: "Nenhum comando ativo para sincronizar", variant: "destructive" });
      return;
    }

    setSyncing(true);
    try {
      const guildId = tenant?.discord_guild_id || null;

      const { data, error } = await supabase.functions.invoke("register-commands", {
        body: {
          guild_id: guildId,
          commands: enabledCommands.map((c) => ({
            name: c.name,
            description: c.description,
          })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Comandos sincronizados! ✅",
        description: `${data?.registered ?? enabledCommands.length} comandos registrados no Discord.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao sincronizar",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Ative ou desative os comandos disponíveis do bot.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{commands.filter((c) => c.enabled).length} ativos</span>
            <span>/</span>
            <span>{commands.length} total</span>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Criar
          </Button>
          <Button
            onClick={handleSync}
            disabled={syncing}
            size="sm"
            className="gap-2"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Sincronizar
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar comandos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-muted border-none"
        />
      </div>

      <div className="space-y-6">
        {categories
          .filter((cat) => filtered.some((c) => c.category === cat))
          .map((cat) => (
            <div key={cat} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {cat}
              </h3>
              <div className="space-y-1">
                {filtered
                  .filter((c) => c.category === cat)
                  .map((cmd) => (
                    <div
                      key={cmd.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-all",
                        !cmd.enabled && "opacity-50"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Terminal className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-semibold text-foreground">
                              {cmd.name}
                            </code>
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1.5 py-0", categoryColors[cmd.category])}
                            >
                              {cmd.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {cmd.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={cmd.enabled}
                          onCheckedChange={() => toggleCommand(cmd.id)}
                        />
                        {!defaultCommands.some((d) => d.id === cmd.id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeCommand(cmd.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Comando</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do comando</Label>
              <Input
                placeholder="/meucomando"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                placeholder="O que este comando faz..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={addCommand}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
