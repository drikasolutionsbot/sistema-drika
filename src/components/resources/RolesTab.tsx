import { useState } from "react";
import { Plus, Trash2, Palette, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed: boolean;
}

const colorToHex = (color: number) =>
  color === 0 ? "#99AAB5" : `#${color.toString(16).padStart(6, "0")}`;

export const RolesTab = () => {
  const { tenant, tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#FF69B4");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const guildId = tenant?.discord_guild_id;

  const { data: roles = [], isLoading } = useQuery<DiscordRole[]>({
    queryKey: ["discord-roles", guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase.functions.invoke("discord-guild-info", {
        body: { guild_id: guildId },
      });
      if (error) throw error;
      return (data?.roles ?? [])
        .filter((r: DiscordRole) => r.name !== "@everyone" && !r.managed)
        .sort((a: DiscordRole, b: DiscordRole) => b.position - a.position);
    },
    enabled: !!guildId,
  });

  const handleCreate = async () => {
    if (!newRoleName.trim() || !guildId) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: {
          action: "create",
          guild_id: guildId,
          name: newRoleName.trim(),
          color: parseInt(newRoleColor.replace("#", ""), 16),
          tenant_id: tenantId,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao criar cargo");
      toast.success(`Cargo "${newRoleName}" criado!`);
      setNewRoleName("");
      setNewRoleColor("#FF69B4");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["discord-roles", guildId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar cargo");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (role: DiscordRole) => {
    if (!guildId) return;
    setDeletingId(role.id);
    try {
      const { data, error } = await supabase.functions.invoke("manage-roles", {
        body: {
          action: "delete",
          guild_id: guildId,
          role_id: role.id,
          tenant_id: tenantId,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Erro ao deletar");
      toast.success(`Cargo "${role.name}" removido`);
      queryClient.invalidateQueries({ queryKey: ["discord-roles", guildId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao deletar cargo");
    } finally {
      setDeletingId(null);
    }
  };

  if (!guildId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Conecte um servidor Discord na Visão Geral para gerenciar cargos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Gerencie os cargos do servidor diretamente pelo painel.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gradient-pink text-primary-foreground border-none hover:opacity-90">
              <Plus className="h-4 w-4 mr-1.5" /> Novo Cargo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Cargo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  placeholder="Ex: Moderador"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="h-10 w-14 rounded-lg border border-border cursor-pointer bg-transparent"
                  />
                  <Input
                    value={newRoleColor}
                    onChange={(e) => setNewRoleColor(e.target.value)}
                    className="font-mono text-sm w-28"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={!newRoleName.trim() || creating}
                className="w-full gradient-pink text-primary-foreground border-none hover:opacity-90"
              >
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Cargo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : roles.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum cargo encontrado no servidor.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cor</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Posição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <div
                      className="h-5 w-5 rounded-full border border-border"
                      style={{ backgroundColor: colorToHex(role.color) }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {role.position}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(role)}
                      disabled={deletingId === role.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {deletingId === role.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
