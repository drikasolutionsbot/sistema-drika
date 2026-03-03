import { useState, useMemo } from "react";
import { Plus, Hash, Loader2, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface Channel {
  id: string;
  name: string;
  parent_id?: string | null;
}

interface Category {
  id: string;
  name: string;
  position: number;
}

interface ChannelSelectWithCreateProps {
  value: string;
  onChange: (value: string) => void;
  channels: Channel[];
  categories?: Category[];
  onChannelCreated: () => void;
  tenantId: string | null;
  guildId?: string | null;
  placeholder?: string;
  defaultNewName?: string;
}

const ChannelSelectWithCreate = ({
  value,
  onChange,
  channels,
  categories = [],
  onChannelCreated,
  tenantId,
  guildId,
  placeholder = "Selecione um canal",
  defaultNewName = "",
}: ChannelSelectWithCreateProps) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState(defaultNewName);

  const grouped = useMemo(() => {
    if (categories.length === 0) return null;

    const groups = categories.map((cat) => ({
      category: cat,
      channels: channels.filter((ch) => ch.parent_id === cat.id),
    }));
    const uncategorized = channels.filter(
      (ch) => !ch.parent_id || !categories.some((c) => c.id === ch.parent_id)
    );
    return { groups, uncategorized };
  }, [channels, categories]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Preencha o nome do canal");
      return;
    }

    let resolvedGuildId = guildId;
    if (!resolvedGuildId && tenantId) {
      try {
        const { data } = await supabase
          .from("tenants")
          .select("discord_guild_id")
          .eq("id", tenantId)
          .single();
        resolvedGuildId = data?.discord_guild_id;
      } catch {}
    }

    if (!resolvedGuildId) {
      toast.error("Servidor Discord não configurado");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-discord-channel", {
        body: {
          guild_id: resolvedGuildId,
          name: newName.trim(),
          type: "text",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Canal #${data.channel?.name} criado!`);

      await onChannelCreated();
      if (data.channel?.id) {
        onChange(data.channel.id);
      }

      setNewName("");
      setCreateOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar canal");
    } finally {
      setCreating(false);
    }
  };

  const handleValueChange = (val: string) => {
    if (val === "__create__") {
      setCreateOpen(true);
      return;
    }
    onChange(val);
  };

  const renderChannelItem = (ch: Channel) => (
    <SelectItem key={ch.id} value={ch.id}>
      <div className="flex items-center gap-2">
        <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {ch.name}
      </div>
    </SelectItem>
  );

  return (
    <>
      <Select value={value || undefined} onValueChange={handleValueChange}>
        <SelectTrigger className="mt-1 bg-muted/50 border-border h-10">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__create__">
            <div className="flex items-center gap-2 text-primary font-medium">
              <Plus className="h-3.5 w-3.5" />
              Criar novo canal
            </div>
          </SelectItem>

          <Separator className="my-1" />

          {grouped ? (
            <>
              {grouped.uncategorized.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                    Sem categoria
                  </SelectLabel>
                  {grouped.uncategorized.map(renderChannelItem)}
                </SelectGroup>
              )}
              {grouped.groups.map(
                (g) =>
                  g.channels.length > 0 && (
                    <SelectGroup key={g.category.id}>
                      <SelectLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
                        <FolderOpen className="h-3 w-3" />
                        {g.category.name}
                      </SelectLabel>
                      {g.channels.map(renderChannelItem)}
                    </SelectGroup>
                  )
              )}
            </>
          ) : (
            channels.map(renderChannelItem)
          )}
        </SelectContent>
      </Select>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Canal no Discord</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do canal</Label>
              <Input
                placeholder="ex: boas-vindas"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <p className="text-[11px] text-muted-foreground">Será convertido para minúsculas com hifens</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating} className="gap-2">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Canal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChannelSelectWithCreate;
