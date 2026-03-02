import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TopBarProps {
  onToggleSidebar: () => void;
}

export const TopBar = ({ onToggleSidebar }: TopBarProps) => {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="w-64 bg-muted pl-9 border-none focus-visible:ring-primary"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full gradient-pink" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full gradient-pink flex items-center justify-center text-xs font-bold text-primary-foreground">
            D
          </div>
        </div>
      </div>
    </header>
  );
};
