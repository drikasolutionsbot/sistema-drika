import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Gift, Loader2, ShieldCheck, ChevronDown, Eye, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";
import { useDiscordRoles } from "@/hooks/useDiscordRoles";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import GiveawayEmbedPreview, { defaultEmbedConfig, type GiveawayEmbedConfig } from "./GiveawayEmbedPreview";
import GiveawayEmbedConfigForm from "./GiveawayEmbedConfig";

interface Channel { id: string; name: string; }

interface CreateGiveawayFormProps {
  onCreated: () => void;
}

interface GiveawayDraft {
  title: string;
  prize: string;
  description: string;
  winnersCount: string;
  date: string | null;
  time: string;
  channelId: string;
  requireRoleId: string;
  embedConfig: GiveawayEmbedConfig;
}

const emptyDraft: GiveawayDraft = {
  title: "",
  prize: "",
  description: "",
  winnersCount: "1",
  date: null,
  time: "23:59",
  channelId: "",
  requireRoleId: "",
  embedConfig: { ...defaultEmbedConfig },
};

export default function CreateGiveawayForm({ onCreated }: CreateGiveawayFormProps) {
  const { tenantId } = useTenant();
  const { roles } = useDiscordRoles();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);

  const { draft, setDraft, clearDraft, hasDraft, discardDraft } = useLocalDraft<GiveawayDraft>(
    "create-giveaway",
    tenantId,
    emptyDraft,
    true
  );

  useEffect(() => {
    if (!tenantId) return;
    setLoadingChannels(true);
    supabase.functions.invoke("discord-channels", { body: { tenant_id: tenantId } })
      .then(({ data }) => { if (data?.channels) setChannels(data.channels); })
      .finally(() => setLoadingChannels(false));
  }, [tenantId]);

  const updateField = <K extends keyof GiveawayDraft>(key: K, value: GiveawayDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedDate = draft.date ? new Date(draft.date) : undefined;
    if (!draft.title || !draft.prize || !parsedDate || !tenantId) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    const [h, m] = draft.time.split(":").map(Number);
    const endsAt = new Date(parsedDate);
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
          title: draft.title,
          prize: draft.prize,
          description: draft.description,
          winners_count: parseInt(draft.winnersCount) || 1,
          ends_at: endsAt.toISOString(),
          channel_id: draft.channelId && draft.channelId !== "none" ? draft.channelId : null,
          require_role_id: draft.requireRoleId && draft.requireRoleId !== "none" ? draft.requireRoleId : null,
          embed_config: draft.embedConfig,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao criar sorteio");
      toast({ title: "🎉 Sorteio criado com sucesso!" });
      clearDraft();
      setDraft(emptyDraft);
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

  const parsedDate = draft.date ? new Date(draft.date) : undefined;
  const giveawayData = {
    title: draft.title,
    prize: draft.prize,
    description: draft.description,
    winnersCount: draft.winnersCount,
    date: parsedDate,
    time: draft.time,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {hasDraft && (
        <Alert className="border-primary/30 bg-primary/5">
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">📝 Rascunho recuperado automaticamente.</span>
            <Button type="button" variant="ghost" size="sm" onClick={discardDraft} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Descartar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Form */}
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" placeholder="Ex: Sorteio de Nitro" value={draft.title} onChange={(e) => updateField("title", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prize">Prêmio *</Label>
              <Input id="prize" placeholder="Ex: Discord Nitro 1 mês" value={draft.prize} onChange={(e) => updateField("prize", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea id="description" placeholder="Detalhes do sorteio..." value={draft.description} onChange={(e) => updateField("description", e.target.value)} rows={3} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Vencedores</Label>
              <Input type="number" min="1" max="20" value={draft.winnersCount} onChange={(e) => updateField("winnersCount", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data de encerramento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !parsedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {parsedDate ? format(parsedDate, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={parsedDate} onSelect={(d) => updateField("date", d ? d.toISOString() : null)} disabled={(d) => { const today = new Date(); today.setHours(0,0,0,0); return d < today; }} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input type="time" value={draft.time} onChange={(e) => updateField("time", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Canal do Discord (opcional)</Label>
              <Select value={draft.channelId} onValueChange={(v) => updateField("channelId", v)}>
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
              <Select value={draft.requireRoleId} onValueChange={(v) => updateField("requireRoleId", v)}>
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

          {/* Embed customization collapsible */}
          <Collapsible open={embedOpen} onOpenChange={setEmbedOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Personalizar Embed do Discord
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", embedOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <GiveawayEmbedConfigForm config={draft.embedConfig} onChange={(cfg) => updateField("embedConfig", cfg)} />
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Right: Preview */}
        <div className="space-y-3">
          <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Preview do Discord
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", previewOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <GiveawayEmbedPreview config={draft.embedConfig} giveawayData={giveawayData} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm pt-4 pb-2 border-t border-border -mx-6 px-6 flex items-center gap-3">
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gift className="h-4 w-4 mr-2" />}
          Criar Sorteio
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft({ ...draft });
            toast({ title: "✅ Rascunho salvo!", description: "Seu sorteio foi salvo localmente." });
          }}
          className="w-full sm:w-auto"
        >
          💾 Salvar Rascunho
        </Button>
      </div>
    </form>
  );
}
