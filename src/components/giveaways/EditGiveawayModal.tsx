import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";

interface Giveaway {
  id: string;
  title: string;
  description: string | null;
  prize: string;
  winners_count: number;
  ends_at: string;
  channel_id: string | null;
  require_role_id?: string | null;
  status: string;
}

interface Channel {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  color: string;
  discord_role_id?: string;
}

interface EditGiveawayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  giveaway: Giveaway;
  onSaved: () => void;
}

export default function EditGiveawayModal({ open, onOpenChange, giveaway, onSaved }: EditGiveawayModalProps) {
  const { tenantId } = useTenant();
  const [title, setTitle] = useState(giveaway.title);
  const [prize, setPrize] = useState(giveaway.prize);
  const [description, setDescription] = useState(giveaway.description || "");
  const [winnersCount, setWinnersCount] = useState(String(giveaway.winners_count));
  const [date, setDate] = useState<Date>(new Date(giveaway.ends_at));
  const [time, setTime] = useState(format(new Date(giveaway.ends_at), "HH:mm"));
  const [channelId, setChannelId] = useState(giveaway.channel_id || "");
  const [requireRoleId, setRequireRoleId] = useState(giveaway.require_role_id || "");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId || !open) return;
    supabase.functions.invoke("discord-channels", { body: { tenant_id: tenantId } })
      .then(({ data }) => { if (data?.channels) setChannels(data.channels); });
    supabase.functions.invoke("manage-roles", { body: { action: "list", tenant_id: tenantId } })
      .then(({ data }) => { if (Array.isArray(data)) setRoles(data); });
  }, [tenantId, open]);

  useEffect(() => {
    setTitle(giveaway.title);
    setPrize(giveaway.prize);
    setDescription(giveaway.description || "");
    setWinnersCount(String(giveaway.winners_count));
    setDate(new Date(giveaway.ends_at));
    setTime(format(new Date(giveaway.ends_at), "HH:mm"));
    setChannelId(giveaway.channel_id || "");
    setRequireRoleId(giveaway.require_role_id || "");
  }, [giveaway]);

  const handleSave = async () => {
    if (!title || !prize || !date || !tenantId) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    const [h, m] = time.split(":").map(Number);
    const endsAt = new Date(date);
    endsAt.setHours(h, m, 0, 0);

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-giveaways", {
        body: {
          action: "update",
          tenant_id: tenantId,
          giveaway_id: giveaway.id,
          title,
          prize,
          description,
          winners_count: parseInt(winnersCount) || 1,
          ends_at: endsAt.toISOString(),
          channel_id: channelId || null,
          require_role_id: requireRoleId || null,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao salvar");
      toast({ title: "✅ Sorteio atualizado!" });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Sorteio</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prêmio *</Label>
              <Input value={prize} onChange={(e) => setPrize(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Vencedores</Label>
              <Input type="number" min="1" max="20" value={winnersCount} onChange={(e) => setWinnersCount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Canal do Discord</Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cargo obrigatório</Label>
              <Select value={requireRoleId} onValueChange={setRequireRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (todos participam)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.discord_role_id || r.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                        {r.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
