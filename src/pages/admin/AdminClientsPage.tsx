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
import { Plus, Key, Copy, Eye, EyeOff, Loader2, Users, Crown, Search, Settings, Mail, Phone, Calendar, CalendarClock, ShieldCheck, ShieldOff, Download, FileSpreadsheet, FileText, AtSign, Trash2, Clock, AlertTriangle, ExternalLink, MessageSquare, Server, Globe } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import TrashIcon from "@/components/ui/trash-icon";
import { logAudit } from "@/lib/auditLog";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { PLANS, isPaidPlan, formatPlanLabel, formatPlanLabelWithIcon, getCycleDays } from "@/lib/plans";

const DiscordIcon = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // New tenant form
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantGuildId, setNewTenantGuildId] = useState("");
  const [newTenantPlan, setNewTenantPlan] = useState("free");
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);

  // Plan editing
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Renew dialog
  const [renewDialogTenantId, setRenewDialogTenantId] = useState<string | null>(null);
  const [renewDays, setRenewDays] = useState("30");
  const [renewPlan, setRenewPlan] = useState<string>("free");

  // Token generation
  const [tokenLabel, setTokenLabel] = useState("");
  const [generatingToken, setGeneratingToken] = useState<string | null>(null);
  const [tokenDialogTenantId, setTokenDialogTenantId] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // Discord edit dialog
  const [editingDiscordTenant, setEditingDiscordTenant] = useState<any | null>(null);
  const [discordGuildInput, setDiscordGuildInput] = useState("");
  const [discordOwnerIdInput, setDiscordOwnerIdInput] = useState("");
  const [discordOwnerUsernameInput, setDiscordOwnerUsernameInput] = useState("");
  const [savingDiscord, setSavingDiscord] = useState(false);

  const handleSaveDiscord = async () => {
    if (!editingDiscordTenant) return;
    setSavingDiscord(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          discord_guild_id: discordGuildInput.trim() || null,
          owner_discord_id: discordOwnerIdInput.trim() || null,
          owner_discord_username: discordOwnerUsernameInput.trim() || null,
        })
        .eq("id", editingDiscordTenant.id);

      if (error) throw error;
      toast({ title: "Discord atualizado com sucesso! ✅" });
      setEditingDiscordTenant(null);
      fetchTenants();
    } catch (err: any) {
      toast({ title: "Erro ao atualizar Discord", description: err.message, variant: "destructive" });
    } finally {
      setSavingDiscord(false);
    }
  };

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
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.name?.toLowerCase().includes(q) ||
      t.discord_guild_id?.includes(q) ||
      t.owner_discord_username?.toLowerCase().includes(q) ||
      t.owner_discord_id?.includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.whatsapp?.includes(q) ||
      t.registration_ip?.toLowerCase().includes(q) ||
      t.id?.includes(q);
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

  const handleChangePlan = async (tenantId: string, selection: string) => {
    setSavingPlan(true);
    try {
      const now = new Date();
      const oldTenant = tenants.find(t => t.id === tenantId);
      const oldPlan = oldTenant?.plan || "free";
      
      const [newPlan, cycleVal] = selection.includes(":") ? selection.split(":") : [selection, "monthly"];
      const newCycle = cycleVal || "monthly";
      const cycleDays = getCycleDays(newCycle);

      const updateData: any = { plan: newPlan, plan_cycle: newCycle };

      if (newPlan === "pro" || newPlan === "master") {
        if (!oldTenant?.plan_started_at) {
          updateData.plan_started_at = now.toISOString();
        }
        if (!oldTenant?.plan_expires_at || new Date(oldTenant.plan_expires_at) < now) {
          updateData.plan_expires_at = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000).toISOString();
        }
      } else {
        updateData.plan_started_at = null;
        updateData.plan_expires_at = null;
      }

      const losingMasterPerks = oldPlan === "master" && newPlan !== "master";
      if (losingMasterPerks) {
        updateData.bot_banner_url = null;
      }

      const { error } = await supabase
        .from("tenants")
        .update(updateData)
        .eq("id", tenantId);
      if (error) throw error;

      if (losingMasterPerks) {
        try {
          await supabase.functions.invoke("clear-bot-banner", { body: { tenant_id: tenantId } });
        } catch (e) {
          console.error("clear-bot-banner failed:", e);
        }
      }

      const tenantName = oldTenant?.name || tenantId;
      await logAudit("plan_changed", "tenant", tenantId, tenantName, { from: oldPlan, to: newPlan, cycle: newCycle });
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...updateData } : t))
      );
      toast({ title: "Plano atualizado!", description: `Alterado para ${formatPlanLabelWithIcon(newPlan, newCycle)}` });
      setEditingPlan(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingPlan(false);
    }
  };

  const handleRenewPlan = async (tenantId: string, days: number) => {
    setSavingPlan(true);
    try {
      const tenant = tenants.find(t => t.id === tenantId);
      const now = new Date();
      // If tenant already has a future expiration, extend from that date; otherwise from now
      const baseDate = tenant?.plan_expires_at && new Date(tenant.plan_expires_at) > now
        ? new Date(tenant.plan_expires_at)
        : now;
      const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
      
      const updateData: any = {
        plan_expires_at: newExpiry.toISOString(),
        plan: renewPlan,
      };
      // If no plan_started_at yet, set it
      if (!tenant?.plan_started_at) {
        updateData.plan_started_at = now.toISOString();
      }

      const { error } = await supabase
        .from("tenants")
        .update(updateData)
        .eq("id", tenantId);
      if (error) throw error;
      const tenantName = tenant?.name || tenantId;
      await logAudit("plan_days_added", "tenant", tenantId, tenantName, { days, plan: renewPlan, new_expires: newExpiry.toISOString() });
      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...updateData } : t))
      );
      toast({ title: `+${days} dias adicionados! ✅`, description: `Novo vencimento: ${format(newExpiry, "dd/MM/yyyy")}` });
      setRenewDialogTenantId(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSavingPlan(false);
  };

  const [expiringPlan, setExpiringPlan] = useState<string | null>(null);

  const handleExpirePlan = async (tenantId: string) => {
    setExpiringPlan(tenantId);
    try {
      const tenant = tenants.find(t => t.id === tenantId);
      // Força expiração imediata: define plan_expires_at = agora.
      // Mantemos o plano atual (pro/master) para que a UI mostre como "Expirado"
      // e o cliente precise renovar/pagar para reativar.
      const expiredAt = new Date(Date.now() - 60_000).toISOString();
      const { error } = await supabase
        .from("tenants")
        .update({ plan_expires_at: expiredAt })
        .eq("id", tenantId);
      if (error) throw error;

      const tenantName = tenant?.name || tenantId;
      await logAudit("plan_expired_manually", "tenant", tenantId, tenantName, {
        previous_expires_at: tenant?.plan_expires_at || null,
        plan: tenant?.plan || null,
      });
      setTenants(prev =>
        prev.map(t => (t.id === tenantId ? { ...t, plan_expires_at: expiredAt } : t))
      );
      toast({
        title: "Plano expirado",
        description: `${tenantName} precisará renovar o pagamento para reativar.`,
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setExpiringPlan(null);
  };

  const handleGenerateToken = async (tenantId: string) => {
    setGeneratingToken(tenantId);
    try {
      // Auto-revoke any existing active tokens before generating a new one
      const { data: existingTokens } = await supabase
        .from("access_tokens")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("revoked", false);

      if (existingTokens && existingTokens.length > 0) {
        const { error: revokeError } = await supabase
          .from("access_tokens")
          .update({ revoked: true })
          .in("id", existingTokens.map((t) => t.id));
        if (revokeError) throw revokeError;
      }

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
      const tenantName = tenants.find((t) => t.id === tenantId)?.name || tenantId;
      await logAudit("token_generated", "tenant", tenantId, tenantName, {
        revoked_previous: existingTokens?.length || 0,
      });
      toast({
        title: "Novo token gerado!",
        description: existingTokens && existingTokens.length > 0
          ? `${existingTokens.length} token(s) anterior(es) foram revogados automaticamente.`
          : "Token criado com sucesso.",
      });
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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    let deleted = 0;
    for (const tenantId of ids) {
      try {
        const tenantName = tenants.find(t => t.id === tenantId)?.name || tenantId;
        const { data, error } = await supabase.functions.invoke("delete-tenant", {
          body: { tenant_id: tenantId },
        });
        if (error || data?.error) continue;
        await logAudit("tenant_deleted", "tenant", tenantId, tenantName);
        deleted++;
      } catch { /* continue */ }
    }
    setTenants(prev => prev.filter(t => !selectedIds.has(t.id)));
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
    setBulkDeleting(false);
    toast({ title: `${deleted} cliente(s) excluído(s) ✅` });
  };

  const toggleExpand = (tenantId: string) => {
    if (expandedTenant === tenantId) {
      setExpandedTenant(null);
    } else {
      setExpandedTenant(tenantId);
      if (!tokens[tenantId]) fetchTokens(tenantId);
    }
  };
  const getExportData = () => filteredTenants.map((t) => {
    const planName = t.plan === "master" ? "Master" : t.plan === "pro" ? "Pro" : "Free";
    const hasExpiry = Boolean(t.plan_expires_at) && t.plan !== "free";
    const isExp = hasExpiry && new Date(t.plan_expires_at) < new Date();
    const dLeft = hasExpiry ? Math.ceil((new Date(t.plan_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

    return {
      Nome: t.name || "",
      Plano: planName,
      "Guild ID": t.discord_guild_id || "",
      Email: t.email || "",
      WhatsApp: t.whatsapp || "",
      "IP de Cadastro": t.registration_ip || "Não registrado",
      "Início do Plano": t.plan_started_at ? format(new Date(t.plan_started_at), "dd/MM/yyyy HH:mm") : "",
      "Expira em": t.plan_expires_at ? format(new Date(t.plan_expires_at), "dd/MM/yyyy HH:mm") : "",
      "Dias Restantes": hasExpiry ? (isExp ? "Expirado" : `${dLeft} dias`) : "Ilimitado",
      "Criado em": t.created_at ? format(new Date(t.created_at), "dd/MM/yyyy HH:mm") : "",
      Status: isExp ? "Expirado" : "Ativo",
    };
  });

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(getExportData());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `clientes_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
    toast({ title: "Excel exportado!" });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Clientes - Drika Solutions", 14, 20);
    doc.setFontSize(10);
    doc.text(`Exportado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
    const data = getExportData();
    const headers = Object.keys(data[0] || {});
    autoTable(doc, {
      startY: 35,
      head: [headers],
      body: data.map((r) => headers.map((h) => (r as any)[h])),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 40, 73] },
    });
    doc.save(`clientes_${format(new Date(), "dd-MM-yyyy")}.pdf`);
    toast({ title: "PDF exportado!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm">Gerencie clientes, planos e tokens de acesso</p>
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
          placeholder="Buscar por nome, Discord, Email, WhatsApp ou IP..."
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

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <span className="text-sm font-medium text-destructive flex-1">
                {selectedIds.size} cliente(s) selecionado(s)
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setSelectedIds(new Set())}
              >
                Limpar seleção
              </Button>
              <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="text-xs h-7 bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir {selectedIds.size} selecionado(s)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border max-w-sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {selectedIds.size} cliente(s)?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação é irreversível. Todos os dados, tokens e configurações desses clientes serão removidos permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
                    >
                      {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Confirmar Exclusão
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
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
              {/* Select all */}
              {filteredTenants.length > 0 && (
                <div className="flex items-center gap-2 px-1 pb-1 border-b border-border">
                  <Checkbox
                    id="select-all"
                    checked={filteredTenants.every(t => selectedIds.has(t.id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(new Set(filteredTenants.map(t => t.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                  <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer select-none">
                    Selecionar todos ({filteredTenants.length})
                  </label>
                </div>
              )}
              {filteredTenants.map((tenant) => {
                const isExpanded = expandedTenant === tenant.id;
                const tenantTokens = tokens[tenant.id] || [];
                const currentPlan = tenant.plan || "free";
                const planInfo = PLANS.find((p) => p.value === currentPlan) || PLANS[0];
                const isPaid = isPaidPlan(currentPlan);
                const hasPlanExpiration = Boolean(tenant.plan_expires_at) && currentPlan !== "free";
                const now = new Date();
                const startDate = tenant.plan_started_at ? new Date(tenant.plan_started_at) : null;
                const expiryDate = tenant.plan_expires_at ? new Date(tenant.plan_expires_at) : null;
                const isExpired = hasPlanExpiration && expiryDate ? expiryDate < now : false;

                const diffMs = expiryDate ? expiryDate.getTime() - now.getTime() : 0;
                const daysLeft = hasPlanExpiration
                  ? Math.ceil(diffMs / (1000 * 60 * 60 * 24))
                  : null;
                const hoursLeft = hasPlanExpiration
                  ? Math.ceil(diffMs / (1000 * 60 * 60))
                  : null;

                const totalCycleMs = startDate && expiryDate ? Math.max(1, expiryDate.getTime() - startDate.getTime()) : null;
                const elapsedCycleMs = startDate ? Math.max(0, now.getTime() - startDate.getTime()) : null;
                const cyclePercent = totalCycleMs && elapsedCycleMs !== null
                  ? Math.min(100, Math.max(0, Math.round((elapsedCycleMs / totalCycleMs) * 100)))
                  : null;

                return (
                  <div key={tenant.id} className={`rounded-lg border overflow-hidden ${isExpired ? "border-destructive/50 bg-destructive/5" : selectedIds.has(tenant.id) ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                    {/* Tenant row */}
                    <div
                      className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors gap-2"
                      onClick={() => toggleExpand(tenant.id)}
                    >
                      {/* Checkbox */}
                      <div
                        className="shrink-0 mr-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            next.has(tenant.id) ? next.delete(tenant.id) : next.add(tenant.id);
                            return next;
                          });
                        }}
                      >
                        <Checkbox checked={selectedIds.has(tenant.id)} />
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground">{tenant.name}</p>
                            {isExpired && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 border border-destructive/30 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                                <ShieldOff className="h-3 w-3" /> EXPIRADO
                              </span>
                            )}
                            {!isExpired && daysLeft !== null && (
                              <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${
                                daysLeft <= 0
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse"
                                  : daysLeft <= 5
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                              }`}>
                                {daysLeft <= 0 ? (
                                  <>⚠️ Expira hoje ({Math.max(1, hoursLeft || 1)}h)</>
                                ) : daysLeft === 1 ? (
                                  <>⚠️ 1 dia restante</>
                                ) : daysLeft <= 5 ? (
                                  <>⚠️ {daysLeft}d restantes</>
                                ) : (
                                  <>⏳ {daysLeft}d restantes</>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            {/* Discord Badge com Link Direto */}
                            {tenant.owner_discord_id || tenant.owner_discord_username ? (
                              <a
                                href={tenant.owner_discord_id ? `https://discord.com/users/${tenant.owner_discord_id}` : `https://discord.com/channels/${tenant.discord_guild_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={`Abrir ${tenant.owner_discord_id ? `perfil de @${tenant.owner_discord_username || tenant.owner_discord_id}` : `servidor`} no Discord`}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#5865F2]/15 border border-[#5865F2]/35 text-[#798bf2] hover:bg-[#5865F2]/25 hover:text-white transition-all shadow-sm group"
                              >
                                <DiscordIcon className="h-3.5 w-3.5 text-[#5865F2] group-hover:scale-110 transition-transform shrink-0" />
                                <span className="group-hover:underline">
                                  @{tenant.owner_discord_username || tenant.owner_discord_id}
                                </span>
                                {tenant.owner_discord_id && (
                                  <span className="text-[10px] text-muted-foreground/60 font-mono hidden sm:inline">
                                    ({tenant.owner_discord_id})
                                  </span>
                                )}
                                <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 shrink-0" />
                              </a>
                            ) : tenant.discord_guild_id ? (
                              <a
                                href={`https://discord.com/channels/${tenant.discord_guild_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={`Abrir servidor do cliente no Discord (${tenant.discord_guild_id})`}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#5865F2]/15 border border-[#5865F2]/35 text-[#798bf2] hover:bg-[#5865F2]/25 hover:text-white transition-all shadow-sm group"
                              >
                                <Server className="h-3 w-3 text-[#5865F2] shrink-0" />
                                <span className="group-hover:underline font-mono">
                                  Servidor: {tenant.discord_guild_id}
                                </span>
                                <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground/60 inline-flex items-center gap-1">
                                <DiscordIcon className="h-3 w-3 opacity-40 shrink-0" /> Sem Discord
                              </span>
                            )}

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
                            {tenant.registration_ip && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(tenant.registration_ip);
                                  toast({ title: "IP copiado! 📋", description: tenant.registration_ip });
                                }}
                                className="group/ip text-xs text-muted-foreground flex items-center gap-1.5 font-mono bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded-md cursor-pointer transition-all shadow-sm"
                                title="Clique para copiar o IP"
                              >
                                <Globe className="h-3 w-3 text-cyan-400 shrink-0" />
                                <span>{tenant.registration_ip}</span>
                                <Copy className="h-3 w-3 opacity-60 group-hover/ip:opacity-100 group-hover/ip:scale-110 transition-all shrink-0 ml-0.5" />
                              </div>
                            )}
                            {hasPlanExpiration && tenant.plan_started_at && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Início: {format(new Date(tenant.plan_started_at), "dd/MM/yyyy")}
                              </span>
                            )}
                            {hasPlanExpiration && tenant.plan_expires_at && (
                              <span className={`text-xs flex items-center gap-1 ${isExpired ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                                <CalendarClock className="h-3 w-3" /> Vence: {format(new Date(tenant.plan_expires_at), "dd/MM/yyyy")}
                                {!isExpired && daysLeft !== null && (
                                  <span className={`font-semibold ${daysLeft <= 5 ? "text-amber-500" : "text-emerald-500"}`}>
                                    ({daysLeft <= 0 ? "expira hoje" : `${daysLeft} dias restantes`})
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {editingPlan === tenant.id ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={currentPlan === "free" ? "free" : `${currentPlan}:${tenant.plan_cycle || "monthly"}`}
                              onValueChange={(val) => handleChangePlan(tenant.id, val)}
                              disabled={savingPlan}
                            >
                              <SelectTrigger className="h-7 min-w-[140px] text-xs bg-muted border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="free">🎁 Free</SelectItem>
                                <SelectItem value="pro:monthly">💎 Básico (Mensal)</SelectItem>
                                <SelectItem value="pro:quarterly">💎 Básico (Trimestral)</SelectItem>
                                <SelectItem value="pro:semiannual">💎 Básico (Semestral)</SelectItem>
                                <SelectItem value="master:monthly">👑 Master (Mensal)</SelectItem>
                                <SelectItem value="master:quarterly">👑 Master (Trimestral)</SelectItem>
                                <SelectItem value="master:semiannual">👑 Master (Semestral)</SelectItem>
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
                          <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-all hover:opacity-80 shadow-sm ${planInfo.color}`}
                              onClick={() => setEditingPlan(tenant.id)}
                              title="Clique para alterar o plano"
                            >
                              <Settings className="h-3 w-3 opacity-60" />
                              <span>{formatPlanLabelWithIcon(tenant.plan, tenant.plan_cycle)}</span>
                            </button>

                            {/* Badge Dinâmico de Dias Restantes no Header da Linha */}
                            {hasPlanExpiration ? (
                              isExpired ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 border border-destructive/30 px-2 py-[2px] text-[11px] font-bold text-destructive animate-pulse" title={`Expirou em ${format(new Date(tenant.plan_expires_at), "dd/MM/yyyy")}`}>
                                  <ShieldOff className="h-3 w-3" /> Expirado
                                </span>
                              ) : daysLeft !== null && daysLeft <= 0 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-[2px] text-[11px] font-bold text-amber-400" title={`Vence hoje: ${format(new Date(tenant.plan_expires_at), "dd/MM/yyyy HH:mm")}`}>
                                  <Clock className="h-3 w-3" /> Vence hoje
                                </span>
                              ) : daysLeft !== null && daysLeft === 1 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-[2px] text-[11px] font-bold text-amber-400" title={`Vence em: ${format(new Date(tenant.plan_expires_at), "dd/MM/yyyy")}`}>
                                  <Clock className="h-3 w-3" /> 1 dia restante
                                </span>
                              ) : daysLeft !== null && daysLeft <= 5 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-[2px] text-[11px] font-bold text-amber-400" title={`Vence em: ${format(new Date(tenant.plan_expires_at), "dd/MM/yyyy")}`}>
                                  <Clock className="h-3 w-3" /> {daysLeft} dias restantes
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-[2px] text-[11px] font-bold text-emerald-400" title={`Vence em: ${format(new Date(tenant.plan_expires_at), "dd/MM/yyyy")}`}>
                                  <CalendarClock className="h-3 w-3" /> {daysLeft} dias restantes
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 border border-border/50 px-2 py-[2px] text-[11px] font-medium text-muted-foreground">
                                <Clock className="h-3 w-3" /> Sem prazo (Free)
                              </span>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2 border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                              onClick={() => {
                                setRenewDialogTenantId(tenant.id);
                                setRenewDays("30");
                                setRenewPlan(tenant.plan || "free");
                              }}
                            >
                              <CalendarClock className="h-3 w-3 mr-1" />
                              + Dias
                            </Button>
                            {tenant.plan !== "free" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={expiringPlan === tenant.id}
                                  >
                                    {expiringPlan === tenant.id ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <ShieldOff className="h-3 w-3 mr-1" />
                                    )}
                                    Expirar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-card border-border" onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Expirar plano agora?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O plano de <strong>{tenant.name}</strong> será marcado como expirado imediatamente.
                                      O cliente precisará efetuar um novo pagamento para reativar o acesso.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleExpirePlan(tenant.id)}
                                    >
                                      Expirar plano
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
                                <TrashIcon size={14} />
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
                        {/* Status do Plano e Contagem de Dias Restantes */}
                        <div className={`rounded-xl border p-4 transition-all shadow-sm ${
                          isExpired
                            ? "bg-destructive/10 border-destructive/30"
                            : daysLeft !== null && daysLeft <= 5
                              ? "bg-amber-500/10 border-amber-500/30"
                              : hasPlanExpiration
                                ? "bg-card/80 border-border/80"
                                : "bg-card/50 border-border/60"
                        }`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 rounded-xl border ${
                                isExpired
                                  ? "bg-destructive/20 border-destructive/40 text-destructive"
                                  : daysLeft !== null && daysLeft <= 5
                                    ? "bg-amber-500/20 border-amber-500/40 text-amber-500"
                                    : "bg-primary/10 border-primary/20 text-primary"
                              }`}>
                                <Crown className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-foreground">Status da Assinatura</span>
                                  <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold ${planInfo.color}`}>
                                    {formatPlanLabelWithIcon(tenant.plan, tenant.plan_cycle)}
                                  </span>
                                  {hasPlanExpiration ? (
                                    isExpired ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/20 border border-destructive/40 px-2.5 py-0.5 text-[11px] font-bold text-destructive">
                                        <ShieldOff className="h-3 w-3" /> Expirado
                                      </span>
                                    ) : daysLeft !== null && daysLeft <= 0 ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-400 animate-pulse">
                                        <AlertTriangle className="h-3 w-3" /> Expira Hoje
                                      </span>
                                    ) : daysLeft !== null && daysLeft <= 5 ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-400">
                                        <Clock className="h-3 w-3" /> Expira em Breve
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                                        <ShieldCheck className="h-3 w-3" /> Ativo
                                      </span>
                                    )
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                      Sem Expiração (Free)
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {hasPlanExpiration
                                    ? (isExpired
                                        ? "O período deste plano encerrou. O acesso do cliente aos recursos está suspenso."
                                        : "Plano ativo com controle de dias restantes e renovação automática via admin.")
                                    : "Plano gratuito sem data limite de expiração."}
                                </p>
                              </div>
                            </div>

                            {/* Ações rápidas do plano */}
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <Button
                                size="sm"
                                className="gradient-pink text-primary-foreground border-none text-xs h-8 shadow-sm hover:opacity-95"
                                onClick={() => {
                                  setRenewDialogTenantId(tenant.id);
                                  setRenewDays("30");
                                  setRenewPlan(tenant.plan || "free");
                                }}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" /> + Dias
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8 border-border hover:bg-muted"
                                onClick={() => setEditingPlan(tenant.id)}
                              >
                                <Settings className="h-3.5 w-3.5 mr-1" /> Mudar Plano
                              </Button>
                            </div>
                          </div>

                          {/* Métricas de Tempo e Validade */}
                          {hasPlanExpiration ? (
                            <div className="mt-3.5 space-y-3.5">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Métrica 1: Dias Restantes */}
                                <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                                  isExpired
                                    ? "bg-destructive/10 border-destructive/30"
                                    : daysLeft !== null && daysLeft <= 5
                                      ? "bg-amber-500/10 border-amber-500/30"
                                      : "bg-emerald-500/10 border-emerald-500/30"
                                }`}>
                                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                                    <span>Dias de Plano Restantes</span>
                                    <Clock className={`h-4 w-4 ${
                                      isExpired
                                        ? "text-destructive"
                                        : daysLeft !== null && daysLeft <= 5
                                          ? "text-amber-500"
                                          : "text-emerald-500"
                                    }`} />
                                  </div>
                                  <div className="flex items-baseline gap-1.5">
                                    {isExpired ? (
                                      <div>
                                        <span className="text-2xl font-black text-destructive">0 dias</span>
                                        <span className="text-[11px] text-destructive/80 font-medium block">
                                          Vencido há {Math.abs(daysLeft || 0)} dias
                                        </span>
                                      </div>
                                    ) : daysLeft !== null && daysLeft <= 0 ? (
                                      <div>
                                        <span className="text-2xl font-black text-amber-500">Expira hoje!</span>
                                        <span className="text-[11px] text-amber-500/80 font-medium block">
                                          Restam ~{Math.max(1, hoursLeft || 1)} horas
                                        </span>
                                      </div>
                                    ) : (
                                      <div>
                                        <span className={`text-3xl font-black tracking-tight ${
                                          daysLeft !== null && daysLeft <= 5 ? "text-amber-400" : "text-emerald-400"
                                        }`}>
                                          {daysLeft}
                                        </span>
                                        <span className="text-xs font-bold text-muted-foreground ml-2">
                                          {daysLeft === 1 ? "dia restante" : "dias restantes"}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Métrica 2: Data de Início */}
                                <div className="p-3.5 rounded-xl border border-border/60 bg-card/60 flex flex-col justify-between">
                                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                                    <span>Data de Início</span>
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <div>
                                    <span className="text-base font-bold text-foreground">
                                      {tenant.plan_started_at
                                        ? format(new Date(tenant.plan_started_at), "dd/MM/yyyy")
                                        : "Não registrado"}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground block">
                                      {tenant.plan_started_at
                                        ? format(new Date(tenant.plan_started_at), "HH:mm")
                                        : "Início do plano"}
                                    </span>
                                  </div>
                                </div>

                                {/* Métrica 3: Vencimento */}
                                <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                                  isExpired
                                    ? "border-destructive/30 bg-destructive/5"
                                    : "border-border/60 bg-card/60"
                                }`}>
                                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                                    <span>Data de Vencimento</span>
                                    <CalendarClock className={`h-4 w-4 ${isExpired ? "text-destructive" : "text-muted-foreground"}`} />
                                  </div>
                                  <div>
                                    <span className={`text-base font-bold ${isExpired ? "text-destructive" : "text-foreground"}`}>
                                      {expiryDate ? format(expiryDate, "dd/MM/yyyy") : "—"}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground block">
                                      {expiryDate ? format(expiryDate, "HH:mm") : "Sem prazo"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Barra de Progresso do Ciclo */}
                              {startDate && expiryDate && (
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5 font-medium">
                                      <Clock className="h-3 w-3" /> Progresso do Período
                                    </span>
                                    <span className="font-semibold text-foreground text-xs">
                                      {isExpired
                                        ? "100% decorrido (Expirado)"
                                        : `${cyclePercent ?? 0}% decorrido (${daysLeft} dias restantes)`}
                                    </span>
                                  </div>
                                  <div className="w-full bg-muted/80 rounded-full h-2 overflow-hidden border border-border/40">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        isExpired
                                          ? "bg-destructive"
                                          : daysLeft !== null && daysLeft <= 5
                                            ? "bg-amber-500"
                                            : "bg-emerald-500"
                                      }`}
                                      style={{ width: `${Math.min(100, Math.max(3, isExpired ? 100 : (cyclePercent ?? 50)))}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span>Início: {format(startDate, "dd/MM/yyyy")}</span>
                                    <span>Vencimento: {format(expiryDate, "dd/MM/yyyy 'às' HH:mm")}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-3.5 p-3 rounded-xl border border-dashed border-border/70 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span>Este cliente está no Plano Gratuito e não possui data limite de expiração.</span>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs h-7 shrink-0 font-medium"
                                onClick={() => {
                                  setRenewDialogTenantId(tenant.id);
                                  setRenewDays("30");
                                  setRenewPlan("pro");
                                }}
                              >
                                Ativar Prazo (30 dias)
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Informações e Vínculo do Discord */}
                        <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/50">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 rounded-lg bg-[#5865F2]/15 text-[#5865F2] border border-[#5865F2]/25">
                                <DiscordIcon className="h-4 w-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="text-sm font-bold text-foreground">Discord do Cliente</h5>
                                  {tenant.owner_discord_id || tenant.owner_discord_username ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                                      <ShieldCheck className="h-3 w-3" /> Vinculado via Bot
                                    </span>
                                  ) : tenant.discord_guild_id ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[11px] font-semibold text-blue-400">
                                      <Server className="h-3 w-3" /> Servidor Conectado
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                                      <AlertTriangle className="h-3 w-3" /> Não Vinculado
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  O bot sincroniza automaticamente o proprietário da loja através do ID do servidor no Discord.
                                </p>
                              </div>
                            </div>

                            {/* Ações do Discord */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {tenant.owner_discord_id && (
                                <a
                                  href={`https://discord.com/users/${tenant.owner_discord_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#5865F2] text-white hover:bg-[#4752c4] transition-colors shadow-sm"
                                >
                                  <DiscordIcon className="h-3.5 w-3.5" /> Abrir Perfil ↗
                                </a>
                              )}
                              {tenant.discord_guild_id && (
                                <a
                                  href={`https://discord.com/channels/${tenant.discord_guild_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
                                >
                                  <Server className="h-3.5 w-3.5 text-[#5865F2]" /> Abrir Servidor ↗
                                </a>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-8 border-border hover:bg-muted"
                                onClick={() => {
                                  setEditingDiscordTenant(tenant);
                                  setDiscordGuildInput(tenant.discord_guild_id || "");
                                  setDiscordOwnerIdInput(tenant.owner_discord_id || "");
                                  setDiscordOwnerUsernameInput(tenant.owner_discord_username || "");
                                }}
                              >
                                <Settings className="h-3 w-3 mr-1" /> Editar Discord
                              </Button>
                            </div>
                          </div>

                          {/* Detalhes dos campos */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                            <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                              <span className="text-muted-foreground block text-[11px] font-medium mb-0.5">Usuário (Tag):</span>
                              {tenant.owner_discord_username ? (
                                <a
                                  href={tenant.owner_discord_id ? `https://discord.com/users/${tenant.owner_discord_id}` : undefined}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-semibold text-primary hover:underline flex items-center gap-1"
                                >
                                  @{tenant.owner_discord_username}
                                  <ExternalLink className="h-3 w-3 opacity-60" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground/60 italic">Não identificado</span>
                              )}
                            </div>

                            <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                              <span className="text-muted-foreground block text-[11px] font-medium mb-0.5">ID do Dono no Discord:</span>
                              {tenant.owner_discord_id ? (
                                <a
                                  href={`https://discord.com/users/${tenant.owner_discord_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                                >
                                  {tenant.owner_discord_id}
                                  <ExternalLink className="h-3 w-3 opacity-60" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground/60 italic">Aguardando bot</span>
                              )}
                            </div>

                            <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                              <span className="text-muted-foreground block text-[11px] font-medium mb-0.5">ID da Guild (Servidor):</span>
                              {tenant.discord_guild_id ? (
                                <a
                                  href={`https://discord.com/channels/${tenant.discord_guild_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                                >
                                  {tenant.discord_guild_id}
                                  <ExternalLink className="h-3 w-3 opacity-60" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground/60 italic">Sem servidor</span>
                              )}
                            </div>

                            <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-muted-foreground text-[11px] font-medium">IP de Registro:</span>
                                {tenant.registration_ip && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-muted-foreground hover:text-cyan-400 hover:bg-cyan-500/10"
                                    title="Copiar IP"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(tenant.registration_ip);
                                      toast({ title: "IP copiado! 📋", description: tenant.registration_ip });
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              {tenant.registration_ip ? (
                                <div
                                  onClick={() => {
                                    navigator.clipboard.writeText(tenant.registration_ip);
                                    toast({ title: "IP copiado! 📋", description: tenant.registration_ip });
                                  }}
                                  className="font-mono font-semibold text-cyan-400 flex items-center gap-1 cursor-pointer hover:underline"
                                  title="Clique para copiar o IP"
                                >
                                  <Globe className="h-3 w-3 text-cyan-400 shrink-0" />
                                  {tenant.registration_ip}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/60 italic">Não registrado</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <h4 className="text-sm font-semibold text-foreground">Tokens de Acesso</h4>
                          {(() => {
                            const activeTokens = tenantTokens.filter(t => !t.revoked);
                            const hasActiveToken = activeTokens.length > 0;
                            return (
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
                              <Button size="sm" className="gradient-pink text-primary-foreground border-none hover:opacity-90" disabled={hasActiveToken} title={hasActiveToken ? "Este cliente já possui um token ativo" : undefined}>
                                <Key className="mr-1 h-3 w-3" /> {hasActiveToken ? "Token já gerado" : "Gerar Token"}
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
                            );
                          })()}
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
                                        <TrashIcon size={14} />
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

      <Dialog open={!!renewDialogTenantId} onOpenChange={(open) => { if (!open) setRenewDialogTenantId(null); }}>
        <DialogContent className="bg-card border-border max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Adicionar Dias</DialogTitle>
            <DialogDescription className="text-sm">
              {renewDialogTenantId && (() => {
                const t = tenants.find(x => x.id === renewDialogTenantId);
                return t ? `Cliente: ${t.name} (${(t.plan || "free").toUpperCase()})` : "";
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Plan selector */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Plano</Label>
              <div className="flex flex-wrap gap-2">
                {PLANS.map(p => (
                  <Button
                    key={p.value}
                    size="sm"
                    variant={renewPlan === p.value ? "default" : "outline"}
                    className={`text-xs h-8 px-3 ${renewPlan === p.value ? "gradient-pink text-primary-foreground border-none" : ""}`}
                    onClick={() => setRenewPlan(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Days input */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Quantidade de dias</Label>
              <Input
                type="number"
                min="1"
                max="3650"
                value={renewDays}
                onChange={(e) => setRenewDays(e.target.value)}
                placeholder="Ex: 30"
                className="bg-muted border-none"
              />
              {/* Quick picks */}
              <div className="flex flex-wrap gap-2">
                {[7, 15, 30, 60, 90, 180, 365].map(d => (
                  <Button
                    key={d}
                    size="sm"
                    variant={renewDays === String(d) ? "default" : "outline"}
                    className={`text-xs h-7 px-2.5 ${renewDays === String(d) ? "gradient-pink text-primary-foreground border-none" : ""}`}
                    onClick={() => setRenewDays(String(d))}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border mt-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancelar</Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={() => {
                const days = parseInt(renewDays);
                if (!days || days < 1 || !renewDialogTenantId) return;
                handleRenewPlan(renewDialogTenantId, days);
              }}
              disabled={savingPlan || !renewDays || parseInt(renewDays) < 1}
              className="gradient-pink text-primary-foreground border-none hover:opacity-90 gap-2"
            >
              {savingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Adicionar +{renewDays || 0} dias
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para Editar Discord do Cliente */}
      <Dialog
        open={Boolean(editingDiscordTenant)}
        onOpenChange={(open) => {
          if (!open) setEditingDiscordTenant(null);
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DiscordIcon className="h-5 w-5 text-[#5865F2]" />
              Editar Discord - {editingDiscordTenant?.name}
            </DialogTitle>
            <DialogDescription>
              Vincule ou altere o ID do Servidor (Guild) e o ID de usuário do Discord para este cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Discord Guild ID (ID do Servidor)</Label>
              <Input
                placeholder="Ex: 1484105905988440127"
                value={discordGuildInput}
                onChange={(e) => setDiscordGuildInput(e.target.value)}
                className="bg-muted border-border font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                O bot utiliza este ID para se conectar aos canais e tickets do cliente.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ID do Proprietário no Discord (User ID)</Label>
              <Input
                placeholder="Ex: 868872675110551592"
                value={discordOwnerIdInput}
                onChange={(e) => setDiscordOwnerIdInput(e.target.value)}
                className="bg-muted border-border font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Usado para abrir o perfil/DM diretamente no Discord via link.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome de Usuário (Tag do Discord)</Label>
              <Input
                placeholder="Ex: lucasdev.br"
                value={discordOwnerUsernameInput}
                onChange={(e) => setDiscordOwnerUsernameInput(e.target.value)}
                className="bg-muted border-border text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setEditingDiscordTenant(null)} disabled={savingDiscord}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveDiscord}
              disabled={savingDiscord}
              className="gradient-pink text-primary-foreground border-none"
            >
              {savingDiscord ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminClientsPage;
