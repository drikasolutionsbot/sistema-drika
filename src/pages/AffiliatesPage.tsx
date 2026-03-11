import { useState, useEffect, useCallback, useMemo } from "react";
import { Users, CalendarIcon } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import AffiliateOverview from "@/components/affiliates/AffiliateOverview";
import AffiliateList from "@/components/affiliates/AffiliateList";
import AffiliatePayouts from "@/components/affiliates/AffiliatePayouts";
import { Affiliate, AffiliateOrder, AffiliatePayout } from "@/components/affiliates/types";

type PeriodKey = "today" | "7d" | "30d" | "90d" | "custom";

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "custom", label: "Personalizado" },
];

function getDateRange(period: PeriodKey, customFrom?: Date, customTo?: Date) {
  const now = new Date();
  switch (period) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "7d":
      return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
    case "30d":
      return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    case "90d":
      return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
    case "custom":
      return {
        from: customFrom ? startOfDay(customFrom) : startOfDay(subDays(now, 30)),
        to: customTo ? endOfDay(customTo) : endOfDay(now),
      };
  }
}

const AffiliatesPage = () => {
  const { tenantId } = useTenant();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [orders, setOrders] = useState<AffiliateOrder[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-affiliates", {
        body: { action: "analytics", tenant_id: tenantId },
      });
      if (error) throw error;
      setAffiliates(data?.affiliates ?? []);
      setOrders(data?.orders ?? []);
      setPayouts(data?.payouts ?? []);
    } catch (e: any) {
      toast({ title: "Erro ao carregar afiliados", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const { from, to } = getDateRange(period, customFrom, customTo);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const d = new Date(o.created_at);
      return isWithinInterval(d, { start: from, end: to });
    });
  }, [orders, from, to]);

  const filteredPayouts = useMemo(() => {
    return payouts.filter((p) => {
      const d = new Date(p.created_at);
      return isWithinInterval(d, { start: from, end: to });
    });
  }, [payouts, from, to]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Afiliados
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie links de indicação, acompanhe conversões e controle comissões
          </p>
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.key}
              size="sm"
              variant={period === opt.key ? "default" : "outline"}
              onClick={() => setPeriod(opt.key)}
              className="text-xs h-8"
            >
              {opt.label}
            </Button>
          ))}

          {/* Custom date pickers */}
          {period === "custom" && (
            <div className="flex items-center gap-1.5 ml-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", !customFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {customFrom ? format(customFrom, "dd/MM/yy") : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customFrom}
                    onSelect={setCustomFrom}
                    disabled={(d) => d > new Date()}
                    locale={ptBR}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", !customTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {customTo ? format(customTo, "dd/MM/yy") : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={customTo}
                    onSelect={setCustomTo}
                    disabled={(d) => d > new Date() || (customFrom ? d < customFrom : false)}
                    locale={ptBR}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="affiliates">Afiliados</TabsTrigger>
          <TabsTrigger value="payouts">Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AffiliateOverview
            affiliates={affiliates}
            orders={filteredOrders}
            payouts={filteredPayouts}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="affiliates">
          <AffiliateList
            affiliates={affiliates}
            loading={loading}
            tenantId={tenantId}
            onRefresh={fetchAll}
          />
        </TabsContent>

        <TabsContent value="payouts">
          <AffiliatePayouts
            affiliates={affiliates}
            tenantId={tenantId}
            payouts={payouts}
            onRefresh={fetchAll}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AffiliatesPage;
