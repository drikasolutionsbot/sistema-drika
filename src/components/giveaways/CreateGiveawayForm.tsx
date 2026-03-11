import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Gift, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { useDiscordRoles } from "@/hooks/useDiscordRoles";

interface Channel { id: string; name: string; }

interface CreateGiveawayFormProps {
  onCreated: () => void;
}

export default function CreateGiveawayForm({ onCreated }: CreateGiveawayFormProps) {
  const { tenantId } = useTenant();
  const { roles } = useDiscordRoles();
  const [title, setTitle] = useState("");
  const [prize, setPrize] = useState("");
  const [description, setDescription] = useState("");
  const [winnersCount, setWinnersCount] = useState("1");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("23:59");
  const [channelId, setChannelId] = useState("");
  const [requireRoleId, setRequireRoleId] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setLoadingChannels(true);
    supabase.functions.invoke("discord-channels", { body: { tenant_id: tenantId } })
      .then(({ data }) => { if (data?.channels) setChannels(data.channels); })
      .finally(() => setLoadingChannels(false));
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !prize || !date || !tenantId) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    const [h, m] = time.split(":").map(Number);
    const endsAt = new Date(date);
    endsAt.setHours(h, m, 0, 0);

    if (endsAt.getTime() <= Date.now()) {
      toast({ title: "A data de encerramento deve ser no futuro", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-giveaways", {
        body: {
          action: "create",
          tenant_id: tenantId,
          title,
          prize,
          description,
          winners_count: parseInt(winnersCount) || 1,
          ends_at: endsAt.toISOString(),
          channel_id: channelId && channelId !== "none" ? channelId : null,
          require_role_id: requireRoleId && requireRoleId !== "none" ? requireRoleId : null,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao criar sorteio");
      toast({ title: "🎉 Sorteio criado com sucesso!" });
      setTitle(""); setPrize(""); setDescription(""); setWinnersCount("1");
      setDate(undefined); setTime("23:59"); setChannelId(""); setRequireRoleId("");
      onCreated();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (color: string | number) => {
    if (typeof color === "number") return `#${color.toString(16).padStart(6, "0")}`;
    return color || "#99AAB5";
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Título *</Label>
          <Input id="title" placeholder="Ex: Sorteio de Nitro" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prize">Prêmio *</Label>
          <Input id="prize" placeholder="Ex: Discord Nitro 1 mês" value={prize} onChange={(e) => setPrize(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Textarea id="description" placeholder="Detalhes do sorteio..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Vencedores</Label>
          <Input type="number" min="1" max="20" value={winnersCount} onChange={(e) => setWinnersCount(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Data de encerramento *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "dd/MM/yyyy") : "Selecione"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => { const today = new Date(); today.setHours(0,0,0,0); return d < today; }} initialFocus className={cn("p-3 pointer-events-auto")} />
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
          <Label>Canal do Discord (opcional)</Label>
          <Select value={channelId} onValueChange={setChannelId}>
            <SelectTrigger>
              <SelectValue placeholder={loadingChannels ? "Carregando..." : "Selecione um canal"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {channels.map((c) => (
                <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">O embed será enviado automaticamente neste canal</p>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Cargo obrigatório (opcional)
          </Label>
          <Select value={requireRoleId} onValueChange={setRequireRoleId}>
            <SelectTrigger>
              <SelectValue placeholder="Nenhum (todos participam)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getRoleColor(r.color) }} />
                    {r.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Apenas membros com este cargo poderão participar</p>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gift className="h-4 w-4 mr-2" />}
        Criar Sorteio
      </Button>
    </form>
  );
}
