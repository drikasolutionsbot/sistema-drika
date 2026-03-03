import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { useAdmin } from "@/contexts/AdminContext";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, CreditCard, Users, LogOut, Headphones } from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Pagamentos", icon: CreditCard, path: "/admin/pagamentos" },
  { label: "Clientes", icon: Users, path: "/admin/clientes" },
  { label: "Suporte", icon: Headphones, path: "/admin/suporte" },
];

export const AdminLayout = () => {
  const { isSuperAdmin, loading } = useAdmin();
  const { signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isSuperAdmin) return <Navigate to="/admin/login" replace />;

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar">
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

        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
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
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
};
