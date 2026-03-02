import { useState } from "react";
import { Upload, Palette, Users, Shield, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const mockUsers = [
  { id: "1", name: "Adriana (Drika)", role: "OWNER", avatar: "D" },
  { id: "2", name: "Carlos Silva", role: "ADMIN", avatar: "C" },
  { id: "3", name: "Ana Santos", role: "SUPPORT", avatar: "A" },
];

const SettingsPage = () => {
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
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <h3 className="font-display font-semibold">White-label</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome da Loja</Label>
                <Input defaultValue="Minha Loja" className="bg-muted border-none" />
              </div>
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Button variant="outline" size="sm">Upload</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor Primária</Label>
                <div className="flex gap-2">
                  <div className="h-10 w-10 rounded-lg gradient-pink" />
                  <Input defaultValue="#FF69B4" className="bg-muted border-none font-mono" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor Secundária</Label>
                <div className="flex gap-2">
                  <div className="h-10 w-10 rounded-lg gradient-gold" />
                  <Input defaultValue="#FFD700" className="bg-muted border-none font-mono" />
                </div>
              </div>
            </div>
            <Button className="gradient-pink text-primary-foreground border-none hover:opacity-90">Salvar</Button>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h3 className="font-display font-semibold">Usuários e Permissões</h3>
              <Button variant="outline" size="sm">Convidar</Button>
            </div>
            <div className="divide-y divide-border">
              {mockUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-pink text-xs font-bold text-primary-foreground">
                      {u.avatar}
                    </div>
                    <span className="text-sm font-medium">{u.name}</span>
                  </div>
                  <Select defaultValue={u.role}>
                    <SelectTrigger className="w-32 bg-muted border-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNER">Owner</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="SUPPORT">Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="plan">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="font-display font-semibold">Plano Atual</h3>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gradient-pink">Plano Pro</p>
                  <p className="text-sm text-muted-foreground">R$ 49,90/mês</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">Ativo</span>
              </div>
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Servidores</span><span>2/5</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Produtos</span><span>12/50</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pedidos/mês</span><span>156/500</span></div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
