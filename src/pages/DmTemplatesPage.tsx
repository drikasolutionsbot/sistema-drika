import { useEffect, useMemo, useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Plus, Trash2, RotateCcw, Save, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Template definitions (chaves alinhadas com send-dm-template) ─────
type TemplateKey =
  | "payment_approved"
  | "order_delivered"
  | "order_rejected"
  | "order_canceled"
  | "order_expired"
  | "ticket_opened"
  | "ticket_closed";

interface TemplateMeta {
  key: TemplateKey;
  label: string;
  emoji: string;
  description: string;
  defaultColor: string;
  defaultTitle: string;
  defaultDescription: string;
  placeholders: string[];
}

const TEMPLATES: TemplateMeta[] = [
  {
    key: "payment_approved",
    label: "Pagamento Confirmado",
    emoji: "🟢",
    description: "Enviado quando o pagamento do cliente é aprovado.",
    defaultColor: "#57F287",
    defaultTitle: "🟢 Pagamento confirmado",
    defaultDescription:
      "Olá **{customer}**! Seu pagamento do pedido **#{order_number}** foi aprovado.\n\n**Produto:** {product}\n**Total:** {total}\n\nEm instantes você receberá a entrega.",
    placeholders: ["{customer}", "{order_number}", "{product}", "{total}", "{store_name}", "{date}"],
  },
  {
    key: "order_delivered",
    label: "Pedido Entregue",
    emoji: "📦",
    description: "Enviado quando o produto é entregue ao cliente.",
    defaultColor: "#57F287",
    defaultTitle: "📦 Pedido entregue",
    defaultDescription:
      "Olá **{customer}**! Seu pedido **#{order_number}** foi entregue com sucesso.\n\n**Produto:** {product}\n**Quantidade:** {quantity}\n**Total:** {total}",
    placeholders: ["{customer}", "{order_number}", "{product}", "{quantity}", "{total}", "{delivery_content}"],
  },
  {
    key: "order_rejected",
    label: "Pedido Rejeitado",
    emoji: "❌",
    description: "Enviado quando a equipe rejeita um pedido.",
    defaultColor: "#ED4245",
    defaultTitle: "❌ Pedido rejeitado",
    defaultDescription:
      "Olá **{customer}**, infelizmente seu pedido **#{order_number}** foi rejeitado pela equipe.\n\nSe acreditar que houve um engano, abra um ticket de suporte.",
    placeholders: ["{customer}", "{order_number}", "{product}"],
  },
  {
    key: "order_canceled",
    label: "Pedido Cancelado",
    emoji: "🚫",
    description: "Enviado quando o cliente cancela o pedido.",
    defaultColor: "#ED4245",
    defaultTitle: "🚫 Pedido cancelado",
    defaultDescription:
      "Olá **{customer}**, seu pedido **#{order_number}** foi cancelado.\n\nSe tiver dúvidas, abra um ticket de suporte.",
    placeholders: ["{customer}", "{order_number}", "{product}"],
  },
  {
    key: "order_expired",
    label: "Pedido Expirado",
    emoji: "⏰",
    description: "Enviado quando o pagamento não é confirmado a tempo.",
    defaultColor: "#FEE75C",
    defaultTitle: "⏰ Pedido expirado",
    defaultDescription:
      "Olá **{customer}**, o pagamento do pedido **#{order_number}** não foi confirmado a tempo e o pedido expirou.\n\nVocê pode realizar uma nova compra a qualquer momento.",
    placeholders: ["{customer}", "{order_number}", "{product}"],
  },
  {
    key: "ticket_opened",
    label: "Ticket Aberto",
    emoji: "🎫",
    description: "Enviado quando um ticket é aberto pelo cliente.",
    defaultColor: "#5865F2",
    defaultTitle: "🎫 Ticket aberto",
    defaultDescription:
      "Olá **{customer}**! Seu ticket foi aberto com sucesso.\n\nA equipe da **{store_name}** responderá em breve.",
    placeholders: ["{customer}", "{store_name}"],
  },
  {
    key: "ticket_closed",
    label: "Ticket Encerrado",
    emoji: "🔒",
    description: "Enviado quando um ticket é fechado.",
    defaultColor: "#99AAB5",
    defaultTitle: "🔒 Ticket encerrado",
    defaultDescription:
      "Olá **{customer}**, seu ticket foi encerrado.\n\nObrigado pelo contato! Se precisar de algo mais, abra um novo ticket.",
    placeholders: ["{customer}", "{store_name}"],
  },
];

// ─── Estrutura embed_data ──────────────────────────────────────────────
interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}
interface EmbedButton {
  label: string;
  url: string;
  emoji?: string;
}
interface EmbedData {
  title?: string;
  description?: string;
  color?: string;
  thumbnail?: string;
  image?: string;
  footer?: string;
  fields?: EmbedField[];
  buttons?: EmbedButton[];
}

