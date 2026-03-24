import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, DollarSign, Server, Box, Hash, ShieldCheck, Shield,
  Store, Ticket, Cloud, Headset, Settings,
  ChevronLeft, ChevronRight, ClipboardCheck, Sparkles, BookOpen,
  ShoppingBag, Gift, Users, HandMetal, LayoutTemplate,
  ChevronUp, ChevronDown, GripVertical, Check,
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
import { useLanguage } from "@/i18n/LanguageContext";

interface NavItemDef {
  label: string;
  icon: React.ElementType;
  path: string;
}

interface NavGroup {
  label: string;
  key: string;
  items: NavItemDef[];
  reorderable?: boolean;
}

// Translation key mapping for nav items by path
const navLabelKeys: Record<string, keyof typeof import("@/i18n/translations/pt-BR").ptBR.nav> = {
  "/dashboard": "overview",
  "/ai-assistant": "aiGenerator",
  "/finance": "finance",
  "/approvals": "approvals",
  "/affiliates": "affiliates",
  "/customization": "server",
  "/resources": "resources",
  "/bot-customization": "customization",
  "/channels": "channels",
  "/roles": "roles",
  "/verification": "verification",
  "/store": "store",
  "/marketplace": "marketplace",
  "/protection": "protection",
  "/welcome": "welcome",
  "/tickets": "tickets",
  "/giveaways": "giveaways",
  "/ecloud": "ecloud",
  "/embeds": "embeds",
  "/tutorials": "tutorials",
  "/support": "support",
  "/settings": "settings",
};

// Group key -> translation key mapping
const groupLabelKeys: Record<string, keyof typeof import("@/i18n/translations/pt-BR").ptBR.nav> = {
  principal: "principal",
  gerenciamento: "management",
  bot: "bot",
  configuracoes: "settings_group",
};

const defaultNavGroups: NavGroup[] = [
  {
    label: "PRINCIPAL",
    key: "principal",
    items: [
      { label: "overview", icon: LayoutDashboard, path: "/dashboard" },
      { label: "aiGenerator", icon: Sparkles, path: "/ai-assistant" },
    ],
  },
  {
    label: "GERENCIAMENTO",
    key: "gerenciamento",
    items: [
      { label: "finance", icon: DollarSign, path: "/finance" },
      { label: "approvals", icon: ClipboardCheck, path: "/approvals" },
      { label: "affiliates", icon: Users, path: "/affiliates" },
    ],
    reorderable: true,
  },
  {
    label: "BOT",
    key: "bot",
    items: [
      { label: "server", icon: Server, path: "/customization" },
      { label: "resources", icon: Box, path: "/resources" },
      { label: "customization", icon: Sparkles, path: "/bot-customization" },
    ],
    reorderable: true,
  },
  {
    label: "CONFIGURAÇÕES",
    key: "configuracoes",
    items: [
      { label: "channels", icon: Hash, path: "/channels" },
      { label: "roles", icon: ShieldCheck, path: "/roles" },
      { label: "verification", icon: Shield, path: "/verification" },
      { label: "store", icon: Store, path: "/store" },
      { label: "marketplace", icon: ShoppingBag, path: "/marketplace" },
      { label: "protection", icon: Shield, path: "/protection" },
      { label: "welcome", icon: HandMetal, path: "/welcome" },
      { label: "tickets", icon: Ticket, path: "/tickets" },
      { label: "giveaways", icon: Gift, path: "/giveaways" },
      { label: "ecloud", icon: Cloud, path: "/ecloud" },
      { label: "embeds", icon: LayoutTemplate, path: "/embeds" },
    ],
    reorderable: true,
  },
];

const bottomItems: NavItemDef[] = [
  { label: "tutorials", icon: BookOpen, path: "/tutorials" },
  { label: "support", icon: Headset, path: "/support" },
  { label: "settings", icon: Settings, path: "/settings" },
];

// Icon map for restoring from localStorage (icons can't be serialized)
const iconMap: Record<string, React.ElementType> = {
  "/dashboard": LayoutDashboard,
  "/ai-assistant": Sparkles,
  "/finance": DollarSign,
  "/approvals": ClipboardCheck,
  "/affiliates": Users,
  "/customization": Server,
  "/resources": Box,
  "/bot-customization": Sparkles,
  "/channels": Hash,
  "/roles": ShieldCheck,
  "/verification": Shield,
  "/store": Store,
  "/marketplace": ShoppingBag,
  "/protection": Shield,
  "/welcome": HandMetal,
  "/tickets": Ticket,
  "/giveaways": Gift,
  "/ecloud": Cloud,
  "/embeds": LayoutTemplate,
};

