import { useState } from "react";
import { Upload, Palette, Users, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  profiles: { discord_username: string | null; avatar_url: string | null } | null;
}

const SettingsPage = () => {
  const { tenant, tenantId, refetch: refetchTenant } = useTenant();
  const { user } = useAuth();

  const { data: userRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await (supabase as any)
        .from("user_roles")
        .select("id, user_id, role, profiles:user_id(discord_username, avatar_url)")
        .eq("tenant_id", tenantId);
      return (data ?? []) as UserRole[];
    },
    enabled: !!tenantId,
  });

  const handleSaveBranding = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tenantId) return;
    const form = new FormData(e.currentTarget);
    await (supabase as any).from("tenants").update({
      name: form.get("name"),
      primary_color: form.get("primary_color"),
      secondary_color: form.get("secondary_color"),
    }).eq("id", tenantId);
    refetchTenant();
    toast({ title: "Configurações salvas" });
  };

  if (!tenant) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Personalize seu painel</p>
      </div>

      <Tabs defaultValue="branding">
        <TabsList className="bg-muted">
          <TabsTrigger value="branding"><Palette className="mr-2 h-4 w-4" /> Marca</TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" /> Usuários</TabsTrigger>
          <TabsTrigger value="plan"><CreditCard className="mr-2 h-4 w-4" /> Plano</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <form onSubmit={handleSaveBranding} className="rounded-xl border border-border bg-card p-6 space-y-6">
            <h3 className="font-display font-semibold">White-label</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome da Loja</Label>
                <Input name="name" defaultValue={tenant.name} className="bg-muted border-none" />
              </div>
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Button type="button" variant="outline" size="sm">Upload</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor Primária</Label>
                <div className="flex gap-2">
                  <div className="h-10 w-10 rounded-lg gradient-pink" />
                  <Input name="primary_color" defaultValue={tenant.primary_color} className="bg-muted border-none font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor Secundária</Label>
                <div className="flex gap-2">
                  <div className="h-10 w-10 rounded-lg gradient-gold" />
                  <Input name="secondary_color" defaultValue={tenant.secondary_color} className="bg-muted border-none font-mono" />
                </div>
              </div>
            </div>
            <Button type="submit" className="gradient-pink text-primary-foreground border-none hover:opacity-90">Salvar</Button>
          </form>
        </TabsContent>

        <TabsContent value="users">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h3 className="font-display font-semibold">Usuários e Permissões</h3>
              <Button variant="outline" size="sm">Convidar</Button>
            </div>
            {rolesLoading ? (
              <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
            ) : (
              <div className="divide-y divide-border">
                {userRoles.map(u => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-pink text-xs font-bold text-primary-foreground">
                        {(u.profiles?.discord_username || "?")[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{u.profiles?.discord_username || "Usuário"}</span>
                    </div>
                    <Select defaultValue={u.role}>
                      <SelectTrigger className="w-32 bg-muted border-none"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="support">Support</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="plan">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="font-display font-semibold">Plano Atual</h3>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gradient-pink capitalize">{tenant.plan || "Free"}</p>
                  <p className="text-sm text-muted-foreground">Plano atual</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">Ativo</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
