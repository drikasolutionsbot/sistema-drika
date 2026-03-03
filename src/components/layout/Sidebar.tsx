import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, DollarSign, Palette, Box, Hash, ShieldCheck, HandMetal,
  Store, Zap, Shield, Link2, Gift, Crown, Ticket, Cloud, Headset, Settings,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const bottomItems = [
  { label: "Suporte", icon: Headset, path: "/support" },
  { label: "Configurações", icon: Settings, path: "/settings" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItemProps {
  item: { label: string; icon: React.ElementType; path: string };
  isActive: boolean;
  collapsed: boolean;
}

const NavItem = ({ item, isActive, collapsed }: NavItemProps) => {
  const content = (
    <Link
      to={item.path}
      className={cn(
        "relative flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-200 group",
        collapsed ? "justify-center w-11 h-11 mx-auto" : "px-3 py-2.5",
        isActive
          ? "bg-primary/10 text-primary shadow-[0_0_12px_hsl(330_100%_71%/0.08)]"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {isActive && (
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-primary shadow-[0_0_6px_hsl(330_100%_71%/0.5)]",
          collapsed ? "left-0 -translate-x-2" : "left-0"
        )} />
      )}
      <item.icon
        className={cn(
          "shrink-0 transition-all duration-200",
          collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
          isActive
            ? "text-primary drop-shadow-[0_0_4px_hsl(330_100%_71%/0.4)]"
            : "group-hover:text-foreground"
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const location = useLocation();
  const { tenant } = useTenant();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col shrink-0 border-r border-border/50 transition-all duration-300 bg-gradient-to-b from-card to-card/95",
          collapsed ? "w-[68px] items-center" : "w-60"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center border-b border-border/50 transition-all duration-300",
          collapsed ? "justify-center py-4 px-2" : "gap-3 px-4 py-4"
        )}>
          <Link to="/dashboard" className="group shrink-0">
            <div className={cn(
              "flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_20px_hsl(330_100%_71%/0.15)] group-hover:border-primary/20",
              collapsed ? "h-11 w-11" : "h-9 w-9"
            )}>
              <img src={logo} alt="Drika" className={cn("object-contain", collapsed ? "h-6 w-6" : "h-5 w-5")} />
            </div>
          </Link>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold leading-tight tracking-wide">
                <span className="text-gradient-pink">DRIKA</span>{" "}
                <span className="text-foreground/90">SOLUTIONS</span>
              </span>
              {tenant?.discord_guild_id && (
                <span className="text-[10px] font-mono text-muted-foreground/70 truncate mt-0.5">
                  {tenant.discord_guild_id}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 overflow-y-auto scrollbar-none py-3",
          collapsed ? "px-2 space-y-1" : "px-2.5 space-y-5"
        )}>
          {collapsed ? (
            <>
              {navGroups.flatMap(g => g.items).map((item) => (
                <NavItem
                  key={item.path}
                  item={item}
                  isActive={location.pathname.startsWith(item.path)}
                  collapsed
                />
              ))}
            </>
          ) : (
            navGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavItem
                      key={item.path}
                      item={item}
                      isActive={location.pathname.startsWith(item.path)}
                      collapsed={false}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </nav>

        {/* Divider */}
        <div className={cn("mx-auto", collapsed ? "w-6" : "w-[calc(100%-24px)]")}>
          <div className="h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
        </div>

        {/* Bottom section */}
        <div className={cn("py-2.5", collapsed ? "px-2 space-y-1" : "px-2.5 space-y-0.5")}>
          {bottomItems.map((item) => (
            <NavItem
              key={item.path}
              item={item}
              isActive={location.pathname.startsWith(item.path)}
              collapsed={collapsed}
            />
          ))}
        </div>

        {/* Toggle button */}
        <button
          onClick={onToggle}
          className={cn(
            "flex items-center justify-center h-10 border-t border-border/50 text-muted-foreground/50 hover:text-primary hover:bg-primary/5 transition-all duration-200"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>
    </TooltipProvider>
  );
};
