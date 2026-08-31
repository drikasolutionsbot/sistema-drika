import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Save, Tag, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface TicketCategory {
  id: string;
  emoji: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
}

const EMOJI_SUGGESTIONS = ["🎫", "🛒", "🏦", "🤝", "⚡", "💬", "🔧", "📦", "💳", "🌐", "🎮", "📞"];

const renderEmoji = (emoji: string) => {
  if (!emoji) return null;
  const match = emoji.match(/<a?:.+?:(\d+)>/);
  if (match) {
    const isAnimated = emoji.startsWith("<a:");
    return <img src={`https://cdn.discordapp.com/emojis/${match[1]}.${isAnimated ? 'gif' : 'png'}`} className="w-6 h-6 object-contain inline-block" alt="emoji" />;
  }
  return <span>{emoji}</span>;
};

const TicketCategories = () => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TicketCategory | null>(null);
  const [form, setForm] = useState({ emoji: "🎫", name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery<TicketCategory[]>({
    queryKey: ["ticket_categories", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_categories")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm({ emoji: "🎫", name: "", description: "" });
    setModalOpen(true);
  };

  const openEdit = (cat: TicketCategory) => {
    setEditing(cat);
    setForm({ emoji: cat.emoji, name: cat.name, description: cat.description || "" });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!form.emoji.trim()) { toast.error("Emoji obrigatório"); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("ticket_categories")
          .update({ emoji: form.emoji, name: form.name, description: form.description || null, updated_at: new Date().toISOString() })
          .eq("id", editing.id)
          .eq("tenant_id", tenantId!);
        if (error) throw error;
        toast.success("Categoria atualizada!");
      } else {
        const { error } = await supabase
          .from("ticket_categories")
          .insert({ tenant_id: tenantId!, emoji: form.emoji, name: form.name, description: form.description || null, sort_order: categories.length });
        if (error) throw error;
        toast.success("Categoria criada!");
      }
      queryClient.invalidateQueries({ queryKey: ["ticket_categories", tenantId] });
      setModalOpen(false);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (cat: TicketCategory) => {
    const { error } = await supabase
      .from("ticket_categories")
      .update({ active: !cat.active, updated_at: new Date().toISOString() })
      .eq("id", cat.id)
      .eq("tenant_id", tenantId!);
    if (error) { toast.error("Erro ao atualizar"); return; }
    queryClient.invalidateQueries({ queryKey: ["ticket_categories", tenantId] });
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from("ticket_categories")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      toast.success("Categoria removida");
      queryClient.invalidateQueries({ queryKey: ["ticket_categories", tenantId] });
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const activeCount = categories.filter(c => c.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Tipos de Atendimento
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            O usuário escolhe o tipo antes de abrir o ticket no Discord
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      {/* Discord Preview */}
      {activeCount > 0 && (
        <div className="rounded-xl border border-border bg-[#313338] p-4 space-y-3">
          <p className="text-xs text-[#B5BAC1] font-medium uppercase tracking-wide">Preview Discord</p>
          <p className="text-sm text-white font-medium">Selecione o tipo de atendimento</p>
          <div className="space-y-1.5">
            {categories.filter(c => c.active).map(cat => (
              <div key={cat.id} className="flex items-center gap-3 rounded-lg bg-[#2B2D31] px-3 py-2.5 hover:bg-[#404249] transition-colors cursor-pointer">
                <span className="text-lg leading-none flex items-center justify-center">{renderEmoji(cat.emoji)}</span>
                <div>
                  <p className="text-sm text-white font-medium">{cat.name}</p>
                  {cat.description && <p className="text-xs text-[#B5BAC1]">{cat.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center border border-dashed border-border rounded-xl">
          <Tag className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma categoria ainda</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Crie categorias para o usuário escolher ao abrir um ticket</p>
          <Button size="sm" variant="outline" className="mt-4 gap-2" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nova Categoria
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <div
              key={cat.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${cat.active ? "border-border bg-card" : "border-border/40 bg-card/50 opacity-60"}`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />
              <span className="text-xl leading-none shrink-0 flex items-center justify-center w-6 h-6">{renderEmoji(cat.emoji)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{cat.name}</p>
                {cat.description && <p className="text-xs text-muted-foreground truncate">{cat.description}</p>}
              </div>
              <Badge variant="outline" className={cat.active ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "text-muted-foreground"}>
                {cat.active ? "Ativa" : "Inativa"}
              </Badge>
              <button
                onClick={() => handleToggle(cat)}
                className="text-muted-foreground hover:text-primary transition-colors"
                title={cat.active ? "Desativar" : "Ativar"}
              >
                {cat.active ? <ToggleRight className="h-5 w-5 text-emerald-400" /> : <ToggleLeft className="h-5 w-5" />}
              </button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEdit(cat)}>
                <Save className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(cat.id)}
                disabled={deleting === cat.id}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              {editing ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Emoji */}
            <div className="space-y-2">
              <Label>Emoji</Label>
              <Input
                value={form.emoji}
                onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                placeholder="🎫 ou <:nome:123456...>"
                maxLength={64}
                className="text-lg"
              />
              <div className="flex flex-wrap gap-1.5 mt-1">
                {EMOJI_SUGGESTIONS.map(e => (
                  <button
                    key={e}
                    onClick={() => setForm(f => ({ ...f, emoji: e }))}
                    className={`text-lg px-1.5 py-0.5 rounded-lg transition-colors ${form.emoji === e ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-muted"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Nome <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Suporte, Compras, Financeiro..."
                maxLength={80}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Dúvidas, problemas ou ajuda geral."
                rows={2}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">{form.description.length}/100 caracteres — aparece como subtítulo no Discord</p>
            </div>

            {/* Live preview */}
            {(form.emoji || form.name) && (
              <div className="rounded-lg border border-border bg-[#2B2D31] px-3 py-2.5 flex items-center gap-3">
                <span className="text-lg leading-none flex items-center justify-center">{renderEmoji(form.emoji || "🎫")}</span>
                <div>
                  <p className="text-sm text-white font-medium">{form.name || "Nome da categoria"}</p>
                  {form.description && <p className="text-xs text-[#B5BAC1]">{form.description}</p>}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TicketCategories;
