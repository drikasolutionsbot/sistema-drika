import { useState, useEffect, useCallback } from "react";
import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { useAdmin } from "@/contexts/AdminContext";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, CreditCard, Users, LogOut, Headphones, Globe, Bell, Crown, UserPlus, Inbox, CheckCircle, BarChart3, ClipboardList, Shield, Menu, BookOpen, Store } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Pagamentos", icon: CreditCard, path: "/admin/pagamentos" },
  { label: "Clientes", icon: Users, path: "/admin/clientes" },
  { label: "Suporte", icon: Headphones, path: "/admin/suporte" },
  { label: "Landing Page", icon: Globe, path: "/admin/landing" },
  { label: "Analytics", icon: BarChart3, path: "/admin/analytics" },
  { label: "Logs", icon: ClipboardList, path: "/admin/logs" },
  { label: "Permissões", icon: Shield, path: "/admin/permissoes" },
  { label: "Tutoriais", icon: BookOpen, path: "/admin/tutoriais" },
  { label: "Market Clientes", icon: Store, path: "/admin/marketplace" },
  { label: "Afiliados", icon: UserPlus, path: "/admin/afiliados" },
];

interface AdminNotif {
  id: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  type: "pro_activated" | "new_tenant" | "payment";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

const SidebarContent = ({ location, onNavigate }: { location: ReturnType<typeof useLocation>; onNavigate?: () => void }) => {
  const { signOut } = useAuth();

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-3">
        <img src={logo} alt="Admin" className="h-9 w-9 object-contain" />
        <div className="flex flex-col">
          <span className="font-display text-lg font-bold leading-tight">
            <span className="text-gradient-pink">ADMIN</span>{" "}
            <span className="text-foreground">PANEL</span>
          </span>
          <span className="text-[10px] text-muted-foreground">Super Admin</span>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={async () => {
            sessionStorage.removeItem("token_session");
            try { await signOut(); } catch (_) {}
            window.location.href = "/login";
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
};

export const AdminLayout = () => {
  const { isSuperAdmin, loading } = useAdmin();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotif[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("admin_read_notif_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const fetchNotifications = useCallback(async () => {
    const { data: payments } = await (supabase as any)
      .from("subscription_payments")
      .select("id, tenant_id, plan, status, amount_cents, paid_at, created_at, tenants:tenant_id(name)")
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: tenants } = await (supabase as any)
      .from("tenants")
      .select("id, name, plan, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    const notifs: AdminNotif[] = [];

    for (const p of payments || []) {
      const tenantName = p.tenants?.name || "Tenant";
      if (p.status === "paid") {
        notifs.push({
          id: `pay-${p.id}`,
          title: "🎉 Plano Pro ativado",
          desc: `${tenantName} — R$ ${(p.amount_cents / 100).toFixed(2)}`,
          time: timeAgo(p.paid_at || p.created_at),
          read: readIds.has(`pay-${p.id}`),
          type: "pro_activated",
        });
      } else if (p.status === "pending") {
        notifs.push({
          id: `pay-${p.id}`,
          title: "⏳ Pagamento pendente",
          desc: `${tenantName} — R$ ${(p.amount_cents / 100).toFixed(2)}`,
          time: timeAgo(p.created_at),
          read: readIds.has(`pay-${p.id}`),
          type: "payment",
        });
      }
    }

    for (const t of tenants || []) {
      notifs.push({
        id: `tenant-${t.id}`,
        title: "👤 Nova loja criada",
        desc: `${t.name} — plano ${t.plan || "free"}`,
        time: timeAgo(t.created_at),
        read: readIds.has(`tenant-${t.id}`),
        type: "new_tenant",
      });
    }

    setNotifications(notifs.slice(0, 30));
  }, [readIds]);

  useEffect(() => {
    if (isSuperAdmin) fetchNotifications();
  }, [isSuperAdmin, fetchNotifications]);

  useEffect(() => {
    if (!isSuperAdmin) return;

    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "subscription_payments" },
        (payload: any) => {
          const row = payload.new;
          if (row?.status === "paid") {
            toast.success("🎉 Plano Pro ativado!", { description: `Tenant ${row.tenant_id}` });
          }
          fetchNotifications();
        }
      )
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "tenants" },
        (payload: any) => {
          const row = payload.new;
          toast.info(`👤 Nova loja: ${row.name}`, { description: `Plano: ${row.plan || "free"}` });
          fetchNotifications();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isSuperAdmin, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadIds(allIds);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    localStorage.setItem("admin_read_notif_ids", JSON.stringify([...allIds]));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isSuperAdmin) return <Navigate to="/admin/login" replace />;

  const notifIcon = (type: AdminNotif["type"]) => {
    if (type === "pro_activated") return <Crown className="h-4 w-4 text-primary" />;
    if (type === "new_tenant") return <UserPlus className="h-4 w-4 text-emerald-400" />;
    return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar">
        <SidebarContent location={location} />
      </aside>

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 border-r-0 [&>button]:hidden">
          <SidebarContent location={location} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Admin TopBar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6 gap-3">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
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
                <h4 className="text-sm font-semibold">Notificações Admin</h4>
                {unreadCount > 0 ? (
                  <button onClick={markAllRead} className="text-xs text-primary hover:underline">Marcar como lidas</button>
                ) : (
                  <span className="text-xs text-muted-foreground">Tudo lido</span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Inbox className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma notificação</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <Link
                      key={n.id}
                      to={n.type === "new_tenant" ? "/admin/clientes" : "/admin/pagamentos"}
                      onClick={() => setNotifOpen(false)}
                      className={`block px-4 py-3 border-b border-border last:border-0 hover:bg-accent/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 shrink-0">{notifIcon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{n.title}</p>
                            {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{n.desc}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