function getSavedOrder(tenantId: string): Record<string, string[]> | null {
  try {
    const raw = localStorage.getItem(`sidebar-order-${tenantId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveOrder(tenantId: string, order: Record<string, string[]>) {
  localStorage.setItem(`sidebar-order-${tenantId}`, JSON.stringify(order));
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItemProps {
  item: NavItemDef;
  isActive: boolean;
  collapsed: boolean;
  resolvedLabel: string;
  reordering?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

const NavItem = ({ item, isActive, collapsed, resolvedLabel, reordering, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: NavItemProps) => {
  const content = (
    <div className={cn("relative flex items-center", reordering && !collapsed && "group/reorder")}>
      {reordering && !collapsed && (
        <div className="flex flex-col mr-0.5 shrink-0">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMoveUp?.(); }}
            disabled={!canMoveUp}
            className={cn(
              "p-0.5 rounded transition-colors",
              canMoveUp ? "text-white/40 hover:text-primary hover:bg-primary/10" : "text-white/10 cursor-not-allowed"
            )}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMoveDown?.(); }}
            disabled={!canMoveDown}
            className={cn(
              "p-0.5 rounded transition-colors",
              canMoveDown ? "text-white/40 hover:text-primary hover:bg-primary/10" : "text-white/10 cursor-not-allowed"
            )}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}
      <Link
        to={reordering ? "#" : item.path}
        onClick={reordering ? (e) => e.preventDefault() : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-xl text-[13px] font-medium transition-all duration-300 group overflow-hidden flex-1",
          collapsed ? "justify-center w-11 h-11 mx-auto" : "px-3 py-2.5",
          isActive
            ? "bg-primary/12 text-primary border border-primary/20"
            : "text-white/45 hover:bg-white/[0.06] hover:text-white/80 border border-transparent",
          reordering && "cursor-grab"
        )}
      >
        {isActive && (
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pointer-events-none" />
        )}
        {isActive && (
          <div className={cn(
            "absolute top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary shadow-[0_0_10px_hsl(330_100%_71%/0.7)]",
            collapsed ? "left-0 -translate-x-2" : "-left-0.5"
          )} />
        )}
        <div className={cn(
          "relative shrink-0 flex items-center justify-center rounded-lg transition-all duration-300",
          collapsed ? "h-7 w-7" : "h-6 w-6",
          isActive ? "bg-primary/15" : "group-hover:bg-white/[0.06]"
        )}>
          <item.icon
            className={cn(
              "shrink-0 transition-all duration-300",
              collapsed ? "h-[16px] w-[16px]" : "h-[15px] w-[15px]",
              isActive
                ? "text-primary drop-shadow-[0_0_6px_hsl(330_100%_71%/0.5)]"
                : "text-white/40 group-hover:text-white/70"
            )}
            strokeWidth={isActive ? 2.2 : 1.8}
          />
          {isActive && (
            <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(330_100%_71%/0.8)]" />
          )}
        </div>
        {!collapsed && (
          <span className={cn(
            "truncate transition-colors duration-300 relative z-10",
            isActive ? "text-primary font-semibold" : "text-white/55 group-hover:text-white/80"
          )}>
            {resolvedLabel}
          </span>
        )}
      </Link>
    </div>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={14}
          className="px-3.5 py-2 text-[12px] font-semibold tracking-wide rounded-xl bg-card text-foreground shadow-[0_8px_30px_rgba(0,0,0,0.35),0_0_0_1px_hsl(330_100%_50%/0.1)] backdrop-blur-xl border border-border/50 animate-in fade-in-0 zoom-in-95 slide-in-from-left-2 duration-200"
        >
          {resolvedLabel}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const location = useLocation();
  const { tenant, tenantId } = useTenant();
  const { t } = useLanguage();
  const [reorderingGroup, setReorderingGroup] = useState<string | null>(null);
  const [navGroups, setNavGroups] = useState<NavGroup[]>(defaultNavGroups);

  // Load saved order on mount / tenantId change
  useEffect(() => {
    if (!tenantId) return;
    const saved = getSavedOrder(tenantId);
    if (!saved) return;

    setNavGroups((prev) =>
      prev.map((group) => {
        const savedPaths = saved[group.key];
        if (!savedPaths) return group;

        // Reorder items based on saved paths, keeping any new items at the end
        const reordered: NavItemDef[] = [];
        const defaultItems = defaultNavGroups.find((g) => g.key === group.key)?.items || group.items;

        for (const path of savedPaths) {
          const item = defaultItems.find((i) => i.path === path);
          if (item) reordered.push({ ...item, icon: iconMap[item.path] || item.icon });
        }
        // Add any items not in saved order (new items)
        for (const item of defaultItems) {
          if (!reordered.find((r) => r.path === item.path)) {
            reordered.push(item);
          }
        }
        return { ...group, items: reordered };
      })
    );
  }, [tenantId]);

  const moveItem = useCallback((groupKey: string, index: number, direction: -1 | 1) => {
    setNavGroups((prev) => {
      const updated = prev.map((group) => {
        if (group.key !== groupKey) return group;
        const items = [...group.items];
        const target = index + direction;
        if (target < 0 || target >= items.length) return group;
        [items[index], items[target]] = [items[target], items[index]];
        return { ...group, items };
      });

      // Auto-save
      if (tenantId) {
        const order: Record<string, string[]> = {};
        for (const g of updated) {
          if (g.reorderable) {
            order[g.key] = g.items.map((i) => i.path);
          }
        }
        saveOrder(tenantId, order);
      }

      return updated;
    });
  }, [tenantId]);

  const toggleReorder = (groupKey: string) => {
    setReorderingGroup((prev) => (prev === groupKey ? null : groupKey));
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex flex-col shrink-0 border-r border-primary/10 transition-all duration-300 overflow-hidden scrollbar-none h-full",
          collapsed ? "w-[68px] items-center" : "w-60"
        )}
      >
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0a12] via-[#2d0a1e] to-[#1a0a12]" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 12px, hsl(330 80% 45% / 0.2) 12px, hsl(330 80% 45% / 0.08) 14px, transparent 14px, transparent 28px)`,
        }} />
        <div className="absolute inset-0 opacity-15" style={{
          backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 35px, hsl(330 90% 55% / 0.25) 35px, hsl(330 90% 55% / 0.06) 38px, transparent 38px, transparent 60px)`,
        }} />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-primary/8 to-transparent" />

        {/* Logo */}
        <div className={cn(
          "relative z-10 flex items-center border-b border-white/[0.06] transition-all duration-300",
          collapsed ? "justify-center py-4 px-2" : "gap-3 px-4 py-4"
        )}>
          <Link to="/dashboard" className="group shrink-0">
            <div className={cn(
              "relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/15 transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_24px_hsl(330_100%_71%/0.2)] group-hover:border-primary/25 overflow-hidden",
              collapsed ? "h-11 w-11" : "h-9 w-9"
            )}>
              <img src={logo} alt="Drika" className={cn("object-contain relative z-10", collapsed ? "h-6 w-6" : "h-5 w-5")} />
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          </Link>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold leading-tight tracking-wide">
                <span className="text-gradient-pink">DRIKA</span>{" "}
                <span className="text-white/90">HUB</span>
              </span>
              {tenant?.discord_guild_id && (
                <span className="text-[10px] font-mono text-white/25 truncate mt-0.5">
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
                  resolvedLabel={t.nav[navLabelKeys[item.path] || item.label as keyof typeof t.nav] || item.label}
                  isActive={location.pathname.startsWith(item.path)}
                  collapsed
                />
              ))}
            </>
          ) : (
            navGroups.map((group) => (
              <div key={group.key}>
                <div className="flex items-center justify-between px-3 mb-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/40">
                    {group.label}
                  </p>
                  {group.reorderable && (
                    <button
                      onClick={() => toggleReorder(group.key)}
                      className={cn(
                        "p-1 rounded-md transition-all duration-200",
                        reorderingGroup === group.key
                          ? "text-primary bg-primary/15"
                          : "text-white/20 hover:text-white/50 hover:bg-white/5"
                      )}
                      title={reorderingGroup === group.key ? "Salvar ordem" : "Reordenar"}
                    >
                      {reorderingGroup === group.key ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <GripVertical className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item, idx) => (
                    <NavItem
                      key={item.path}
                      item={item}
                      isActive={location.pathname.startsWith(item.path)}
                      collapsed={false}
                      reordering={reorderingGroup === group.key}
                      onMoveUp={() => moveItem(group.key, idx, -1)}
                      onMoveDown={() => moveItem(group.key, idx, 1)}
                      canMoveUp={idx > 0}
                      canMoveDown={idx < group.items.length - 1}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </nav>

        {/* Divider */}
        <div className={cn("relative z-10 mx-auto", collapsed ? "w-6" : "w-[calc(100%-24px)]")}>
          <div className="h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
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
            "relative z-10 flex items-center justify-center h-10 border-t border-white/[0.06] text-white/25 hover:text-primary hover:bg-primary/8 transition-all duration-300 group"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-300" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform duration-300" />
          )}
        </button>
      </aside>
    </TooltipProvider>
  );
};
