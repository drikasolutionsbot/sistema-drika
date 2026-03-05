import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, Key, Copy, Trash2, Eye, EyeOff, Loader2, Users, Crown, Search, Settings, Mail, Phone, Calendar, CalendarClock, ShieldCheck, ShieldOff, Download, FileSpreadsheet, FileText } from "lucide-react";
import { logAudit } from "@/lib/auditLog";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PLANS = [
  { value: "free", label: "Drika Solutions Free", color: "text-muted-foreground bg-muted/50 border-border" },
  { value: "pro", label: "Drika Solutions Pro", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500" },
];

const getPlanBadgeClass = (plan: string) => {
  return PLANS.find((p) => p.value === plan)?.color || PLANS[0].color;
};

const AdminClientsPage = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [tokens, setTokens] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");

  // New tenant form
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantGuildId, setNewTenantGuildId] = useState("");
  const [newTenantPlan, setNewTenantPlan] = useState("free");
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);

  // Plan editing
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Token generation
  const [tokenLabel, setTokenLabel] = useState("");
  const [generatingToken, setGeneratingToken] = useState<string | null>(null);
  const [tokenDialogTenantId, setTokenDialogTenantId] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    const { data } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });
    setTenants(data || []);
    setLoading(false);
  }, []);

  const fetchTokens = useCallback(async (tenantId: string) => {
    const { data } = await supabase
      .from("access_tokens")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    setTokens((prev) => ({ ...prev, [tenantId]: data || [] }));
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      !searchQuery.trim() ||
      t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.discord_guild_id?.includes(searchQuery) ||
      t.id?.includes(searchQuery);
    const matchesPlan = planFilter === "all" || (t.plan || "free") === planFilter;
    return matchesSearch && matchesPlan;
  });

  const planStats = PLANS.map((p) => ({
    ...p,
    count: tenants.filter((t) => (t.plan || "free") === p.value).length,
  }));

  const handleCreateTenant = async () => {
    if (!newTenantName.trim()) return;
    setCreatingTenant(true);
    try {
      const { error } = await supabase.from("tenants").insert({
        name: newTenantName.trim(),
        discord_guild_id: newTenantGuildId.trim() || null,
        plan: newTenantPlan,
      });
      if (error) throw error;
      await logAudit("tenant_created", "tenant", null, newTenantName.trim(), { plan: newTenantPlan });
      toast({ title: "Cliente criado com sucesso!" });
      setNewTenantName("");
      setNewTenantGuildId("");
      setNewTenantPlan("free");
      setTenantDialogOpen(false);
      fetchTenants();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setCreatingTenant(false);
  };

  const handleChangePlan = async (tenantId: string, newPlan: string) => {
    setSavingPlan(true);
    try {
      const now = new Date();
      const updateData: any = { plan: newPlan };
      
      if (newPlan === "pro") {
        // Activate pro: set start to now, expires in 30 days
        updateData.plan_started_at = now.toISOString();
        updateData.plan_expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        // Downgrade to free: clear dates
        updateData.plan_started_at = null;
        updateData.plan_expires_at = null;
      }

      const { error } = await supabase
        .from("tenants")
        .update(updateData)
        .eq("id", tenantId);
      if (error) throw error;
      const tenantName = tenants.find(t => t.id === tenantId)?.name || tenantId;
      const oldPlan = tenants.find(t => t.id === tenantId)?.plan || "free";
      await logAudit("plan_changed", "tenant", tenantId, tenantName, { from: oldPlan, to: newPlan });
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...updateData } : t))
      );
      toast({ title: "Plano atualizado!", description: `Alterado para ${PLANS.find((p) => p.value === newPlan)?.label}` });
      setEditingPlan(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSavingPlan(false);
  };

  const handleRenewPlan = async (tenantId: string) => {
    setSavingPlan(true);
    try {
      const now = new Date();
      const updateData = {
        plan: "pro",
        plan_started_at: now.toISOString(),
        plan_expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const { error } = await supabase
        .from("tenants")
        .update(updateData)
        .eq("id", tenantId);
      if (error) throw error;
      const tenantName = tenants.find(t => t.id === tenantId)?.name || tenantId;
      await logAudit("plan_changed", "tenant", tenantId, tenantName, { action: "renew_30d" });
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...updateData } : t))
      );
      toast({ title: "Plano renovado por +30 dias! ✅" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSavingPlan(false);
  };

  const handleGenerateToken = async (tenantId: string) => {
    setGeneratingToken(tenantId);
    try {
      const { data, error } = await supabase
        .from("access_tokens")
        .insert({
          tenant_id: tenantId,
          label: tokenLabel.trim() || null,
          created_by: (await supabase.auth.getUser()).data.user?.id || null,
        })
        .select("token")
        .single();

      if (error) throw error;
      setGeneratedToken(data.token);
      toast({ title: "Token gerado com sucesso!" });
      fetchTokens(tenantId);
    } catch (err: any) {
      toast({ title: "Erro ao gerar token", description: err.message, variant: "destructive" });
    }
    setGeneratingToken(null);
  };

  const handleRevokeToken = async (tokenId: string, tenantId: string) => {
    const { error } = await supabase
      .from("access_tokens")
      .update({ revoked: true })
      .eq("id", tokenId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Token revogado" });
      fetchTokens(tenantId);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  const [deletingTenant, setDeletingTenant] = useState<string | null>(null);

  const handleDeleteTenant = async (tenantId: string, tenantName: string) => {
    setDeletingTenant(tenantId);
    try {
      const { data, error } = await supabase.functions.invoke("delete-tenant", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await logAudit("tenant_deleted", "tenant", tenantId, tenantName);
      toast({ title: "Cliente excluído", description: `${tenantName} foi removido permanentemente.` });
      setTenants((prev) => prev.filter((t) => t.id !== tenantId));
      if (expandedTenant === tenantId) setExpandedTenant(null);
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
    setDeletingTenant(null);
  };

  const toggleExpand = (tenantId: string) => {
    if (expandedTenant === tenantId) {
      setExpandedTenant(null);
    } else {
      setExpandedTenant(tenantId);
      if (!tokens[tenantId]) fetchTokens(tenantId);
    }
  };
  const getExportData = () => filteredTenants.map((t) => ({
    Nome: t.name || "",
    Email: t.email || "",
    WhatsApp: t.whatsapp || "",
  }));

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(getExportData());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `clientes_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
    toast({ title: "Excel exportado!" });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Clientes - Drika Solutions", 14, 20);
    doc.setFontSize(10);
    doc.text(`Exportado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
    const data = getExportData();
    autoTable(doc, {
      startY: 35,
      head: [["Nome", "Email", "WhatsApp"]],
      body: data.map((r) => [r.Nome, r.Email, r.WhatsApp]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [255, 40, 73] },
    });
    doc.save(`clientes_${format(new Date(), "dd-MM-yyyy")}.pdf`);
    toast({ title: "PDF exportado!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gerencie clientes, planos e tokens de acesso</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="mr-2 h-4 w-4" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={tenantDialogOpen} onOpenChange={setTenantDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-pink text-primary-foreground border-none hover:opacity-90">
                <Plus className="mr-2 h-4 w-4" /> Novo Cliente
              </Button>
            </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Adicionar Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome do Cliente *</Label>
                <Input
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  placeholder="Ex: Loja do João"
                  className="bg-muted border-none"
                />
              </div>
              <div className="space-y-2">
                <Label>Discord Guild ID (opcional)</Label>
                <Input
                  value={newTenantGuildId}
                  onChange={(e) => setNewTenantGuildId(e.target.value)}
                  placeholder="Ex: 1234567890"
                  className="bg-muted border-none"
                />
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={newTenantPlan} onValueChange={setNewTenantPlan}>
                  <SelectTrigger className="bg-muted border-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button
                onClick={handleCreateTenant}
                disabled={creatingTenant || !newTenantName.trim()}
                className="gradient-pink text-primary-foreground border-none hover:opacity-90"
              >
                {creatingTenant ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Plan Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {planStats.map((p) => (
          <button
            key={p.value}
            onClick={() => setPlanFilter(planFilter === p.value ? "all" : p.value)}
            className={`rounded-xl border p-4 text-left transition-all ${
              planFilter === p.value
                ? "ring-2 ring-primary border-primary"
                : "border-border hover:border-primary/50"
            } bg-card`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`inline-flex items-center rounded-md border px-2 py-[2px] text-xs font-medium ${p.color}`}>
                {p.label}
              </span>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground">{p.count}</p>
            <p className="text-xs text-muted-foreground">clientes</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome, Guild ID ou ID..."
          className="pl-9 bg-card border-border"
        />
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Lista de Clientes
            {filteredTenants.length !== tenants.length && (
              <span className="text-sm font-normal text-muted-foreground">
                ({filteredTenants.length} de {tenants.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredTenants.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum cliente encontrado.</p>
          ) : (
            <div className="space-y-3">
              {filteredTenants.map((tenant) => {
                const isExpanded = expandedTenant === tenant.id;
                const tenantTokens = tokens[tenant.id] || [];
                const currentPlan = tenant.plan || "free";
                const planInfo = PLANS.find((p) => p.value === currentPlan) || PLANS[0];
                const isPro = currentPlan === "pro";
                const isExpired = isPro && tenant.plan_expires_at && new Date(tenant.plan_expires_at) < new Date();
                const daysLeft = isPro && tenant.plan_expires_at
                  ? Math.ceil((new Date(tenant.plan_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;

                return (
                  <div key={tenant.id} className={`rounded-lg border overflow-hidden ${isExpired ? "border-destructive/50 bg-destructive/5" : "border-border"}`}>
                    {/* Tenant row */}
                    <div
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleExpand(tenant.id)}
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{tenant.name}</p>
                            {isExpired && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 border border-destructive/30 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                                <ShieldOff className="h-3 w-3" /> EXPIRADO
                              </span>
                            )}
                            {isPro && !isExpired && daysLeft !== null && daysLeft <= 5 && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
                                ⚠️ {daysLeft}d restantes
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            {tenant.email && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {tenant.email}
                              </span>
                            )}
                            {tenant.whatsapp && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {tenant.whatsapp}
                              </span>
                            )}
                            {isPro && tenant.plan_started_at && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Início: {format(new Date(tenant.plan_started_at), "dd/MM/yyyy")}
                              </span>
                            )}
                            {isPro && tenant.plan_expires_at && (
                              <span className={`text-xs flex items-center gap-1 ${isExpired ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                                <CalendarClock className="h-3 w-3" /> Vence: {format(new Date(tenant.plan_expires_at), "dd/MM/yyyy")}
                              </span>
                            )}
                            {!tenant.email && !tenant.whatsapp && !isPro && (
                              <span className="text-xs text-muted-foreground font-mono">
                                {tenant.discord_guild_id || "Sem contato"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {editingPlan === tenant.id ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={currentPlan}
                              onValueChange={(val) => handleChangePlan(tenant.id, val)}
                              disabled={savingPlan}
                            >
                              <SelectTrigger className="h-7 w-28 text-xs bg-muted border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PLANS.map((p) => (
                                  <SelectItem key={p.value} value={p.value}>
                                    {p.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => setEditingPlan(null)}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-[2px] text-xs font-medium transition-colors hover:opacity-80 ${planInfo.color}`}
                              onClick={() => setEditingPlan(tenant.id)}
                              title="Clique para alterar o plano"
                            >
                              <Settings className="h-3 w-3" />
                              {planInfo.label}
                            </button>
                            {isPro && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                                onClick={() => handleRenewPlan(tenant.id)}
                                disabled={savingPlan}
                              >
                                <CalendarClock className="h-3 w-3 mr-1" />
                                Renovar +30d
                              </Button>
                            )}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {format(new Date(tenant.created_at), "dd/MM/yyyy")}
                        </span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => e.stopPropagation()}
                              disabled={deletingTenant === tenant.id}
                            >
                              {deletingTenant === tenant.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border" onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir cliente permanentemente?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Todos os dados de <strong>{tenant.name}</strong> serão excluídos: produtos, pedidos, tokens, configurações e o usuário associado. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                              >
                                Excluir Permanentemente
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Key className={`h-4 w-4 transition-transform ${isExpanded ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                    </div>

                    {/* Expanded tokens section */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/30 px-4 py-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-foreground">Tokens de Acesso</h4>
                          <Dialog
                            open={tokenDialogTenantId === tenant.id}
                            onOpenChange={(open) => {
                              setTokenDialogTenantId(open ? tenant.id : null);
                              if (!open) {
                                setGeneratedToken(null);
                                setTokenLabel("");
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button size="sm" className="gradient-pink text-primary-foreground border-none hover:opacity-90">
                                <Key className="mr-1 h-3 w-3" /> Gerar Token
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-card border-border">
                              <DialogHeader>
                                <DialogTitle>Gerar Token para {tenant.name}</DialogTitle>
                              </DialogHeader>

                              {generatedToken ? (
                                <div className="space-y-4 py-2">
                                  <p className="text-sm text-muted-foreground">
                                    Token gerado! Copie agora, ele não será exibido novamente.
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      value={generatedToken}
                                      readOnly
                                      className="bg-muted border-none font-mono text-xs"
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => copyToClipboard(generatedToken)}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <DialogFooter>
                                    <DialogClose asChild>
                                      <Button variant="ghost">Fechar</Button>
                                    </DialogClose>
                                  </DialogFooter>
                                </div>
                              ) : (
                                <div className="space-y-4 py-2">
                                  <div className="space-y-2">
                                    <Label>Rótulo (opcional)</Label>
                                    <Input
                                      value={tokenLabel}
                                      onChange={(e) => setTokenLabel(e.target.value)}
                                      placeholder="Ex: Token principal"
                                      className="bg-muted border-none"
                                    />
                                  </div>
                                  <DialogFooter>
                                    <DialogClose asChild>
                                      <Button variant="ghost">Cancelar</Button>
                                    </DialogClose>
                                    <Button
                                      onClick={() => handleGenerateToken(tenant.id)}
                                      disabled={!!generatingToken}
                                      className="gradient-pink text-primary-foreground border-none hover:opacity-90"
                                    >
                                      {generatingToken ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <Key className="mr-2 h-4 w-4" />
                                      )}
                                      Gerar
                                    </Button>
                                  </DialogFooter>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </div>

                        {tenantTokens.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum token gerado.</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Rótulo</TableHead>
                                <TableHead>Token</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Último uso</TableHead>
                                <TableHead>Criado em</TableHead>
                                <TableHead className="w-20"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {tenantTokens.map((tk) => (
                                <TableRow key={tk.id}>
                                  <TableCell className="text-sm">{tk.label || "—"}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <span className="font-mono text-xs">
                                        {showTokens[tk.id]
                                          ? tk.token
                                          : `${tk.token.substring(0, 8)}...`}
                                      </span>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() =>
                                          setShowTokens((prev) => ({ ...prev, [tk.id]: !prev[tk.id] }))
                                        }
                                      >
                                        {showTokens[tk.id] ? (
                                          <EyeOff className="h-3 w-3" />
                                        ) : (
                                          <Eye className="h-3 w-3" />
                                        )}
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        onClick={() => copyToClipboard(tk.token)}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={tk.revoked ? "destructive" : "default"}>
                                      {tk.revoked ? "Revogado" : "Ativo"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {tk.last_used_at
                                      ? format(new Date(tk.last_used_at), "dd/MM HH:mm")
                                      : "Nunca"}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {format(new Date(tk.created_at), "dd/MM/yyyy")}
                                  </TableCell>
                                  <TableCell>
                                    {!tk.revoked && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => handleRevokeToken(tk.id, tenant.id)}
                                        title="Revogar token"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminClientsPage;
