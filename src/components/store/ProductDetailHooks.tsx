import { useState, useEffect } from "react";
import {
  Plus,
  Shield,
  ShieldOff,
  MessageSquare,
  Hash,
  Globe,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Zap,
  Loader2,
} from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { useDiscordRoles } from "@/hooks/useDiscordRoles";

interface Hook {
  id: string;
  product_id: string;
  tenant_id: string;
  hook_type: string;
  config: Record<string, unknown>;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const hookTypeConfig = {
  add_role: {
    label: "Adicionar Cargo",
    description: "Adiciona um cargo do Discord ao comprador após a compra",
    icon: Shield,
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
  },
  remove_role: {
    label: "Remover Cargo",
    description: "Remove um cargo do Discord do comprador após a compra",
    icon: ShieldOff,
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
  },
  send_dm: {
    label: "Enviar DM",
    description: "Envia uma mensagem direta para o comprador no Discord",
    icon: MessageSquare,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
  send_channel_message: {
    label: "Enviar Mensagem no Canal",
    description: "Envia uma mensagem em um canal específico do Discord",
    icon: Hash,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
  },
  call_webhook: {
    label: "Chamar Webhook",
    description: "Faz uma requisição HTTP para uma URL externa",
    icon: Globe,
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
  },
};

interface ProductDetailHooksProps {
  productId: string;
}

export const ProductDetailHooks = ({ productId }: ProductDetailHooksProps) => {
  const { tenantId } = useTenant();
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchHooks = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-product-hooks", {
      body: { action: "list", tenant_id: tenantId, product_id: productId },
    });
    if (!error && !data?.error) {
      setHooks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHooks();
  }, [productId, tenantId]);

  const handleCreate = async (hookType: string) => {
    if (!tenantId) return;
    const { data, error } = await supabase.functions.invoke("manage-product-hooks", {
      body: {
        action: "create",
        tenant_id: tenantId,
        product_id: productId,
        hook: { hook_type: hookType, config: getDefaultConfig(hookType) },
      },
    });
    if (error || data?.error) {
      toast({ title: "Erro ao criar hook", description: error?.message || data?.error, variant: "destructive" });
    } else {
      setHooks((prev) => [...prev, data]);
      setExpandedId(data.id);
      toast({ title: "Hook adicionado!" });
    }
  };

  const handleUpdate = async (hook: Hook) => {
    if (!tenantId) return;
    setSaving(hook.id);
    const { data, error } = await supabase.functions.invoke("manage-product-hooks", {
      body: {
        action: "update",
        tenant_id: tenantId,
        hook_id: hook.id,
        hook: { config: hook.config, active: hook.active, hook_type: hook.hook_type },
      },
    });
    if (error || data?.error) {
      toast({ title: "Erro ao salvar", description: error?.message || data?.error, variant: "destructive" });
    } else {
      setHooks((prev) => prev.map((h) => (h.id === hook.id ? data : h)));
      toast({ title: "Hook salvo!" });
    }
    setSaving(null);
  };

  const handleDelete = async (hookId: string) => {
    if (!tenantId) return;
    const { data, error } = await supabase.functions.invoke("manage-product-hooks", {
      body: { action: "delete", tenant_id: tenantId, hook_id: hookId },
    });
    if (error || data?.error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      setHooks((prev) => prev.filter((h) => h.id !== hookId));
      toast({ title: "Hook removido!" });
    }
  };

  const handleToggle = async (hook: Hook) => {
    const updated = { ...hook, active: !hook.active };
    setHooks((prev) => prev.map((h) => (h.id === hook.id ? updated : h)));
    await handleUpdate(updated);
  };

  const updateConfig = (hookId: string, key: string, value: unknown) => {
    setHooks((prev) =>
      prev.map((h) =>
        h.id === hookId ? { ...h, config: { ...h.config, [key]: value } } : h
      )
    );
  };

  const getDefaultConfig = (type: string): Record<string, unknown> => {
    switch (type) {
      case "add_role":
      case "remove_role":
        return { role_id: "" };
      case "send_dm":
        return { message: "Obrigado pela compra! 🎉\n\nSeu pedido #{order_number} foi confirmado." };
      case "send_channel_message":
        return { channel_id: "", message: "🛒 Nova venda! **{product_name}** comprado por <@{user_id}>." };
      case "call_webhook":
        return { url: "", method: "POST", headers: "{}", body: '{"event":"purchase","product":"{product_name}","user":"{user_id}"}' };
      default:
        return {};
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Hooks Pós-Venda</h3>
          <p className="text-xs text-muted-foreground">
            Automações executadas após a confirmação do pagamento
          </p>
        </div>
      </div>

      {/* Add hook buttons */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(hookTypeConfig).map(([type, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button
              key={type}
              onClick={() => handleCreate(type)}
              className="group flex items-center gap-2 rounded-lg border border-border hover:border-primary/40 bg-muted/30 hover:bg-primary/5 px-3 py-2 transition-all duration-200"
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${cfg.bgColor}`}>
                <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
              </div>
              <span className="text-xs font-medium whitespace-nowrap">{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Hooks list */}
      {hooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Zap className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">Nenhum hook configurado</p>
          <p className="text-xs mt-1">Clique em um tipo acima para adicionar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {hooks.map((hook) => {
            const cfg = hookTypeConfig[hook.hook_type as keyof typeof hookTypeConfig];
            if (!cfg) return null;
            const Icon = cfg.icon;
            const isExpanded = expandedId === hook.id;

            return (
              <div
                key={hook.id}
                className={`rounded-xl border transition-all duration-200 ${
                  isExpanded ? "border-primary/30 bg-card" : "border-border bg-muted/20 hover:bg-muted/40"
                }`}
              >
                {/* Hook header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.bgColor}`}>
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{cfg.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{cfg.description}</p>
                  </div>
                  <Switch
                    checked={hook.active}
                    onCheckedChange={() => handleToggle(hook)}
                    className="mr-1"
                  />
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : hook.id)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Expanded config */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-border space-y-4">
                    <HookConfigForm
                      hook={hook}
                      onConfigChange={(key, value) => updateConfig(hook.id, key, value)}
                    />
                    <div className="flex items-center justify-between pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                        onClick={() => handleDelete(hook.id)}
                      >
                        <TrashIcon className="h-3.5 w-3.5 mr-1.5" />
                        Excluir
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(hook)}
                        disabled={saving === hook.id}
                        className="gradient-pink text-primary-foreground border-none hover:opacity-90 text-xs"
                      >
                        {saving === hook.id ? "Salvando..." : "Salvar Hook"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Variables reference */}
      {hooks.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-xs font-semibold mb-2">Variáveis disponíveis</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {[
              { var: "{user_id}", desc: "ID do Discord" },
              { var: "{username}", desc: "Nome do usuário" },
              { var: "{product_name}", desc: "Nome do produto" },
              { var: "{order_number}", desc: "Número do pedido" },
              { var: "{price}", desc: "Valor pago" },
              { var: "{field_name}", desc: "Nome da variação" },
            ].map((v) => (
              <div key={v.var} className="flex items-center gap-1.5">
                <code className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                  {v.var}
                </code>
                <span className="text-[10px] text-muted-foreground">{v.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- Config form per hook type ---------- */

const HookConfigForm = ({
  hook,
  onConfigChange,
}: {
  hook: Hook;
  onConfigChange: (key: string, value: unknown) => void;
}) => {
  const config = hook.config as Record<string, string>;
  const { tenantId } = useTenant();
  const { roles, loading: rolesLoading } = useDiscordRoles(
    hook.hook_type === "add_role" || hook.hook_type === "remove_role"
  );
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);

  useEffect(() => {
    if (hook.hook_type !== "send_channel_message" || !tenantId) return;
    setChannelsLoading(true);
    supabase.functions
      .invoke("discord-channels", { body: { tenant_id: tenantId } })
      .then(({ data }) => {
        if (Array.isArray(data?.channels)) {
          setChannels(
            data.channels
              .filter((c: any) => c.type === 0)
              .map((c: any) => ({ id: c.id, name: c.name }))
          );
        }
      })
      .finally(() => setChannelsLoading(false));
  }, [hook.hook_type, tenantId]);

  switch (hook.hook_type) {
    case "add_role":
    case "remove_role":
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Cargo do Discord</Label>
            {rolesLoading ? (
              <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando cargos...
              </div>
            ) : (
              <Select
                value={config.role_id || ""}
                onValueChange={(val) => onConfigChange("role_id", val)}
              >
                <SelectTrigger className="mt-1.5 h-9 bg-muted/50 border-border text-sm">
                  <SelectValue placeholder="Selecione um cargo" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              typeof role.color === "string" && role.color !== "#000000"
                                ? role.color
                                : "#99AAB5",
                          }}
                        />
                        {role.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Selecione o cargo que será {hook.hook_type === "add_role" ? "adicionado ao" : "removido do"} comprador
            </p>
          </div>
        </div>
      );

    case "send_dm":
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Mensagem da DM</Label>
            <Textarea
              value={config.message || ""}
              onChange={(e) => onConfigChange("message", e.target.value)}
              placeholder="Mensagem enviada ao comprador..."
              className="mt-1.5 bg-muted/50 border-border text-sm min-h-[100px] resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Suporta variáveis como {"{product_name}"} e {"{order_number}"}
            </p>
          </div>
        </div>
      );

    case "send_channel_message":
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Canal do Discord</Label>
            {channelsLoading ? (
              <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando canais...
              </div>
            ) : (
              <Select
                value={config.channel_id || ""}
                onValueChange={(val) => onConfigChange("channel_id", val)}
              >
                <SelectTrigger className="mt-1.5 h-9 bg-muted/50 border-border text-sm">
                  <SelectValue placeholder="Selecione um canal" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      <div className="flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                        {ch.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="text-xs">Mensagem</Label>
            <Textarea
              value={config.message || ""}
              onChange={(e) => onConfigChange("message", e.target.value)}
              placeholder="Mensagem enviada no canal..."
              className="mt-1.5 bg-muted/50 border-border text-sm min-h-[100px] resize-none"
            />
          </div>
        </div>
      );

    case "call_webhook":
      return (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">URL do Webhook</Label>
            <Input
              value={config.url || ""}
              onChange={(e) => onConfigChange("url", e.target.value)}
              placeholder="https://exemplo.com/webhook"
              className="mt-1.5 h-9 bg-muted/50 border-border text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Método HTTP</Label>
            <Select
              value={config.method || "POST"}
              onValueChange={(val) => onConfigChange("method", val)}
            >
              <SelectTrigger className="mt-1.5 h-9 bg-muted/50 border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Body (JSON)</Label>
            <Textarea
              value={config.body || ""}
              onChange={(e) => onConfigChange("body", e.target.value)}
              placeholder='{"event": "purchase"}'
              className="mt-1.5 bg-muted/50 border-border text-sm font-mono text-xs min-h-[80px] resize-none"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
};
