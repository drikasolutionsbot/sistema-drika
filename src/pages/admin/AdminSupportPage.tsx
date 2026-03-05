import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical, Save, X, Headphones } from "lucide-react";
import { logAudit } from "@/lib/auditLog";

interface SupportChannel {
  id: string;
  name: string;
  role: string;
  status: string;
  status_color: string;
  action_text: string;
  secondary_action_text: string;
  about: string;
  bottom_text: string;
  bottom_color: string;
  url: string;
  initial: string;
  sort_order: number;
  active: boolean;
}

const emptyChannel: Omit<SupportChannel, "id"> = {
  name: "",
  role: "",
  status: "Online",
  status_color: "#6aff6a",
  action_text: "+ Contatar",
  secondary_action_text: "",
  about: "",
  bottom_text: "",
  bottom_color: "pink",
  url: "",
  initial: "S",
  sort_order: 0,
  active: true,
};

const AdminSupportPage = () => {
  const [channels, setChannels] = useState<SupportChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SupportChannel | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Omit<SupportChannel, "id">>(emptyChannel);
  const [saving, setSaving] = useState(false);

  const fetchChannels = async () => {
    const { data } = await supabase
      .from("support_channels")
      .select("*")
      .order("sort_order");
    if (data) setChannels(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchChannels(); }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast({ title: "Preencha nome e URL", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("support_channels")
          .update({ ...form, updated_at: new Date().toISOString() } as any)
          .eq("id", editing.id);
        if (error) throw error;
        await logAudit("config_updated", "support_channel", editing.id, form.name);
        toast({ title: "Canal atualizado!" });
      } else {
        const { error } = await supabase
          .from("support_channels")
          .insert(form as any);
        if (error) throw error;
        await logAudit("tenant_created", "support_channel", null, form.name);
        toast({ title: "Canal criado!" });
      }
      setEditing(null);
      setCreating(false);
      setForm(emptyChannel);
      fetchChannels();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este canal?")) return;
    const { error } = await supabase.from("support_channels").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      const ch = channels.find(c => c.id === id);
      await logAudit("tenant_deleted", "support_channel", id, ch?.name || id);
      if (editing?.id === id) handleCancel();
      toast({ title: "Canal excluído!" });
      fetchChannels();
    }
  };

  const handleEdit = (ch: SupportChannel) => {
    setCreating(false);
    setEditing(ch);
    setForm({
      name: ch.name,
      role: ch.role,
      status: ch.status,
      status_color: ch.status_color,
      action_text: ch.action_text,
      secondary_action_text: ch.secondary_action_text,
      about: ch.about,
      bottom_text: ch.bottom_text,
      bottom_color: ch.bottom_color,
      url: ch.url,
      initial: ch.initial,
      sort_order: ch.sort_order,
      active: ch.active,
    });
  };

  const handleCancel = () => {
    setEditing(null);
    setCreating(false);
    setForm(emptyChannel);
  };

  const isFormOpen = creating || editing;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Headphones className="h-6 w-6 text-primary" />
            Canais de Suporte
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie os canais de atendimento visíveis para todos os clientes.
          </p>
        </div>
        {!isFormOpen && (
          <Button
            onClick={() => { setCreating(true); setEditing(null); setForm(emptyChannel); }}
            className="gradient-pink text-primary-foreground border-none"
          >
            <Plus className="h-4 w-4 mr-1" /> Novo canal
          </Button>
        )}
      </div>

      {/* Form */}
      {isFormOpen && (
        <div className="rounded-xl border border-white/10 bg-card p-6 space-y-4">
          <h2 className="font-semibold text-lg">
            {editing ? "Editar canal" : "Novo canal de suporte"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Suporte Discord" className="bg-muted border-none" />
            </div>
            <div className="space-y-2">
              <Label>Função / Categoria</Label>
              <Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Atendimento" className="bg-muted border-none" />
            </div>
            <div className="space-y-2">
              <Label>URL / Link</Label>
              <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." className="bg-muted border-none" />
            </div>
            <div className="space-y-2">
              <Label>Inicial (letra do avatar)</Label>
              <Input value={form.initial} onChange={e => setForm({ ...form, initial: e.target.value.slice(0, 2) })} placeholder="D" className="bg-muted border-none" maxLength={2} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Input value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} placeholder="Online" className="bg-muted border-none" />
            </div>
            <div className="space-y-2">
              <Label>Cor do status</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.status_color} onChange={e => setForm({ ...form, status_color: e.target.value })} className="h-10 w-10 rounded cursor-pointer border-none" />
                <Input value={form.status_color} onChange={e => setForm({ ...form, status_color: e.target.value })} className="bg-muted border-none flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Botão principal</Label>
              <Input value={form.action_text} onChange={e => setForm({ ...form, action_text: e.target.value })} placeholder="+ Abrir Ticket" className="bg-muted border-none" />
            </div>
            <div className="space-y-2">
              <Label>Botão secundário</Label>
              <Input value={form.secondary_action_text} onChange={e => setForm({ ...form, secondary_action_text: e.target.value })} placeholder="Chamar" className="bg-muted border-none" />
            </div>
            <div className="space-y-2">
              <Label>Texto inferior</Label>
              <Input value={form.bottom_text} onChange={e => setForm({ ...form, bottom_text: e.target.value })} placeholder="Disponível 24/7" className="bg-muted border-none" />
            </div>
            <div className="space-y-2">
              <Label>Cor inferior</Label>
              <Select value={form.bottom_color} onValueChange={v => setForm({ ...form, bottom_color: v })}>
                <SelectTrigger className="bg-muted border-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pink">Rosa</SelectItem>
                  <SelectItem value="gold">Dourado</SelectItem>
                  <SelectItem value="blue">Azul</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} className="bg-muted border-none" />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
              <Label>Ativo</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição (sobre)</Label>
            <Textarea value={form.about} onChange={e => setForm({ ...form, about: e.target.value })} placeholder="Descrição do canal de suporte..." className="bg-muted border-none min-h-[80px]" />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-pink text-primary-foreground border-none">
              <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum canal cadastrado.
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => (
            <div
              key={ch.id}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-card p-4 transition-colors hover:bg-card/80"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary font-bold shrink-0">
                {ch.initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{ch.name}</span>
                  <span className="text-xs text-muted-foreground">({ch.role})</span>
                  {!ch.active && (
                    <span className="text-[10px] bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">Inativo</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{ch.url}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => handleEdit(ch)} className="h-8 w-8">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(ch.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminSupportPage;
