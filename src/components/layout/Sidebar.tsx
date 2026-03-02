import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Store, Hash, Tag, Users, CreditCard, Ticket,
  DollarSign, Settings, ChevronLeft, ChevronRight, Crown
} from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "PRINCIPAL",
    items: [
      { label: "Visão Geral", icon: LayoutDashboard, path: "/dashboard" },
    ],
  },
  {
    label: "GERENCIAMENTO",
    items: [
      { label: "Finanças", icon: DollarSign, path: "/finance" },
      { label: "Pagamentos", icon: CreditCard, path: "/payments" },
      { label: "Loja", icon: Store, path: "/store" },
    ],
  },
  {
    label: "CONFIGURAÇÕES",
    items: [
      { label: "Canais", icon: Hash, path: "/channels" },
      { label: "Cupons", icon: Tag, path: "/coupons" },
      { label: "Afiliados", icon: Users, path: "/affiliates" },
      { label: "Tickets", icon: Ticket, path: "/tickets" },
      { label: "Configurações", icon: Settings, path: "/settings" },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const location = useLocation();

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <img src={logo} alt="Drika Solutions" className="h-9 w-9 object-contain" />
        {!collapsed && (
        <span className="font-display text-lg font-bold">
            <span className="text-gradient-pink">DRIKA</span>{" "}
            <span className="text-foreground">SOLUTIONS</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-4 p-2 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="flex h-12 items-center justify-center border-t border-sidebar-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
};
