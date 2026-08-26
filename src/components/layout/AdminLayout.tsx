import { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { useAdmin } from "@/contexts/AdminContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, CreditCard, Users, LogOut, Headphones, Globe, Bell,
  Crown, UserPlus, Inbox, CheckCircle, BarChart3, ClipboardList, Shield,
  Menu, BookOpen, Store, GripVertical, Settings2, RotateCcw, Bot,
  ChevronRight, Zap
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "next-themes";
import ThemeToggle from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: string;
  section?: string;
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",          icon: LayoutDashboard, path: "/admin",                   section: "Principal" },
  { label: "Analytics",          icon: BarChart3,       path: "/admin/analytics",         section: "Principal" },
  { label: "Clientes",           icon: Users,           path: "/admin/clientes",          section: "Gestão" },
  { label: "Pagamentos",         icon: CreditCard,      path: "/admin/pagamentos",        section: "Gestão" },
  { label: "Suporte",            icon: Headphones,      path: "/admin/suporte",           section: "Gestão" },
  { label: "Logs",               icon: ClipboardList,   path: "/admin/logs",              section: "Gestão" },
  { label: "Landing Page",       icon: Globe,           path: "/admin/landing",           section: "Config" },
  { label: "Permissões",         icon: Shield,          path: "/admin/permissoes",        section: "Config" },
  { label: "Tutoriais",          icon: BookOpen,        path: "/admin/tutoriais",         section: "Config" },
  { label: "Market Clientes",    icon: Store,           path: "/admin/marketplace",       section: "Config" },
  { label: "Marketplace Global", icon: Globe,           path: "/admin/marketplace-global",section: "Config" },
  { label: "Bot Externo",        icon: Bot,             path: "/admin/bot-config",        section: "Config" },
];

const STORAGE_KEY = "admin_sidebar_order";

function getOrderedItems(): NavItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_NAV_ITEMS;
    const paths: string[] = JSON.parse(stored);
    const map = new Map(DEFAULT_NAV_ITEMS.map(i => [i.path, i]));
    const ordered = paths.map(p => map.get(p)).filter(Boolean) as NavItem[];
    for (const item of DEFAULT_NAV_ITEMS) {
      if (!ordered.find(o => o.path === item.path)) ordered.push(item);
    }
    return ordered;
  } catch {
    return DEFAULT_NAV_ITEMS;
  }
}

function saveOrder(items: NavItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(i => i.path)));
}

// ── Sidebar ──

