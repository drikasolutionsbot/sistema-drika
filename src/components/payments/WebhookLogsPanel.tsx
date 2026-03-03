import { useState } from "react";
import { Webhook, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface WebhookLog {
  id: string;
  provider_key: string;
  event_type: string | null;
  payload: any;
  result: any;
  status: string;
  created_at: string;
}

const providerLabels: Record<string, { name: string; color: string }> = {
  mercadopago: { name: "Mercado Pago", color: "bg-blue-500/10 text-blue-400" },
  pushinpay: { name: "PushinPay", color: "bg-orange-500/10 text-orange-400" },
  efi: { name: "Efí", color: "bg-emerald-500/10 text-emerald-400" },
  misticpay: { name: "Mistic Pay", color: "bg-purple-500/10 text-purple-400" },
};

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  processed: { icon: CheckCircle2, color: "text-emerald-400" },
  ignored: { icon: XCircle, color: "text-muted-foreground" },
  received: { icon: Clock, color: "text-yellow-400" },
};

const WebhookLogsPanel = () => {
  const { tenantId } = useTenant();
  const [filterProvider, setFilterProvider] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["webhook-logs", tenantId, filterProvider],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = (supabase as any)
        .from("webhook_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (filterProvider !== "all") {
        query = query.eq("provider_key", filterProvider);
      }

      const { data } = await query;
      return (data ?? []) as WebhookLog[];
    },
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold">Webhooks Recebidos</h3>
          <Badge variant="secondary" className="ml-1">{logs.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterProvider} onValueChange={setFilterProvider}>
            <SelectTrigger className="w-40 bg-muted border-none h-8 text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="mercadopago">Mercado Pago</SelectItem>
              <SelectItem value="pushinpay">PushinPay</SelectItem>
              <SelectItem value="efi">Efí</SelectItem>
              <SelectItem value="misticpay">Mistic Pay</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center">
            <Webhook className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum webhook recebido ainda</p>
            <p className="text-xs text-muted-foreground mt-1">Os logs aparecerão aqui quando um pagamento for notificado</p>
          </div>
        ) : (
          logs.map(log => {
            const provider = providerLabels[log.provider_key] || { name: log.provider_key, color: "bg-muted text-muted-foreground" };
            const stCfg = statusConfig[log.status] || statusConfig.received;
            const StatusIcon = stCfg.icon;
            const isExpanded = expandedId === log.id;

            return (
              <div key={log.id} className="border-b border-border last:border-0">
                <button
                  className="flex items-center gap-3 w-full px-5 py-3 hover:bg-accent/50 transition-colors text-left"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <StatusIcon className={`h-4 w-4 shrink-0 ${stCfg.color}`} />
                  <Badge variant="secondary" className={`text-xs shrink-0 ${provider.color}`}>
                    {provider.name}
                  </Badge>
                  <span className="text-sm font-mono truncate flex-1">
                    {log.event_type || "webhook"}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDate(log.created_at)}
                  </span>
                  <Badge variant={log.status === "processed" ? "default" : "secondary"} className="text-xs shrink-0">
                    {log.status}
                  </Badge>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Payload Recebido</p>
                      <pre className="rounded-lg bg-muted p-3 text-xs font-mono overflow-x-auto max-h-40">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                    {log.result && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Resultado</p>
                        <pre className="rounded-lg bg-muted p-3 text-xs font-mono overflow-x-auto max-h-24">
                          {JSON.stringify(log.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WebhookLogsPanel;
