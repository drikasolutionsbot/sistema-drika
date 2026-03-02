import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, DollarSign, Palette, Box, Hash, ShieldCheck, HandMetal,
  Store, Zap, Shield, Link2, Gift, Crown, Ticket, Cloud,
  ChevronLeft, ChevronRight, Settings
} from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";

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
      { label: "Personalização", icon: Palette, path: "/customization" },
      { label: "Recursos", icon: Box, path: "/resources" },
    ],
  },
  {
    label: "CONFIGURAÇÕES",
    items: [
      { label: "Canais", icon: Hash, path: "/channels" },
      { label: "Cargos", icon: ShieldCheck, path: "/roles" },
      { label: "Boas Vindas", icon: HandMetal, path: "/welcome" },
      { label: "Loja", icon: Store, path: "/store" },
      { label: "Ações Automáticas", icon: Zap, path: "/automations" },
      { label: "Proteção", icon: Shield, path: "/protection" },
      { label: "Rastreamento", icon: Link2, path: "/invite-tracking" },
      { label: "Sorteios", icon: Gift, path: "/giveaways" },
      { label: "VIPs", icon: Crown, path: "/vips" },
      { label: "Tickets", icon: Ticket, path: "/tickets" },
      { label: "eCloud", icon: Cloud, path: "/ecloud" },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const location = useLocation();
  const { tenant } = useTenant();

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-auto items-center gap-3 border-b border-sidebar-border px-4 py-3">
        <img src={logo} alt="Drika Solutions" className="h-9 w-9 object-contain shrink-0" />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-display text-lg font-bold leading-tight">
              <span className="text-gradient-pink">DRIKA</span>{" "}
              <span className="text-foreground">SOLUTIONS</span>
            </span>
            {tenant?.discord_guild_id && (
              <span className="text-[10px] font-mono text-muted-foreground truncate">
                {tenant.discord_guild_id}
              </span>
            )}
          </div>
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
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
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