const SidebarContent = ({
  location,
  onNavigate,
  items,
  editMode,
  onToggleEdit,
  onReorder,
  onReset,
}: {
  location: ReturnType<typeof useLocation>;
  onNavigate?: () => void;
  items: NavItem[];
  editMode: boolean;
  onToggleEdit: () => void;
  onReorder: (from: number, to: number) => void;
  onReset: () => void;
}) => {
  const { signOut } = useAuth();
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragEnter = (index: number) => { dragOver.current = index; };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOver.current !== null && dragItem.current !== dragOver.current) {
      onReorder(dragItem.current, dragOver.current);
    }
    dragItem.current = null;
    dragOver.current = null;
  };

  // Group items by section
  const sections = editMode
    ? [{ label: null, items: items.map((item, i) => ({ item, i })) }]
    : (() => {
        const map = new Map<string, { item: NavItem; i: number }[]>();
        items.forEach((item, i) => {
          const s = item.section || "Outros";
          if (!map.has(s)) map.set(s, []);
          map.get(s)!.push({ item, i });
        });
        return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
      })();

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--sidebar)" }}>
      {/* Logo header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <div className="relative">
          <img src={logo} alt="Admin" className="h-9 w-9 object-contain" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 border-2 border-sidebar">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-display text-sm font-bold leading-tight tracking-wide">
            <span className="text-gradient-pink">ADMIN</span>{" "}
            <span className="text-foreground">PANEL</span>
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Zap className="h-2.5 w-2.5 text-emerald-500" /> Super Administrador
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
        {sections.map(({ label, items: sectionItems }, si) => (
          <div key={si}>
            {label && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {label}
              </p>
            )}
            <div className="space-y-0.5">
              {sectionItems.map(({ item, i }) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== "/admin" && location.pathname.startsWith(item.path));
                return (
                  <div
                    key={item.path}
                    draggable={editMode}
                    onDragStart={() => handleDragStart(i)}
                    onDragEnter={() => handleDragEnter(i)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={cn(
                      "flex items-center rounded-lg transition-all duration-150",
                      editMode && "cursor-grab active:cursor-grabbing",
                    )}
                  >
                    {editMode && (
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
                    )}
                    <Link
                      to={item.path}
                      onClick={editMode ? (e) => e.preventDefault() : onNavigate}
                      className={cn(
                        "relative flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                        editMode && "pointer-events-none opacity-80"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-primary" />
                      )}
                      <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="inline-flex h-4 items-center rounded-full bg-primary/20 px-1.5 text-[10px] font-bold text-primary">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2 space-y-0.5">
        <button
          onClick={onToggleEdit}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            editMode
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <Settings2 className="h-4 w-4" />
          <span>{editMode ? "✓ Concluir" : "Organizar menu"}</span>
        </button>
        {editMode && (
          <button
            onClick={onReset}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Restaurar padrão</span>
          </button>
        )}
        <button
          onClick={async () => {
            localStorage.removeItem("token_session");
            try { await signOut(); } catch (_) {}
            window.location.href = "/login";
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
};

// ── Layout ──

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

function getBreadcrumb(pathname: string): { label: string; path: string }[] {
  const match = DEFAULT_NAV_ITEMS.find(n => n.path === pathname) ||
    DEFAULT_NAV_ITEMS.find(n => n.path !== "/admin" && pathname.startsWith(n.path));
  if (!match) return [{ label: "Admin", path: "/admin" }];
  if (match.path === "/admin") return [{ label: "Admin", path: "/admin" }];
  return [
    { label: "Admin", path: "/admin" },
    { label: match.label, path: match.path },
  ];
}

export const AdminLayout = () => {
  const { isSuperAdmin, loading } = useAdmin();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [orderedItems, setOrderedItems] = useState<NavItem[]>(getOrderedItems);
  const [notifications, setNotifications] = useState<AdminNotif[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("admin_read_notif_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const handleReorder = useCallback((from: number, to: number) => {
    setOrderedItems(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      saveOrder(updated);
      return updated;
    });
  }, []);

  const handleReset = useCallback(() => {
    setOrderedItems(DEFAULT_NAV_ITEMS);
    localStorage.removeItem(STORAGE_KEY);
    toast.success("Menu restaurado ao padrão");
  }, []);

  const toggleEdit = useCallback(() => {
    setEditMode(prev => !prev);
  }, []);

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
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) return <Navigate to="/admin/login" replace />;

  const notifIcon = (type: AdminNotif["type"]) => {
    if (type === "pro_activated") return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15">
        <Crown className="h-4 w-4 text-amber-500" />
      </div>
    );
    if (type === "new_tenant") return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/15">
        <UserPlus className="h-4 w-4 text-blue-400" />
      </div>
    );
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
        <CheckCircle className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  };

  const breadcrumb = getBreadcrumb(location.pathname);

  const sidebarProps = {
    items: orderedItems,
    editMode,
    onToggleEdit: toggleEdit,
    onReorder: handleReorder,
    onReset: handleReset,
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-sidebar-border bg-sidebar shrink-0">
        <SidebarContent location={location} {...sidebarProps} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-60 border-r-0 [&>button]:hidden">
          <SidebarContent location={location} onNavigate={() => setMobileOpen(false)} {...sidebarProps} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 backdrop-blur px-4 md:px-5 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="md:hidden shrink-0">
              <Menu className="h-5 w-5" />
            </Button>

            {/* Breadcrumb */}
            <nav className="hidden md:flex items-center gap-1.5 text-sm min-w-0">
              {breadcrumb.map((crumb, idx) => (
                <span key={crumb.path} className="flex items-center gap-1.5 min-w-0">
                  {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  {idx === breadcrumb.length - 1 ? (
                    <span className="font-semibold text-foreground truncate">{crumb.label}</span>
                  ) : (
                    <Link to={crumb.path} className="text-muted-foreground hover:text-foreground transition-colors">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggle checked={theme === "dark"} onChange={(checked) => setTheme(checked ? "dark" : "light")} />

            {/* Notifications */}
            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                  <Bell className="h-4.5 w-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0 bg-card border-border shadow-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div>
                    <h4 className="text-sm font-semibold">Notificações</h4>
                    <p className="text-xs text-muted-foreground">{unreadCount} não lidas</p>
                  </div>
                  {unreadCount > 0 ? (
                    <button onClick={markAllRead} className="text-xs text-primary hover:underline font-medium">
                      Marcar tudo
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Tudo lido ✓</span>
                  )}
                </div>
                <div className="max-h-[360px] overflow-y-auto">
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
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-accent/40 transition-colors",
                          !n.read && "bg-primary/5"
                        )}
                      >
                        <div className="shrink-0 mt-0.5">{notifIcon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{n.title}</p>
                            {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{n.desc}</p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">{n.time}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Admin avatar */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 border border-primary/30 shrink-0">
              <Shield className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