interface DmTemplateRow {
  id?: string;
  template_key: string;
  enabled: boolean;
  embed_data: EmbedData;
}

const emptyEmbed = (meta: TemplateMeta): EmbedData => ({
  title: meta.defaultTitle,
  description: meta.defaultDescription,
  color: meta.defaultColor,
  footer: "{store_name}",
  fields: [],
  buttons: [],
});

// ─── Substituição de placeholders para o preview ─────
const PREVIEW_VARS: Record<string, string> = {
  customer: "João Cliente",
  order_number: "1234",
  product: "Produto Demo",
  quantity: "1x",
  total: "R$ 49,90",
  store_name: "Sua Loja",
  date: new Date().toLocaleString("pt-BR"),
  delivery_content: "ABC-123-XYZ",
};

function applyVars(text: string): string {
  if (!text) return "";
  return text.replace(/\{(\w+)\}/g, (_m, k) => PREVIEW_VARS[k] ?? `{${k}}`);
}

// Render markdown leve (negrito + quebras + code blocks)
function renderDiscordMarkdown(text: string): JSX.Element[] {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // code block ```...```
    const codeMatch = line.match(/^```(.*)```$/);
    if (codeMatch) {
      return (
        <pre key={i} className="bg-[#2b2d31] text-white/90 rounded px-2 py-1 my-1 text-[12px] font-mono">
          {codeMatch[1]}
        </pre>
      );
    }
    // bold **...**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-[14px] text-white/80 leading-snug">
        {parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={j} className="text-white font-semibold">
              {p.slice(2, -2)}
            </strong>
          ) : (
            <span key={j}>{p}</span>
          )
        )}
      </p>
    );
  });
}

