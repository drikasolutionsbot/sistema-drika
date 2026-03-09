import { useState, useEffect, useCallback } from "react";
import { Bell, Menu, Search, LogOut, User, Settings, ChevronDown, QrCode, Zap, CheckCircle, AlertCircle, Inbox, Wallet, Crown, Clock } from "lucide-react";
import { useTheme } from "next-themes";
import { differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import { WalletBadge } from "@/components/wallet/WalletBadge";
import ThemeToggle from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface TopBarProps {
  onToggleSidebar: () => void;
}

interface Notification {
  id: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  type: "payment" | "info";
}

const providerLabels: Record<string, string> = {
  mercadopago: "Mercado Pago",
  pushinpay: "PushinPay",
  efi: "Efí",
  mistic_pay: "Mistic Pay",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

const PlanBadge = ({ tenant }: { tenant: { plan: string; plan_expires_at: string | null; plan_started_at: string | null } }) => {
  const isPro = tenant.plan === "pro";
  const planLabel = isPro ? "Pro" : "Free (Teste)";
  
  let timeLeft = "";
  let expiresLabel = "";
  let isExpiring = false;
  let isExpired = false;
  
  if (tenant.plan_expires_at) {
    const now = new Date();
    const expires = new Date(tenant.plan_expires_at);
    const diffMs = expires.getTime() - now.getTime();

    // Format expiration date
    expiresLabel = expires.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    
    if (diffMs <= 0) {
      timeLeft = "Expirado";
      isExpiring = true;
      isExpired = true;
    } else {
      const days = differenceInDays(expires, now);
      const hours = differenceInHours(expires, now) % 24;
      const mins = differenceInMinutes(expires, now) % 60;
      
      if (days > 0) {
        timeLeft = `${days}d ${hours}h restantes`;
      } else if (hours > 0) {
        timeLeft = `${hours}h ${mins}m restantes`;
      } else {
        timeLeft = `${mins}m restantes`;
      }
      isExpiring = days < 2;
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium border transition-colors cursor-pointer outline-none ${
          isExpired
            ? "bg-destructive/15 border-destructive/30 text-destructive animate-pulse"
            : isPro
              ? "bg-primary/10 border-primary/20 text-primary"
              : isExpiring
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : "bg-muted border-border text-muted-foreground"
        }`}>
          <Crown className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isExpired ? "text-destructive" : isPro ? "text-primary" : isExpiring ? "text-destructive" : "text-muted-foreground"}`} />
          <span className="font-semibold">{isPro ? "Pro" : "Free"}</span>
          {timeLeft && (
            <>
              <span className="text-muted-foreground/50 hidden sm:inline">•</span>
              <span className="hidden sm:flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeLeft}
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0 bg-card border-border">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Crown className={`h-5 w-5 ${isPro ? "text-primary" : "text-muted-foreground"}`} />
            <h4 className="text-sm font-bold">Plano {planLabel}</h4>
          </div>
          
          {tenant.plan_started_at && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Início</span>
              <span className="font-medium">{new Date(tenant.plan_started_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
            </div>
          )}
          
          {expiresLabel && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Expira em</span>
              <span className={`font-semibold ${isExpired ? "text-destructive" : isExpiring ? "text-destructive" : ""}`}>{expiresLabel}</span>
            </div>
          )}

          {timeLeft && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Tempo restante</span>
              <span className={`font-semibold ${isExpired || isExpiring ? "text-destructive" : "text-primary"}`}>{timeLeft}</span>
            </div>
          )}

          <div className="border-t border-border pt-3">
            {isExpired ? (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Acesso bloqueado
                </p>
                <p className="text-xs text-destructive/70 mt-1">
                  Todos os recursos estão suspensos. Assine o plano Pro para liberar o acesso novamente.
                </p>
              </div>
            ) : isExpiring ? (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-xs text-destructive/80">
                  ⚠️ Seu plano está prestes a expirar. Após o vencimento, o painel será <strong>bloqueado automaticamente</strong> até a renovação.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                <p className="text-xs text-muted-foreground">
                  ✅ Seu plano está ativo. Ao expirar, o acesso será bloqueado até que o plano Pro seja renovado.
                </p>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const TopBar = ({ onToggleSidebar }: TopBarProps) => {
  const { user, signOut } = useAuth();
  const { tenant, tenantId } = useTenant();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const tokenSession = sessionStorage.getItem("token_session");
  const tokenData = tokenSession ? JSON.parse(tokenSession) : null;
  const avatar = user?.user_metadata?.avatar_url;
  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || tokenData?.tenant_name || "Usuário";
  const email = user?.email || "token@acesso";

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("read_notif_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  // Fetch recent webhook logs as notifications
  const fetchNotifications = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await (supabase as any)
      .from("webhook_logs")
      .select("id, provider_key, event_type, status, created_at, result")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      const notifs: Notification[] = data.map((log: any) => ({
        id: log.id,
        title: log.status === "processed"
          ? "Pagamento confirmado"
          : log.status === "ignored"
            ? "Webhook ignorado"
            : "Webhook recebido",
        desc: `${providerLabels[log.provider_key] || log.provider_key} — ${log.event_type || "evento"}`,
        time: timeAgo(log.created_at),
        read: readIds.has(log.id),
        type: log.status === "processed" ? "payment" : "info",
      }));
      setNotifications(notifs);
    }
  }, [tenantId, readIds]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel("webhook-notifications")
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "webhook_logs",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: any) => {
          const log = payload.new;
          const newNotif: Notification = {
            id: log.id,
            title: log.status === "processed" ? "Pagamento confirmado" : "Webhook recebido",
            desc: `${providerLabels[log.provider_key] || log.provider_key} — ${log.event_type || "evento"}`,
            time: "agora",
            read: false,
            type: log.status === "processed" ? "payment" : "info",
          };
          setNotifications((prev) => [newNotif, ...prev].slice(0, 30));

          // Show toast for processed payments
          if (log.status === "processed") {
            toast({
              title: "💰 Pagamento confirmado!",
              description: `Via ${providerLabels[log.provider_key] || log.provider_key}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    localStorage.setItem("read_notif_ids", JSON.stringify([...allIds]));
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("token_session");
    try { await signOut(); } catch (_) {}
    window.location.href = "/login";
  };

  return (
    <header className="flex h-14 md:h-16 items-center justify-between border-b border-border bg-card px-3 md:px-6">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="lg:hidden shrink-0">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." className="w-64 bg-muted pl-9 border-none focus-visible:ring-primary" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 md:gap-3">
        {/* Plan Badge */}
        {tenant && <PlanBadge tenant={tenant} />}
        {/* Wallet */}
        <WalletBadge />
        {/* Theme Toggle */}
        <ThemeToggle
          checked={theme === "dark"}
          onChange={(checked) => setTheme(checked ? "dark" : "light")}
        />
        {/* Notifications */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 bg-card border-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h4 className="text-sm font-semibold">Notificações</h4>
              {unreadCount > 0 ? (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                  Marcar todas como lidas
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">Tudo lido</span>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Inbox className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma notificação</p>
                  <p className="text-xs mt-1">Webhooks processados aparecerão aqui</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-border last:border-0 hover:bg-accent/50 transition-colors cursor-pointer ${!n.read ? "bg-primary/5" : ""}`}
                    onClick={() => navigate("/payments")}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">
                        {n.type === "payment" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{n.title}</p>
                          {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{n.desc}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/50 transition-colors outline-none">
              {avatar ? (
                <img src={avatar} alt={name} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                  {name[0].toUpperCase()}
                </div>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-3">
                {avatar ? (
                  <img src={avatar} alt={name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                    {name[0].toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col">
                  <p className="text-sm font-medium truncate max-w-[140px]">{name}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[140px]">{email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings?tab=wallet")} className="cursor-pointer">
              <Wallet className="mr-2 h-4 w-4" />
              Carteira
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings?tab=pix")} className="cursor-pointer">
              <QrCode className="mr-2 h-4 w-4" />
              Configurar PIX
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
