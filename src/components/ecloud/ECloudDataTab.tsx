import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Download, Search, Users, ShoppingCart, Package, ShieldCheck,
  Loader2, Database, Clock, FileJson, FileSpreadsheet, RefreshCw, HardDrive,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BackupRecord {
  id: string;
  backup_type: string;
  status: string;
  members_count: number;
  verified_count: number;
  orders_count: number;
  products_count: number;
  started_at: string;
  completed_at: string | null;
}

type DataTab = "membros" | "verificados" | "pedidos" | "produtos";

interface ECloudDataTabProps {
  tenantId: string;
}

export const ECloudDataTab = ({ tenantId }: ECloudDataTabProps) => {
  const { tenant } = useTenant();
  const [activeTab, setActiveTab] = useState<DataTab>("membros");
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [runningBackup, setRunningBackup] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportData, setExportData] = useState<any>(null);
  const [loadingExport, setLoadingExport] = useState(false);
  const [search, setSearch] = useState("");

  const fetchBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-backup", {
        body: { action: "list", tenant_id: tenantId },
      });
      if (error) throw error;
      setBackups(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingBackups(false);
    }
  }, [tenantId]);

  const fetchLiveData = useCallback(async () => {
    setLoadingExport(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-backup", {
        body: { action: "export", tenant_id: tenantId },
      });
      if (error) throw error;
      setExportData(data);
    } catch (e: any) {
      toast.error("Erro ao carregar dados: " + e.message);
    } finally {
      setLoadingExport(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchBackups();
    fetchLiveData();
  }, [fetchBackups, fetchLiveData]);

  const handleRunBackup = async () => {
    setRunningBackup(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-backup", {
        body: { action: "run", tenant_id: tenantId },
      });
      if (error) throw error;
      toast.success(`Backup concluído! ${data.members} membros, ${data.orders} pedidos salvos.`);
      fetchBackups();
    } catch (e: any) {
      toast.error("Erro no backup: " + e.message);
    } finally {
      setRunningBackup(false);
    }
  };

  const handleExportJSON = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecloud-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportado como JSON!");
  };

  const handleExportCSV = (tab: DataTab) => {
    if (!exportData) return;
    let rows: any[] = [];
    let headers: string[] = [];

    if (tab === "membros") {
      headers = ["ID", "Username", "Nickname", "Entrou em", "Cargos"];
      rows = (exportData.members || []).map((m: any) => [
        m.id, m.username, m.nickname || "", m.joined_at || "", (m.roles || []).join(", "),
      ]);
    } else if (tab === "verificados") {
      headers = ["Discord ID", "Username", "Verificado em"];
      rows = (exportData.verified || []).map((v: any) => [
        v.discord_user_id, v.discord_username || "", v.verified_at,
      ]);
    } else if (tab === "pedidos") {
      headers = ["#", "Produto", "Usuário", "Status", "Valor (R$)", "Data"];
      rows = (exportData.orders || []).map((o: any) => [
        o.order_number, o.product_name, o.discord_username || "", o.status,
        (o.total_cents / 100).toFixed(2), o.created_at,
      ]);
    } else if (tab === "produtos") {
      headers = ["Nome", "Preço (R$)", "Estoque", "Ativo", "Tipo"];
      rows = (exportData.products || []).map((p: any) => [
        p.name, (p.price_cents / 100).toFixed(2), p.stock ?? "∞", p.active ? "Sim" : "Não", p.type,
      ]);
    }

    const csv = [headers.join(","), ...rows.map((r: any[]) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ecloud-${tab}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${tab} exportado como CSV!`);
  };

  const filteredData = (items: any[], keys: string[]) => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((item) => keys.some((k) => String(item[k] || "").toLowerCase().includes(q)));
  };

  const tabs: { key: DataTab; label: string; icon: any; count: number }[] = [
    { key: "membros", label: "Membros", icon: Users, count: exportData?.members?.length || 0 },
    { key: "verificados", label: "Verificados", icon: ShieldCheck, count: exportData?.verified?.length || 0 },
    { key: "pedidos", label: "Pedidos", icon: ShoppingCart, count: exportData?.orders?.length || 0 },
    { key: "produtos", label: "Produtos", icon: Package, count: exportData?.products?.length || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`p-4 rounded-xl border text-left transition-all ${
              activeTab === tab.key
                ? "border-primary/50 bg-primary/5 shadow-sm"
                : "border-border bg-sidebar hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <tab.icon className={`h-4 w-4 ${activeTab === tab.key ? "text-primary" : "text-muted-foreground"}`} />
              {loadingExport ? (
                <Skeleton className="h-4 w-8" />
              ) : (
                <span className="text-lg font-bold">{tab.count.toLocaleString("pt-BR")}</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar..." className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchLiveData()} disabled={loadingExport} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loadingExport ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportCSV(activeTab)} disabled={!exportData} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJSON} disabled={!exportData} className="gap-2">
            <FileJson className="h-4 w-4" /> JSON
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <Card className="bg-sidebar border-border/50 overflow-hidden">
        {loadingExport ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === "membros" ? (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-xs">Username</TableHead>
                <TableHead className="text-xs">Nickname</TableHead>
                <TableHead className="text-xs">Cargos</TableHead>
                <TableHead className="text-xs">Entrou em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData(exportData?.members || [], ["username", "nickname", "id"]).slice(0, 100).map((m: any) => (
                <TableRow key={m.id} className="border-border/50">
                  <TableCell className="font-medium text-sm">@{m.username}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.nickname || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{(m.roles || []).length} cargos</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.joined_at ? new Date(m.joined_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {(exportData?.members || []).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum membro encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        ) : activeTab === "verificados" ? (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-xs">Username</TableHead>
                <TableHead className="text-xs">Discord ID</TableHead>
                <TableHead className="text-xs">Verificado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData(exportData?.verified || [], ["discord_username", "discord_user_id"]).slice(0, 100).map((v: any, i: number) => (
                <TableRow key={i} className="border-border/50">
                  <TableCell className="font-medium text-sm">@{v.discord_username || v.discord_user_id}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{v.discord_user_id}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(v.verified_at), { addSuffix: true, locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))}
              {(exportData?.verified || []).length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum membro verificado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        ) : activeTab === "pedidos" ? (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-xs">#</TableHead>
                <TableHead className="text-xs">Produto</TableHead>
                <TableHead className="text-xs">Usuário</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Valor</TableHead>
                <TableHead className="text-xs">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData(exportData?.orders || [], ["product_name", "discord_username"]).slice(0, 100).map((o: any) => (
                <TableRow key={o.order_number} className="border-border/50">
                  <TableCell className="text-xs font-mono">#{o.order_number}</TableCell>
                  <TableCell className="font-medium text-sm">{o.product_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.discord_username || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={o.status === "delivered" || o.status === "paid" ? "default" : "secondary"} className="text-[10px]">
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-mono">R$ {(o.total_cents / 100).toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
              {(exportData?.orders || []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum pedido</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Preço</TableHead>
                <TableHead className="text-xs">Estoque</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData(exportData?.products || [], ["name"]).map((p: any) => (
                <TableRow key={p.name} className="border-border/50">
                  <TableCell className="font-medium text-sm">{p.name}</TableCell>
                  <TableCell className="text-sm font-mono">R$ {(p.price_cents / 100).toFixed(2)}</TableCell>
                  <TableCell className="text-sm">{p.stock ?? "∞"}</TableCell>
                  <TableCell>
                    <Badge variant={p.active ? "default" : "secondary"} className="text-[10px]">
                      {p.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.type}</TableCell>
                </TableRow>
              ))}
              {(exportData?.products || []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum produto</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Backup Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-base">Backups</h3>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRunBackup} disabled={runningBackup} size="sm" className="gap-2">
              {runningBackup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {runningBackup ? "Salvando..." : "Fazer Backup Agora"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Backups automáticos são executados diariamente às 00:00. Você também pode executar manualmente.
        </p>

        {loadingBackups ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : backups.length === 0 ? (
          <Card className="p-6 bg-sidebar border-border/50 text-center">
            <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum backup ainda. Clique em "Fazer Backup Agora" para começar.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <Card key={b.id} className="p-4 bg-sidebar border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    b.status === "completed" ? "bg-emerald-500/10" : b.status === "running" ? "bg-yellow-500/10" : "bg-destructive/10"
                  }`}>
                    {b.status === "running" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                    ) : b.status === "completed" ? (
                      <Database className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Database className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Backup {b.backup_type === "daily" ? "Automático" : "Manual"}
                      </span>
                      <Badge variant={b.status === "completed" ? "default" : b.status === "running" ? "secondary" : "destructive"} className="text-[10px]">
                        {b.status === "completed" ? "Concluído" : b.status === "running" ? "Executando" : "Falhou"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {b.members_count}</span>
                      <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> {b.verified_count}</span>
                      <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> {b.orders_count}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(b.started_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
                {b.status === "completed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={async () => {
                      setExporting(true);
                      try {
                        const { data } = await supabase.functions.invoke("run-backup", {
                          body: { action: "get", backup_id: b.id },
                        });
                        if (data?.data) {
                          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `backup-${new Date(b.started_at).toISOString().split("T")[0]}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success("Backup exportado!");
                        }
                      } catch (e: any) {
                        toast.error("Erro: " + e.message);
                      } finally {
                        setExporting(false);
                      }
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
