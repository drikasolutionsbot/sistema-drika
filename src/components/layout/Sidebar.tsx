import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, DollarSign, Palette, Box, Hash, ShieldCheck, Shield,
  Store, Ticket, Cloud, Headset, Settings,
  ChevronLeft, ChevronRight, ClipboardCheck, UserCheck, Sparkles,
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
      { label: "Gerador IA", icon: Sparkles, path: "/ai-assistant" },
    ],
  },
  {
    label: "GERENCIAMENTO",
    items: [
      { label: "Finanças", icon: DollarSign, path: "/finance" },
      { label: "Aprovações", icon: ClipboardCheck, path: "/approvals" },
    ],
  },
  {
    label: "BOT",
    items: [
      { label: "Personalização", icon: Palette, path: "/customization" },
      { label: "Recursos", icon: Box, path: "/resources" },
    ],
  },
  {
    label: "CONFIGURAÇÕES",
    items: [
      { label: "Canais", icon: Hash, path: "/channels" },
      { label: "Cargos", icon: ShieldCheck, path: "/roles" },
      { label: "Loja", icon: Store, path: "/store" },
      { label: "Proteção", icon: Shield, path: "/protection" },
      { label: "Verificação", icon: UserCheck, path: "/verification" },
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
          ? "bg-primary/15 text-primary shadow-[0_0_16px_hsl(330_100%_71%/0.12)] border border-primary/20"
          : "text-white/50 hover:bg-white/10 hover:text-white/90 border border-transparent"
      )}
    >
      {isActive && (
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary shadow-[0_0_8px_hsl(330_100%_71%/0.6)]",
          collapsed ? "left-0 -translate-x-2" : "-left-0.5"
        )} />
      )}
      <item.icon
        className={cn(
          "shrink-0 transition-all duration-200",
          collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
          isActive
            ? "text-primary drop-shadow-[0_0_4px_hsl(330_100%_71%/0.4)]"
            : "group-hover:text-white/90"
        )}
      />
      {!collapsed && <span className="truncate text-white/80">{item.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={14}
          className="px-3.5 py-2 text-[12px] font-semibold tracking-wide rounded-2xl bg-foreground text-background shadow-[0_8px_30px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl border-0 animate-in fade-in-0 zoom-in-95 slide-in-from-left-2 duration-200"
        >
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
          "relative flex flex-col shrink-0 border-r border-primary/10 transition-all duration-300 overflow-hidden scrollbar-none",
          collapsed ? "w-[68px] items-center" : "w-60"
        )}
      >
        {/* Dark gradient background with pink vertical bars effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0a12] via-[#2d0a1e] to-[#1a0a12]" />
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 12px, hsl(330 80% 45% / 0.25) 12px, hsl(330 80% 45% / 0.12) 14px, transparent 14px, transparent 28px)`,
        }} />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 35px, hsl(330 90% 55% / 0.3) 35px, hsl(330 90% 55% / 0.08) 38px, transparent 38px, transparent 60px)`,
        }} />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-primary/10 to-transparent" />
        {/* Logo */}
        <div className={cn(
          "relative z-10 flex items-center border-b border-white/10 transition-all duration-300",
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
                <span className="text-white/90">SOLUTIONS</span>
              </span>
              {tenant?.discord_guild_id && (
                <span className="text-[10px] font-mono text-white/30 truncate mt-0.5">
                  {tenant.discord_guild_id}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn(
          "relative z-10 flex-1 overflow-y-auto scrollbar-none py-3",
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
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
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
        <div className={cn("relative z-10 mx-auto", collapsed ? "w-6" : "w-[calc(100%-24px)]")}>
          <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>

        {/* Bottom section */}
        <div className={cn("relative z-10 py-2.5", collapsed ? "px-2 space-y-1" : "px-2.5 space-y-0.5")}>
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
            "relative z-10 flex items-center justify-center h-10 border-t border-white/10 text-white/30 hover:text-primary hover:bg-primary/10 transition-all duration-200"
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
