import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

export const StatCard = ({ title, value, change, changeType = "neutral", icon: Icon }: StatCardProps) => {
  return (
    <div className="group relative rounded-2xl border border-border/50 bg-card p-5 transition-all duration-300 hover:border-primary/25 hover:shadow-[0_0_30px_hsl(330_100%_50%/0.06)] overflow-hidden">
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="relative flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">{title}</p>
          <p className="text-2xl font-bold font-display tracking-tight">{value}</p>
          {change && (
            <p className={cn(
              "text-xs font-semibold flex items-center gap-1",
              changeType === "positive" && "text-emerald-400",
              changeType === "negative" && "text-red-400",
              changeType === "neutral" && "text-muted-foreground"
            )}>
              {change}
            </p>
          )}
        </div>
        <div className="relative">
          <div className="absolute -inset-1 rounded-xl bg-primary/10 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative rounded-xl bg-primary/10 p-2.5 border border-primary/10 group-hover:border-primary/20 transition-all duration-300 group-hover:scale-105">
            <Icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
          </div>
        </div>
      </div>
    </div>
  );
};
