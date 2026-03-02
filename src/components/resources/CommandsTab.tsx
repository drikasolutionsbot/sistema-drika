import { useState } from "react";
import { Search, Terminal, ToggleLeft, ToggleRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

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

export const CommandsTab = () => {
  const [commands, setCommands] = useState<BotCommand[]>(defaultCommands);
  const [search, setSearch] = useState("");

  const filtered = commands.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(commands.map((c) => c.category))];

  const toggleCommand = (id: string) => {
    setCommands((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Ative ou desative os comandos disponíveis do bot.
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{commands.filter((c) => c.enabled).length} ativos</span>
          <span>/</span>
          <span>{commands.length} total</span>
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
                      <Switch
                        checked={cmd.enabled}
                        onCheckedChange={() => toggleCommand(cmd.id)}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
