import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Terminal, Upload, Loader2, Plus, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Discord option types: https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-type
const OPTION_TYPES = [
  { value: 3, label: "String (texto)" },
  { value: 4, label: "Integer (número inteiro)" },
  { value: 5, label: "Boolean (verdadeiro/falso)" },
  { value: 6, label: "User (usuário)" },
  { value: 7, label: "Channel (canal)" },
  { value: 8, label: "Role (cargo)" },
  { value: 10, label: "Number (número decimal)" },
  { value: 11, label: "Attachment (anexo)" },
] as const;

interface CommandOption {
  name: string;
  description: string;
  type: number;
  required: boolean;
  choices?: { name: string; value: string }[];
}

interface BotCommand {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  options?: CommandOption[];
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
  Custom: "bg-primary/15 text-primary border-primary/20",
};

const AVAILABLE_CATEGORIES = ["Admin", "Loja", "Suporte", "Convites", "Sorteios", "VIP", "Moderação", "Custom"];

const emptyOption = (): CommandOption => ({
  name: "",
  description: "",
  type: 3,
  required: false,
  choices: [],
});

export const CommandsTab = () => {
  const [commands, setCommands] = useState<BotCommand[]>(() => {
    const saved = localStorage.getItem("bot_commands");
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return defaultCommands;
  });
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const { tenant } = useTenant();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("Custom");
  const [newOptions, setNewOptions] = useState<CommandOption[]>([]);
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null);
  const hasAutoSynced = useRef(false);

  // Persist commands to localStorage
  useEffect(() => {
    localStorage.setItem("bot_commands", JSON.stringify(commands));
  }, [commands]);

  const syncToDiscord = useCallback(async (cmds: BotCommand[], silent = false) => {
    const enabledCommands = cmds.filter((c) => c.enabled);
    if (enabledCommands.length === 0) return;

    const guildId = tenant?.discord_guild_id || null;
    if (!guildId) {
      if (!silent) toast({ title: "Guild ID não configurado", description: "Configure o servidor Discord primeiro.", variant: "destructive" });
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-commands", {
        body: {
          guild_id: guildId,
          commands: enabledCommands.map((c) => ({
            name: c.name,
            description: c.description,
            options: c.options,
          })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (!silent) {
        toast({
          title: "Comandos sincronizados! ✅",
          description: `${data?.registered ?? enabledCommands.length} comandos registrados no Discord.`,
        });
      }
    } catch (err: any) {
      if (!silent) {
        toast({
          title: "Erro ao sincronizar",
          description: err.message || "Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setSyncing(false);
    }
  }, [tenant]);

  // Auto-sync on first mount when guild is available
  useEffect(() => {
    if (tenant?.discord_guild_id && !hasAutoSynced.current) {
      hasAutoSynced.current = true;
      syncToDiscord(commands, true);
    }
  }, [tenant?.discord_guild_id]);

  const filtered = commands.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(commands.map((c) => c.category))];

  const updateOption = (index: number, patch: Partial<CommandOption>) => {
    setNewOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  };

  const addChoice = (optIndex: number) => {
    setNewOptions((prev) =>
      prev.map((o, i) =>
        i === optIndex ? { ...o, choices: [...(o.choices || []), { name: "", value: "" }] } : o
      )
    );
  };

  const updateChoice = (optIndex: number, choiceIndex: number, patch: { name?: string; value?: string }) => {
    setNewOptions((prev) =>
      prev.map((o, i) =>
        i === optIndex
          ? {
              ...o,
              choices: (o.choices || []).map((c, ci) => (ci === choiceIndex ? { ...c, ...patch } : c)),
            }
          : o
      )
    );
  };

  const removeChoice = (optIndex: number, choiceIndex: number) => {
    setNewOptions((prev) =>
      prev.map((o, i) =>
        i === optIndex ? { ...o, choices: (o.choices || []).filter((_, ci) => ci !== choiceIndex) } : o
      )
    );
  };

  const resetForm = () => {
    setNewName("");
    setNewDesc("");
    setNewCategory("Custom");
    setNewOptions([]);
  };

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
    // Validate options
    const validOptions = newOptions.filter((o) => o.name.trim() && o.description.trim());
    for (const opt of validOptions) {
      if (!/^[\w-]{1,32}$/.test(opt.name.trim())) {
        toast({
          title: `Nome de parâmetro inválido: "${opt.name}"`,
          description: "Use apenas letras minúsculas, números, _ e - (máx 32 chars)",
          variant: "destructive",
        });
        return;
      }
      // Filter out empty choices
      opt.choices = (opt.choices || []).filter((c) => c.name.trim() && c.value.trim());
    }

    setCommands((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: name.toLowerCase(),
        description: newDesc.trim(),
        category: newCategory,
        enabled: true,
        options: validOptions.length > 0 ? validOptions : undefined,
      },
    ]);
    resetForm();
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
            options: c.options,
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

  const optionTypeSupportsChoices = (type: number) => type === 3 || type === 4 || type === 10;

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
                    <div key={cmd.id} className="space-y-0">
                      <div
                        className={cn(
                          "flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-all",
                          !cmd.enabled && "opacity-50",
                          expandedCmd === cmd.id && "rounded-b-none"
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
                              {cmd.options && cmd.options.length > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-border">
                                  {cmd.options.length} param{cmd.options.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {cmd.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {cmd.options && cmd.options.length > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={() => setExpandedCmd(expandedCmd === cmd.id ? null : cmd.id)}
                            >
                              {expandedCmd === cmd.id ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
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
                              <TrashIcon className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* Expanded options view */}
                      {expandedCmd === cmd.id && cmd.options && (
                        <div className="rounded-b-lg border border-t-0 border-border bg-muted/50 px-4 py-3 space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Parâmetros</p>
                          {cmd.options.map((opt, i) => (
                            <div key={i} className="flex items-start gap-3 rounded-md bg-card border border-border p-2.5">
                              <Settings2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <code className="text-xs font-semibold text-foreground">{opt.name}</code>
                                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                                    {OPTION_TYPES.find((t) => t.value === opt.type)?.label || `Tipo ${opt.type}`}
                                  </Badge>
                                  {opt.required && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-destructive/10 text-destructive border-destructive/20">
                                      obrigatório
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                                {opt.choices && opt.choices.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {opt.choices.map((c, ci) => (
                                      <Badge key={ci} variant="secondary" className="text-[9px] px-1.5 py-0">
                                        {c.name}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
      </div>

      {/* Create command dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Criar Comando</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-5 pb-2">
              {/* Basic fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do comando</Label>
                  <Input
                    placeholder="/meucomando"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">Apenas letras minúsculas, números, _ e -</p>
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

              <Separator />

              {/* Options (parameters) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Parâmetros (Options)</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Argumentos que o usuário preenche ao usar o comando
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setNewOptions((prev) => [...prev, emptyOption()])}
                    disabled={newOptions.length >= 25}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar
                  </Button>
                </div>

                {newOptions.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
                    <Settings2 className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Nenhum parâmetro adicionado</p>
                    <p className="text-[10px] text-muted-foreground">Ex: /ban [usuário] [motivo]</p>
                  </div>
                )}

                {newOptions.map((opt, index) => (
                  <div key={index} className="rounded-lg border border-border bg-card p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Parâmetro #{index + 1}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => setNewOptions((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <TrashIcon className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Nome</Label>
                        <Input
                          placeholder="usuario"
                          value={opt.name}
                          onChange={(e) => updateOption(index, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Tipo</Label>
                        <Select value={String(opt.type)} onValueChange={(v) => updateOption(index, { type: Number(v), choices: optionTypeSupportsChoices(Number(v)) ? opt.choices : [] })}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPTION_TYPES.map((t) => (
                              <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Descrição</Label>
                      <Input
                        placeholder="Descrição do parâmetro"
                        value={opt.description}
                        onChange={(e) => updateOption(index, { description: e.target.value })}
                        className="h-8 text-xs"
                        maxLength={100}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`req-${index}`}
                        checked={opt.required}
                        onCheckedChange={(checked) => updateOption(index, { required: !!checked })}
                      />
                      <Label htmlFor={`req-${index}`} className="text-xs cursor-pointer">Obrigatório</Label>
                    </div>

                    {/* Choices (only for string/integer/number) */}
                    {optionTypeSupportsChoices(opt.type) && (
                      <div className="space-y-2 pt-1 border-t border-border">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] text-muted-foreground">Escolhas pré-definidas (opcional)</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => addChoice(index)}
                            disabled={(opt.choices?.length || 0) >= 25}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Escolha
                          </Button>
                        </div>
                        {(opt.choices || []).map((choice, ci) => (
                          <div key={ci} className="flex items-center gap-1.5">
                            <Input
                              placeholder="Nome"
                              value={choice.name}
                              onChange={(e) => updateChoice(index, ci, { name: e.target.value })}
                              className="h-7 text-[11px] flex-1"
                            />
                            <Input
                              placeholder="Valor"
                              value={choice.value}
                              onChange={(e) => updateChoice(index, ci, { value: e.target.value })}
                              className="h-7 text-[11px] flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeChoice(index, ci)}
                            >
                              <TrashIcon className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={addCommand}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
