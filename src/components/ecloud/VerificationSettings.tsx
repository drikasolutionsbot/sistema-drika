import { useState, useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Shield,
  Copy,
  ExternalLink,
  Save,
  Users,
  RefreshCw,
} from "lucide-react";

interface VerificationSettingsProps {
  verifiedCount: number;
  onRefresh: () => void;
}

export const VerificationSettings = ({ verifiedCount, onRefresh }: VerificationSettingsProps) => {
  const { tenant, tenantId, refetch } = useTenant();
  const [enabled, setEnabled] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenant) {
      setEnabled((tenant as any).verify_enabled ?? false);
      setRoleId((tenant as any).verify_role_id ?? "");
    }
  }, [tenant]);

  const verifyUrl = `${window.location.origin}/verify?tenant_id=${tenantId}`;

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            verify_enabled: enabled,
            verify_role_id: roleId || null,
          },
        },
      });
      if (error) throw error;
      toast.success("Configurações de verificação salvas!");
      refetch();
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(verifyUrl);
    toast.success("Link copiado!");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-display font-semibold text-lg">Verificação de Membros</h2>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {verifiedCount} verificados
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Enable toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Ativar Verificação</p>
            <p className="text-xs text-muted-foreground">
              Membros poderão verificar via Discord OAuth2
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {/* Verify link */}
        {enabled && (
          <>
            <div className="space-y-2">
              <Label className="text-sm">Link de Verificação</Label>
              <div className="flex gap-2">
                <Input value={verifyUrl} readOnly className="text-xs font-mono" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={verifyUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Envie este link para os membros verificarem. Pode usar no bot com um botão.
              </p>
            </div>

            {/* Verify role */}
            <div className="space-y-2">
              <Label className="text-sm">ID do Cargo de Verificado (opcional)</Label>
              <Input
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                placeholder="Ex: 1234567890123456789"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Cargo que será atribuído automaticamente ao membro verificar.
              </p>
            </div>
          </>
        )}

        {/* Save */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button variant="outline" onClick={onRefresh} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>
    </div>
  );
};
