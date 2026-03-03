import { useState, useEffect, useRef, useCallback } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/dashboard/StatCard";
import { ECloudCharts } from "@/components/ecloud/ECloudCharts";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, getStatusLabel } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Cloud,
  Activity,
  Users,
  Hash,
  RefreshCw,
  Server,
  Crown,
  Clock,
  Webhook,
  ShoppingCart,
  Ticket,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
  member_count: number;
  presence_count: number;
}

interface RecentLog {
  id: string;
  type: "webhook" | "order" | "ticket";
  title: string;
  description: string;
  status: "success" | "warning" | "error";
  created_at: string;
  orderStatus?: string;
}

const PLAN_FEATURES: Record<string, { label: string; limits: string }> = {
  free: { label: "Free", limits: "Recursos básicos" },
  starter: { label: "Starter", limits: "Até 500 membros" },
  pro: { label: "Pro", limits: "Membros ilimitados + Prioridade" },
  business: { label: "Business", limits: "API + Suporte VIP" },
};

const ECloudPage = () => {
  const { tenant, tenantId } = useTenant();
  const [guildInfo, setGuildInfo] = useState<GuildInfo | null>(null);
  const [botOnline, setBotOnline] = useState<boolean | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const prevBotOnline = useRef<boolean | null>(null);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, []);

  // Track status changes and notify
  useEffect(() => {
    if (prevBotOnline.current === true && botOnline === false) {
      toast.error("⚠️ Bot Offline", {
        description: "O Drika Bot ficou offline! Verifique a hospedagem.",
        duration: 10000,
      });
    } else if (prevBotOnline.current === false && botOnline === true) {
      toast.success("✅ Bot Online", {
        description: "O Drika Bot voltou a ficar online!",
        duration: 5000,
      });
    }
    prevBotOnline.current = botOnline;
  }, [botOnline]);

  const fetchData = async () => {
    if (!tenant?.discord_guild_id || !tenantId) return;

    try {
      const { data: guild, error: guildErr } = await supabase.functions.invoke("discord-guild-info", {
        body: { guild_id: tenant.discord_guild_id },
      });

      if (!guildErr && guild && !guild.error) {
        setGuildInfo(guild);
        setBotOnline(true);
      } else {
        setBotOnline(false);
      }

      const [webhooksRes, ordersRes, ticketsRes] = await Promise.all([
        supabase
          .from("webhook_logs")
          .select("id, provider_key, event_type, status, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("orders")
          .select("id, product_name, status, discord_username, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("tickets")
          .select("id, product_name, status, discord_username, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const logs: RecentLog[] = [];

      webhooksRes.data?.forEach((w) =>
        logs.push({
          id: w.id,
          type: "webhook",
          title: `Webhook ${w.provider_key}`,
          description: w.event_type || "Notificação recebida",
          status: w.status === "processed" ? "success" : w.status === "ignored" ? "warning" : "error",
          created_at: w.created_at,
        })
      );

      ordersRes.data?.forEach((o) =>
        logs.push({
          id: o.id,
          type: "order",
          title: o.product_name,
          description: `${o.discord_username || "Usuário"}`,
          status: o.status === "paid" || o.status === "delivered" ? "success" : o.status === "canceled" ? "error" : "warning",
          created_at: o.created_at,
          orderStatus: o.status,
        })
      );

      ticketsRes.data?.forEach((t) =>
        logs.push({
          id: t.id,
          type: "ticket",
          title: `Ticket ${t.product_name || ""}`,
          description: `${t.discord_username || "Usuário"} — ${t.status}`,
          status: t.status === "closed" || t.status === "delivered" ? "success" : "warning",
          created_at: t.created_at,
        })
      );

      logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentLogs(logs.slice(0, 10));
    } catch (err) {
      console.error("eCloud fetch error:", err);
      setBotOnline(false);
    } finally {
      setLoading(false);
      setLastCheck(new Date());
    }
  };

  useEffect(() => {
    fetchData();
    // Poll bot status every 30s (Discord API can't use Realtime)
    const checkBot = async () => {
      if (!tenant?.discord_guild_id) return;
      try {
        const { data: guild, error } = await supabase.functions.invoke("discord-guild-info", {
          body: { guild_id: tenant.discord_guild_id },
        });
        if (!error && guild && !guild.error) {
          setGuildInfo(guild);
          setBotOnline(true);
        } else {
          setBotOnline(false);
        }
      } catch {
        setBotOnline(false);
      }
      setLastCheck(new Date());
    };
    const botInterval = setInterval(checkBot, 30000);
    return () => clearInterval(botInterval);
  }, [tenant?.discord_guild_id, tenantId]);

  // Realtime subscriptions for orders, tickets, webhook_logs
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`ecloud-realtime-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const row = payload.new as any;
          if (payload.eventType === "INSERT") {
            playNotificationSound();
            toast.info("🛒 Nova venda", { description: `${row.product_name} — ${row.discord_username || "Usuário"}` });
          } else if (payload.eventType === "UPDATE" && (row.status === "paid" || row.status === "delivered")) {
            playNotificationSound();
            toast.success("💰 Pagamento confirmado", { description: row.product_name });
          }
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const row = payload.new as any;
          toast.info("🎫 Novo ticket", { description: `${row.discord_username || "Usuário"} — ${row.product_name || "Suporte"}` });
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "webhook_logs", filter: `tenant_id=eq.${tenantId}` },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const plan = PLAN_FEATURES[tenant?.plan || "free"] || PLAN_FEATURES.free;

  const statusIcon = (status: string) => {
    if (status === "success") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    if (status === "warning") return <AlertCircle className="h-4 w-4 text-yellow-400" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const logIcon = (type: string) => {
    if (type === "webhook") return <Webhook className="h-4 w-4 text-muted-foreground" />;
    if (type === "order") return <ShoppingCart className="h-4 w-4 text-muted-foreground" />;
    return <Ticket className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cloud className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">eCloud</h1>
          {botOnline !== null && (
            <Badge variant={botOnline ? "default" : "destructive"} className="gap-1.5">
              <span className={`h-2 w-2 rounded-full ${botOnline ? "bg-emerald-400 animate-pulse" : "bg-destructive-foreground"}`} />
              {botOnline ? "Online" : "Offline"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 hidden sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">Realtime</span>
          </div>
          {lastCheck && (
            <span className="text-xs text-muted-foreground hidden md:inline">
              Última verificação: {lastCheck.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total de Membros"
            value={guildInfo?.member_count?.toLocaleString("pt-BR") || "—"}
            icon={Users}
            change={guildInfo ? `${guildInfo.presence_count} online` : undefined}
            changeType="positive"
          />
          <StatCard
            title="Status do Bot"
            value={botOnline ? "Ativo" : "Inativo"}
            icon={botOnline ? Wifi : WifiOff}
            change={botOnline ? "Respondendo normalmente" : "Sem resposta"}
            changeType={botOnline ? "positive" : "negative"}
          />
          <StatCard
            title="Servidor"
            value={guildInfo?.name || tenant?.name || "—"}
            icon={Server}
            change={tenant?.discord_guild_id ? `ID: ${tenant.discord_guild_id}` : "Não vinculado"}
            changeType="neutral"
          />
          <StatCard
            title="Plano Atual"
            value={plan.label}
            icon={Crown}
            change={plan.limits}
            changeType="neutral"
          />
        </div>
      )}

      {/* Charts */}
      {tenantId && <ECloudCharts tenantId={tenantId} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Logs */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Atividade Recente</h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : recentLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Nenhuma atividade recente</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0">{logIcon(log.type)}</div>
                   <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{log.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{log.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {log.orderStatus ? (
                      <StatusBadge status={log.orderStatus} />
                    ) : (
                      statusIcon(log.status)
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Server Info */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold text-lg">Drika Bot</h2>
          </div>

          {guildInfo ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/30">
                {guildInfo.icon ? (
                  <img src={guildInfo.icon} alt="" className="h-12 w-12 rounded-full" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Hash className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{guildInfo.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {guildInfo.member_count.toLocaleString("pt-BR")} membros · {guildInfo.presence_count} online
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={botOnline ? "default" : "destructive"}>
                    {botOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm text-muted-foreground">Prefixo</span>
                  <span className="text-sm font-mono font-medium">{(tenant as any)?.bot_prefix || "d!"}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm text-muted-foreground">Plano</span>
                  <span className="text-sm font-medium">{plan.label}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <span className="text-sm text-muted-foreground">Guild ID</span>
                  <span className="text-xs font-mono text-muted-foreground">{tenant?.discord_guild_id || "—"}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {loading ? "Carregando..." : "Servidor não vinculado"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ECloudPage;
