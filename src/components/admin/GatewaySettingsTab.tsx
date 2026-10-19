import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Plug, Eye, EyeOff, ShieldOff, ShieldCheck } from "lucide-react";

interface GatewaySetting {
  key: string;
  label: string;
  color: string;
  enabled: boolean;
  visible: boolean;
  updated_at: string | null;
}

// Gateway icon colors mapped from the key
const GATEWAY_ICONS: Record<string, { bg: string; text: string }> = {
  mercadopago: { bg: "bg-blue-500/15",   text: "text-blue-400" },
  stripe:      { bg: "bg-violet-500/15", text: "text-violet-400" },
  pushinpay:   { bg: "bg-orange-500/15", text: "text-orange-400" },
  efi:         { bg: "bg-emerald-500/15",text: "text-emerald-400" },
  misticpay:   { bg: "bg-purple-500/15", text: "text-purple-400" },
  abacatepay:  { bg: "bg-lime-500/15",   text: "text-lime-400" },
  lofypay:     { bg: "bg-cyan-500/15",   text: "text-cyan-400" },
};

async function invokeGateway(action: string, payload?: object) {
  const { data, error } = await supabase.functions.invoke("manage-gateway-settings", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function GatewaySettingsTab() {
  const [gateways, setGateways] = useState<GatewaySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Confirmation dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    key: string; label: string; field: "enabled" | "visible"; value: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await invokeGateway("list");
      setGateways(data || []);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const requestChange = (key: string, label: string, field: "enabled" | "visible", value: boolean) => {
    // Disabling requires confirmation
    if (!value) {
      setPendingChange({ key, label, field, value });
      setConfirmOpen(true);
    } else {
      applyChange(key, field, value);
    }
  };

  const applyChange = async (key: string, field: "enabled" | "visible", value: boolean) => {
    setSaving(key);
    try {
      await invokeGateway("update", { gateway_key: key, [field]: value });
      setGateways(prev =>
        prev.map(g => g.key === key ? { ...g, [field]: value } : g)
      );
      toast({
        title: value
          ? `Gateway ${field === "enabled" ? "ativada" : "visível"}`
          : `Gateway ${field === "enabled" ? "desativada" : "ocultada"}`,
        description: `${field === "enabled" ? (value ? "✅" : "🔴") : (value ? "👁️" : "🙈")} Alteração aplicada para todos os clientes.`,
      });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleConfirm = () => {
    if (pendingChange) {
      applyChange(pendingChange.key, pendingChange.field, pendingChange.value);
    }
    setConfirmOpen(false);
    setPendingChange(null);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <>
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-6">
        <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-300">
          <p className="font-semibold">Controle global de gateways</p>
          <p className="text-amber-300/80 mt-0.5">
            Desativar uma gateway bloqueia seu uso em <strong>todos os clientes</strong> — nenhum PIX será gerado e webhooks serão ignorados. Ocultar apenas esconde a opção no painel do cliente.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {gateways.map(gw => {
          const ic = GATEWAY_ICONS[gw.key] ?? { bg: "bg-muted", text: "text-muted-foreground" };
          const isSaving = saving === gw.key;

          return (
            <Card
              key={gw.key}
              className={`border transition-all duration-200 ${
                !gw.enabled
                  ? "border-destructive/40 bg-destructive/5 opacity-75"
                  : "border-border bg-card"
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${ic.bg} shrink-0`}>
                    <Plug className={`h-5 w-5 ${ic.text}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{gw.label}</span>
                      {!gw.enabled && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Desativada
                        </Badge>
                      )}
                      {gw.enabled && !gw.visible && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Oculta
                        </Badge>
                      )}
                      {gw.enabled && gw.visible && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                          Ativa
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {gw.enabled
                        ? gw.visible
                          ? "Disponível para todos os clientes"
                          : "Funcional mas oculta no painel dos clientes"
                        : "Completamente desativada — PIX e webhooks bloqueados"
                      }
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-5 shrink-0">
                    {/* Visible toggle */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1.5">
                        {gw.visible
                          ? <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                        <Switch
                          id={`visible-${gw.key}`}
                          checked={gw.visible}
                          disabled={isSaving || !gw.enabled}
                          onCheckedChange={(v) => requestChange(gw.key, gw.label, "visible", v)}
                          className="scale-90"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">Visível</span>
                    </div>

                    {/* Enabled toggle */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1.5">
                        {gw.enabled
                          ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                          : <ShieldOff className="h-3.5 w-3.5 text-destructive" />
                        }
                        <Switch
                          id={`enabled-${gw.key}`}
                          checked={gw.enabled}
                          disabled={isSaving}
                          onCheckedChange={(v) => requestChange(gw.key, gw.label, "enabled", v)}
                          className="scale-90"
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">Ativada</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              {pendingChange?.field === "enabled"
                ? `Desativar ${pendingChange?.label}?`
                : `Ocultar ${pendingChange?.label}?`
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange?.field === "enabled"
                ? `Isso vai bloquear completamente o uso de ${pendingChange?.label} para todos os clientes. Nenhum PIX poderá ser gerado e webhooks serão ignorados até que a gateway seja reativada.`
                : `${pendingChange?.label} vai sumir do painel de todos os clientes, mas continuará funcionando para quem já tinha configurado.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={pendingChange?.field === "enabled"
                ? "bg-destructive hover:bg-destructive/90"
                : ""}
            >
              {pendingChange?.field === "enabled" ? "Desativar gateway" : "Ocultar gateway"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
