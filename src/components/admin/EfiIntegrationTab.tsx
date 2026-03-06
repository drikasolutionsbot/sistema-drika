import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Key, Webhook, CheckCircle2, AlertCircle, ExternalLink, Copy, Shield, Zap, Loader2, Upload, FileCheck, Info } from "lucide-react";
import forge from "node-forge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";

const EfiIntegrationTab = () => {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [certPem, setCertPem] = useState("");
  const [keyPem, setKeyPem] = useState("");
  const [proPriceCents, setProPriceCents] = useState(2690);
  const [priceDisplay, setPriceDisplay] = useState("26.90");
  const [autoActivate, setAutoActivate] = useState(true);
  const [suspendOnExpire, setSuspendOnExpire] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);
  const [p12FileName, setP12FileName] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);
  const p12FileRef = useRef<HTMLInputElement>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-webhook`;

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("landing_config")
        .select("*")
        .limit(1)
        .single();
      if (data) {
        setConfigId(data.id);
        const d = data as any;
        if (d.efi_client_id) setClientId(d.efi_client_id);
        if (d.efi_client_secret) setClientSecret(d.efi_client_secret);
        if (d.efi_pix_key) setPixKey(d.efi_pix_key);
        if (d.efi_cert_pem) setCertPem(d.efi_cert_pem);
        if (d.efi_key_pem) setKeyPem(d.efi_key_pem);
        setIsConnected(d.efi_active || false);
        if (data.pro_price_cents) {
          setProPriceCents(data.pro_price_cents);
          setPriceDisplay((data.pro_price_cents / 100).toFixed(2));
        }
        setAutoActivate(data.auto_activate_plan ?? true);
        setSuspendOnExpire(data.suspend_on_expire ?? true);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPriceDisplay(e.target.value);
  };

  const handlePriceBlur = () => {
    const parsed = parseFloat(priceDisplay.replace(",", "."));
    if (!isNaN(parsed) && parsed > 0) {
      const cents = Math.round(parsed * 100);
      setProPriceCents(cents);
      setPriceDisplay((cents / 100).toFixed(2));
    } else {
      setPriceDisplay((proPriceCents / 100).toFixed(2));
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  const handleToggleActive = async (checked: boolean) => {
    if (!configId) return;
    setTogglingActive(true);
    try {
      const { error } = await supabase
        .from("landing_config")
        .update({ efi_active: checked, updated_at: new Date().toISOString() } as any)
        .eq("id", configId);
      if (error) throw error;
      setIsConnected(checked);
      toast.success(checked ? "Efí ativado!" : "Efí desativado!");
    } catch {
      toast.error("Erro ao alterar status");
    } finally {
      setTogglingActive(false);
    }
  };

  const handleP12Upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const binary = String.fromCharCode(...new Uint8Array(arrayBuffer));
      const p12Der = forge.util.decode64(btoa(binary));
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, "");

      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

      const certBag = (certBags[forge.pki.oids.certBag] || [])[0];
      const keyBag = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];

      if (!certBag?.cert || !keyBag?.key) {
        toast.error("Não foi possível extrair certificado/chave do .p12");
        return;
      }

      const certPemStr = forge.pki.certificateToPem(certBag.cert);
      const keyPemStr = forge.pki.privateKeyToPem(keyBag.key);

      setCertPem(certPemStr);
      setKeyPem(keyPemStr);
      setP12FileName(file.name);
      toast.success(`Certificado ${file.name} importado com sucesso!`);
    } catch (err) {
      console.error("P12 parse error:", err);
      toast.error("Erro ao ler o arquivo .p12. Verifique se o arquivo está correto.");
    }
  };

  const handleTestConnection = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Insira o Client ID e Client Secret");
      return;
    }
    if (!certPem.trim() || !keyPem.trim()) {
      toast.error("Insira o certificado e a chave privada PEM");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-payment", {
        body: {
          provider_key: "efi",
          api_key: clientId.trim(),
          secret_key: clientSecret.trim(),
          cert_pem: certPem.trim(),
          key_pem: keyPem.trim(),
        },
      });
      if (error) throw error;
      if (data?.success) {
        setIsConnected(true);
        toast.success(data.message || "Conexão validada!");
      } else {
        setIsConnected(false);
        toast.error(data?.message || "Falha na validação");
      }
    } catch {
      toast.error("Falha ao conectar com Efí");
      setIsConnected(false);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Insira o Client ID e Client Secret");
      return;
    }
    if (!certPem.trim() || !keyPem.trim()) {
      toast.error("Insira o certificado e a chave privada PEM para mTLS");
      return;
    }
    if (!configId) {
      toast.error("Configuração não encontrada");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("landing_config")
        .update({
          efi_client_id: clientId.trim(),
          efi_client_secret: clientSecret.trim(),
          efi_pix_key: pixKey.trim() || null,
          efi_cert_pem: certPem.trim(),
          efi_key_pem: keyPem.trim(),
          efi_active: true,
          pro_price_cents: proPriceCents,
          auto_activate_plan: autoActivate,
          suspend_on_expire: suspendOnExpire,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", configId);

      if (error) throw error;
      setIsConnected(true);
      await logAudit("config_updated", "config", configId, "Efí Integration", {
        pro_price: `R$ ${(proPriceCents / 100).toFixed(2)}`,
        auto_activate: autoActivate,
        suspend_on_expire: suspendOnExpire,
      });
      toast.success("Configurações da Efí salvas e ativadas com sucesso!");
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Erro ao salvar: " + (err.message || "Verifique as permissões"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Card className={`border ${isConnected ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="font-medium text-emerald-500">Efí ativo</p>
                  <p className="text-xs text-muted-foreground">Cobranças de assinatura ativas via PIX Efí com mTLS</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-500">Efí inativo</p>
                  <p className="text-xs text-muted-foreground">Configure as credenciais e certificado para ativar cobranças do plano Pro</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{isConnected ? "Ativo" : "Inativo"}</span>
            <Switch checked={isConnected} onCheckedChange={handleToggleActive} disabled={togglingActive} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credentials */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Credenciais da API
            </CardTitle>
            <CardDescription>Configure suas credenciais OAuth2 da Efí (Gerencianet)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Client_Id_xxxxxxxxxxxxxxx"
                className="bg-background border-border font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Client Secret</Label>
              <Input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Client_Secret_xxxxxxxxxxxxxxx"
                className="bg-background border-border font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label>Chave PIX (registrada na Efí)</Label>
              <Input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="sua-chave-pix@email.com"
                className="bg-background border-border text-sm"
              />
              <p className="text-xs text-muted-foreground">
                A chave PIX cadastrada na sua conta Efí
              </p>
            </div>

            <div className="space-y-2">
              <Label>Valor do Plano Pro (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={priceDisplay}
                  onChange={handlePriceChange}
                  onBlur={handlePriceBlur}
                  className="bg-background border-border pl-10"
                  placeholder="26.90"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Valor em reais ({proPriceCents} centavos)
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Obtenha suas credenciais no{" "}
              <a href="https://app.efipay.com.br" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                painel da Efí <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Certificate + Webhook */}
        <div className="space-y-6">
           <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Certificado mTLS
              </CardTitle>
              <CardDescription>
                A API PIX da Efí exige certificado mTLS. Faça upload do seu arquivo .p12 recebido da Efí.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Faça o download do certificado .p12 no painel da Efí (API {'>'} Aplicações {'>'} Produção) e envie aqui. A conversão é automática.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Certificado .p12</Label>
                <div className="flex gap-2 items-center">
                  <Button
                    variant="outline"
                    onClick={() => p12FileRef.current?.click()}
                    className="gap-2"
                  >
                    {certPem && keyPem ? (
                      <FileCheck className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {certPem && keyPem
                      ? p12FileName || "Certificado importado"
                      : "Upload certificado .p12"}
                  </Button>
                  <input
                    ref={p12FileRef}
                    type="file"
                    accept=".p12,.pfx,.pem"
                    className="hidden"
                    onChange={handleP12Upload}
                  />
                </div>
                {certPem && keyPem && (
                  <p className="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Certificado e chave privada extraídos com sucesso
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Webhook Config */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Webhook className="h-5 w-5 text-primary" />
                Webhook
              </CardTitle>
              <CardDescription>Configure este URL no painel da Efí para receber confirmações PIX</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="bg-background border-border font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cole esta URL nas configurações de webhook PIX da Efí
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Ativar plano automaticamente</p>
                    <p className="text-xs text-muted-foreground">Ativa o plano do cliente assim que o pagamento for confirmado</p>
                  </div>
                  <Switch checked={autoActivate} onCheckedChange={setAutoActivate} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Suspender ao expirar</p>
                    <p className="text-xs text-muted-foreground">Suspende acesso quando o pagamento não é renovado</p>
                  </div>
                  <Switch checked={suspendOnExpire} onCheckedChange={setSuspendOnExpire} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleTestConnection} disabled={testing || !clientId.trim() || !clientSecret.trim() || !certPem.trim() || !keyPem.trim()} className="flex-1">
          {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
          Testar Conexão
        </Button>
        <Button onClick={handleSave} disabled={saving || !clientId.trim() || !clientSecret.trim() || !certPem.trim() || !keyPem.trim()} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
          Salvar
        </Button>
      </div>

      {/* Plans Preview */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Planos Disponíveis</CardTitle>
          <CardDescription>O botão "Assinar Pro" na landing page gerará um PIX automaticamente via Efí</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Teste Grátis</h3>
                <Badge variant="secondary" className="text-xs">4 dias</Badge>
              </div>
              <ul className="space-y-1">
                {["Painel completo", "Bot no servidor", "Vendas automáticas"].map((f) => (
                  <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-primary">Pro</h3>
                <Badge className="text-xs bg-primary">R$ {(proPriceCents / 100).toFixed(2)}/mês</Badge>
              </div>
              <ul className="space-y-1">
                {["Tudo do Free", "Sem limite de tempo", "Segurança avançada", "Suporte prioritário"].map((f) => (
                  <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EfiIntegrationTab;
