import { cn } from "@/lib/utils";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "delivering"
  | "delivered"
  | "canceled"
  | "refunded";

interface StatusConfig {
  label: string;
  className: string;
}

const STATUS_MAP: Record<OrderStatus, StatusConfig> = {
  pending_payment: {
    label: "Pendente",
    className: "text-yellow-500 bg-yellow-500/10 border-yellow-500",
  },
  paid: {
    label: "Pago",
    className: "text-emerald-500 bg-emerald-500/10 border-emerald-500",
  },
  delivering: {
    label: "Entregando",
    className: "text-blue-500 bg-blue-500/10 border-blue-500",
  },
  delivered: {
    label: "Entregue",
    className: "text-blue-500 bg-blue-500/10 border-blue-500",
  },
  canceled: {
    label: "Cancelado",
    className: "text-red-500 bg-red-500/10 border-red-500",
  },
  refunded: {
    label: "Reembolsado",
    className: "text-purple-500 bg-purple-500/10 border-purple-500",
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_MAP[status as OrderStatus] || {
    label: status,
    className: "text-muted-foreground bg-muted/50 border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-2 py-[2px] text-xs font-medium cursor-default",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

export function getStatusLabel(status: string): string {
  return STATUS_MAP[status as OrderStatus]?.label || status;
}