const DmTemplatesPage = () => {
  const { tenantId, tenant } = useTenant();
  const { toast } = useToast();
  const [activeKey, setActiveKey] = useState<TemplateKey>("payment_approved");
  const [rows, setRows] = useState<Record<string, DmTemplateRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testUserId, setTestUserId] = useState("");

  const activeMeta = useMemo(
    () => TEMPLATES.find((t) => t.key === activeKey)!,
    [activeKey]
  );
  const current: DmTemplateRow = rows[activeKey] || {
    template_key: activeKey,
    enabled: true,
    embed_data: emptyEmbed(activeMeta),
  };

  // ─── Load all templates for this tenant ─────
  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("dm_templates")
        .select("*")
        .eq("tenant_id", tenantId);
      if (!alive) return;
      if (error) {
        console.error("Failed to load DM templates", error);
        toast({ title: "Erro ao carregar templates", description: error.message, variant: "destructive" });
      }
      const map: Record<string, DmTemplateRow> = {};
      for (const tpl of TEMPLATES) {
        const found = data?.find((r) => r.template_key === tpl.key);
        if (found) {
          map[tpl.key] = {
            id: found.id,
            template_key: tpl.key,
            enabled: found.enabled,
            embed_data: (found.embed_data || emptyEmbed(tpl)) as EmbedData,
          };
        } else {
          map[tpl.key] = {
            template_key: tpl.key,
            enabled: true,
            embed_data: emptyEmbed(tpl),
          };
        }
      }
      setRows(map);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [tenantId, toast]);

  const updateEmbed = (patch: Partial<EmbedData>) => {
    setRows((prev) => ({
      ...prev,
      [activeKey]: {
        ...prev[activeKey],
        template_key: activeKey,
        enabled: prev[activeKey]?.enabled ?? true,
        embed_data: { ...prev[activeKey]?.embed_data, ...patch },
      },
    }));
  };

  const setEnabled = (val: boolean) => {
    setRows((prev) => ({
      ...prev,
      [activeKey]: { ...prev[activeKey], template_key: activeKey, enabled: val, embed_data: prev[activeKey]?.embed_data || emptyEmbed(activeMeta) },
    }));
  };

  // ─── Fields ─────
  const addField = () => {
    const fields = [...(current.embed_data.fields || [])];
    fields.push({ name: "Novo campo", value: "Valor", inline: false });
    updateEmbed({ fields });
  };
  const updateField = (i: number, patch: Partial<EmbedField>) => {
    const fields = [...(current.embed_data.fields || [])];
    fields[i] = { ...fields[i], ...patch };
    updateEmbed({ fields });
  };
  const removeField = (i: number) => {
    const fields = [...(current.embed_data.fields || [])];
    fields.splice(i, 1);
    updateEmbed({ fields });
  };

  // ─── Buttons ─────
  const addButton = () => {
    const buttons = [...(current.embed_data.buttons || [])];
    if (buttons.length >= 5) {
      toast({ title: "Máximo de 5 botões", variant: "destructive" });
      return;
    }
    buttons.push({ label: "Acessar", url: "https://discord.com" });
    updateEmbed({ buttons });
  };
  const updateButton = (i: number, patch: Partial<EmbedButton>) => {
    const buttons = [...(current.embed_data.buttons || [])];
    buttons[i] = { ...buttons[i], ...patch };
    updateEmbed({ buttons });
  };
  const removeButton = (i: number) => {
    const buttons = [...(current.embed_data.buttons || [])];
    buttons.splice(i, 1);
    updateEmbed({ buttons });
  };

  // ─── Save / Reset / Test ─────
  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        template_key: activeKey,
        enabled: current.enabled,
        embed_data: current.embed_data,
      };
      const { error } = await supabase
        .from("dm_templates")
        .upsert(payload, { onConflict: "tenant_id,template_key" });
      if (error) throw error;
      toast({ title: "Template salvo!", description: activeMeta.label });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    updateEmbed(emptyEmbed(activeMeta));
    toast({ title: "Restaurado para o padrão" });
  };

  const handleTest = async () => {
    if (!tenantId) return;
    if (!testUserId.trim()) {
      toast({ title: "Informe o ID do Discord para enviar o teste", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-dm-template", {
        body: {
          tenant_id: tenantId,
          template_key: activeKey,
          recipient_id: testUserId.trim(),
          vars: PREVIEW_VARS,
        },
      });
      if (error || (data as any)?.success === false) {
        throw new Error(error?.message || (data as any)?.error || "Falha ao enviar");
      }
      toast({ title: "DM de teste enviada!", description: `Para ${testUserId}` });
    } catch (e: any) {
      toast({ title: "Erro ao enviar teste", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Personalizar DMs</h1>
          <p className="text-sm text-muted-foreground">
            Customize as mensagens privadas que o bot envia ao cliente em cada evento de venda e ticket.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar de templates */}
        <Card className="col-span-12 lg:col-span-3 p-3 space-y-1 bg-card border-border h-fit">
          {TEMPLATES.map((tpl) => {
            const row = rows[tpl.key];
            const isActive = activeKey === tpl.key;
            return (
              <button
                key={tpl.key}
                onClick={() => setActiveKey(tpl.key)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors",
                  isActive ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
                )}
              >
                <span className="text-lg">{tpl.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold truncate", isActive ? "text-primary" : "text-foreground")}>
                    {tpl.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {row?.enabled === false ? "Desativado" : "Ativo"}
                  </p>
                </div>
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    row?.enabled === false ? "bg-muted-foreground/40" : "bg-emerald-500"
                  )}
                />
              </button>
            );
          })}
        </Card>

        {/* Editor */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <Card className="p-5 space-y-5 bg-card border-border">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span>{activeMeta.emoji}</span> {activeMeta.label}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">{activeMeta.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Label htmlFor="enabled" className="text-xs">Ativo</Label>
                <Switch id="enabled" checked={current.enabled} onCheckedChange={setEnabled} />
              </div>
            </div>

            {/* Placeholders */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Placeholders disponíveis
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeMeta.placeholders.map((p) => (
                  <code
                    key={p}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 cursor-pointer hover:bg-primary/20"
                    onClick={() => navigator.clipboard.writeText(p)}
                    title="Clique para copiar"
                  >
                    {p}
                  </code>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-sm font-bold">Título</Label>
              <Input
                value={current.embed_data.title || ""}
                onChange={(e) => updateEmbed({ title: e.target.value })}
                className="bg-muted border-border"
                maxLength={256}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm font-bold">Descrição</Label>
              <Textarea
                value={current.embed_data.description || ""}
                onChange={(e) => updateEmbed({ description: e.target.value })}
                className="bg-muted border-border min-h-[140px] resize-y font-mono text-sm"
                maxLength={4096}
              />
            </div>

            {/* Color + Footer */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold">Cor</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={current.embed_data.color || "#2B2D31"}
                    onChange={(e) => updateEmbed({ color: e.target.value })}
                    className="h-10 w-14 rounded border border-border bg-muted cursor-pointer"
                  />
                  <Input
                    value={current.embed_data.color || ""}
                    onChange={(e) => updateEmbed({ color: e.target.value })}
                    className="bg-muted border-border font-mono"
                    placeholder="#5865F2"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold">Rodapé</Label>
                <Input
                  value={current.embed_data.footer || ""}
                  onChange={(e) => updateEmbed({ footer: e.target.value })}
                  className="bg-muted border-border"
                  placeholder="{store_name}"
                />
              </div>
            </div>

            {/* Thumbnail + Image */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold">Thumbnail (URL)</Label>
                <Input
                  value={current.embed_data.thumbnail || ""}
                  onChange={(e) => updateEmbed({ thumbnail: e.target.value })}
                  className="bg-muted border-border"
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold">Imagem (URL)</Label>
                <Input
                  value={current.embed_data.image || ""}
                  onChange={(e) => updateEmbed({ image: e.target.value })}
                  className="bg-muted border-border"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">Campos ({(current.embed_data.fields || []).length}/25)</Label>
                <Button size="sm" variant="outline" onClick={addField} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Adicionar campo
                </Button>
              </div>
              <div className="space-y-2">
                {(current.embed_data.fields || []).map((f, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={f.name}
                        onChange={(e) => updateField(i, { name: e.target.value })}
                        placeholder="Nome"
                        className="bg-muted border-border text-xs"
                        maxLength={256}
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeField(i)} className="h-8 w-8 shrink-0">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                    <Textarea
                      value={f.value}
                      onChange={(e) => updateField(i, { value: e.target.value })}
                      placeholder="Valor"
                      className="bg-muted border-border text-xs min-h-[60px]"
                      maxLength={1024}
                    />
                    <div className="flex items-center gap-2">
                      <Switch checked={!!f.inline} onCheckedChange={(v) => updateField(i, { inline: v })} />
                      <span className="text-xs text-muted-foreground">Inline</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">Botões ({(current.embed_data.buttons || []).length}/5)</Label>
                <Button size="sm" variant="outline" onClick={addButton} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Adicionar botão
                </Button>
              </div>
              <div className="space-y-2">
                {(current.embed_data.buttons || []).map((b, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={b.emoji || ""}
                        onChange={(e) => updateButton(i, { emoji: e.target.value })}
                        placeholder="😀"
                        className="bg-muted border-border text-xs w-16"
                      />
                      <Input
                        value={b.label}
                        onChange={(e) => updateButton(i, { label: e.target.value })}
                        placeholder="Texto do botão"
                        className="bg-muted border-border text-xs"
                        maxLength={80}
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeButton(i)} className="h-8 w-8 shrink-0">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      value={b.url}
                      onChange={(e) => updateButton(i, { url: e.target.value })}
                      placeholder="https://..."
                      className="bg-muted border-border text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button variant="ghost" onClick={handleReset} className="text-xs">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restaurar padrão
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Salvar
              </Button>
            </div>
          </Card>

          {/* Test panel */}
          <Card className="p-4 bg-card border-border space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Enviar DM de teste</h3>
            </div>
            <div className="flex gap-2">
              <Input
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                placeholder="Discord ID do destinatário"
                className="bg-muted border-border text-sm"
              />
              <Button onClick={handleTest} disabled={testing} variant="outline">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Salve antes para testar a versão atual. Você precisa estar no mesmo servidor que o bot e ter DMs abertas.
            </p>
          </Card>
        </div>

        {/* Preview */}
        <div className="col-span-12 lg:col-span-4">
          <div className="sticky top-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Pré-visualização (Discord)
            </p>
            <div className="rounded-2xl bg-[#313338] p-4 shadow-xl border border-black/30">
              {/* Bot header */}
              <div className="flex items-start gap-3 mb-2">
                {tenant?.bot_avatar_url || tenant?.logo_url ? (
                  <img
                    src={tenant?.bot_avatar_url || tenant?.logo_url || ""}
                    alt="bot"
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/30 flex items-center justify-center text-white text-sm font-bold">
                    {(tenant?.bot_name || tenant?.name || "B")[0]}
                  </div>
                )}
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-semibold text-sm">
                    {tenant?.bot_name || tenant?.name || "Bot"}
                  </span>
                  <span className="text-[10px] px-1 py-px rounded bg-[#5865f2] text-white font-bold">APP</span>
                  <span className="text-[11px] text-white/40">agora</span>
                </div>
              </div>

              {/* Embed */}
              <div className="ml-[52px]">
                <div
                  className="rounded-md bg-[#2b2d31] overflow-hidden border-l-4"
                  style={{ borderLeftColor: current.embed_data.color || "#2B2D31" }}
                >
                  <div className="p-3 space-y-2">
                    {current.embed_data.title && (
                      <p className="text-white font-semibold text-[15px] leading-tight">
                        {applyVars(current.embed_data.title)}
                      </p>
                    )}
                    {current.embed_data.description && (
                      <div>{renderDiscordMarkdown(applyVars(current.embed_data.description))}</div>
                    )}
                    {(current.embed_data.fields || []).length > 0 && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {current.embed_data.fields!.map((f, i) => (
                          <div
                            key={i}
                            className={cn("space-y-0.5", f.inline ? "col-span-1" : "col-span-2")}
                          >
                            <p className="text-white text-xs font-bold">{applyVars(f.name)}</p>
                            <p className="text-white/70 text-xs whitespace-pre-wrap">{applyVars(f.value)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {current.embed_data.image && (
                      <img
                        src={current.embed_data.image}
                        alt=""
                        className="rounded mt-2 max-h-60 w-full object-cover"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                      />
                    )}
                    {current.embed_data.footer && (
                      <div className="flex items-center gap-1.5 pt-1.5">
                        {(tenant?.bot_avatar_url || tenant?.logo_url) && (
                          <img
                            src={tenant?.bot_avatar_url || tenant?.logo_url || ""}
                            alt=""
                            className="h-4 w-4 rounded-full"
                          />
                        )}
                        <p className="text-[11px] text-white/50">{applyVars(current.embed_data.footer)}</p>
                      </div>
                    )}
                  </div>
                  {current.embed_data.thumbnail && (
                    <img
                      src={current.embed_data.thumbnail}
                      alt=""
                      className="absolute right-3 top-3 h-16 w-16 rounded object-cover"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                    />
                  )}
                </div>

                {/* Buttons */}
                {(current.embed_data.buttons || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {current.embed_data.buttons!.map((b, i) => (
                      <div
                        key={i}
                        className="px-3 py-1.5 rounded bg-[#4e5058] text-white text-[13px] font-medium flex items-center gap-1.5"
                      >
                        {b.emoji && <span>{b.emoji}</span>}
                        <span>{applyVars(b.label) || "Botão"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground italic px-1">
              Os valores entre chaves são substituídos por dados reais ao enviar (cliente, pedido, total, etc).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DmTemplatesPage;
