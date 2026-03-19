import { useState, useRef } from "react";
import { Palette, Loader2, Check, Upload, X, Bot, Key, Eye, EyeOff, AlertTriangle, CheckCircle2, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  tenant: any;
  tenantId: string | null;
  refetchTenant: () => void;
}

const SettingsBotCustomizationTab = ({ tenant, tenantId, refetchTenant }: Props) => {
  const [botName, setBotName] = useState(tenant?.bot_name || "");
  const [botAvatarUrl, setBotAvatarUrl] = useState(tenant?.bot_avatar_url || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Token state
  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [savingToken, setSavingToken] = useState(false);

  const hasToken = !!tenant?.bot_token_encrypted;

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/bot-avatar/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("tenant-assets")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
      setBotAvatarUrl(data.publicUrl);
      toast({ title: "Avatar enviado!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            bot_name: botName.trim() || null,
            bot_avatar_url: botAvatarUrl.trim() || null,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      toast({ title: "Personalização salva! ✅" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveToken = async () => {
    if (!tenantId || !botToken.trim()) return;
    setSavingToken(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            bot_token_encrypted: botToken.trim(),
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBotToken("");
      await refetchTenant();
      toast({ title: "Token do bot salvo com sucesso! ✅" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar token", description: err.message, variant: "destructive" });
    } finally {
      setSavingToken(false);
    }
  };

  const handleRemoveToken = async () => {
    if (!tenantId) return;
    setSavingToken(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: {
          tenant_id: tenantId,
          updates: {
            bot_token_encrypted: null,
            bot_client_id: null,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();
      toast({ title: "Token removido" });
    } catch (err: any) {
      toast({ title: "Erro ao remover token", description: err.message, variant: "destructive" });
    } finally {
      setSavingToken(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bot Token Section */}
      <div className="wallet-section">
        <div className="wallet-section-header mb-5">
          <div className="wallet-section-icon">
            <Key className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-display font-semibold text-sm">Token do Bot</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Configure o token do seu bot Discord para ativar todas as funcionalidades
            </p>
          </div>
        </div>

        {hasToken ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-400">Token configurado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Seu bot está pronto para operar. Conecte ao servidor na aba "Servidor".
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setBotToken("");
                  setShowToken(true);
                }}
                variant="outline"
                size="sm"
              >
                Alterar token
              </Button>
              <Button
                onClick={handleRemoveToken}
                disabled={savingToken}
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                {savingToken ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Remover token
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-400">Token não configurado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure o token para conectar o bot ao seu servidor e usar comandos.
                </p>
              </div>
            </div>

            <details className="group rounded-xl border border-border bg-muted/30 overflow-hidden">
              <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <Bot className="h-4 w-4 text-primary shrink-0" />
                Como obter o token do bot?
              </summary>
              <div className="px-4 pb-4 space-y-2 text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
                <p>1. Acesse o <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Discord Developer Portal</a></p>
                <p>2. Crie uma aplicação ou selecione a existente</p>
                <p>3. Vá em <strong className="text-foreground">Bot</strong> → clique em <strong className="text-foreground">Reset Token</strong></p>
                <p>4. Copie o token e cole abaixo</p>
                <p className="text-amber-400 mt-2">⚠️ Nunca compartilhe seu token com terceiros!</p>
              </div>
            </details>
          </div>
        )}

        {/* Token input (shown when no token or when changing) */}
        {(!hasToken || showToken) && (
          <div className="space-y-3 mt-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Bot Token</Label>
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="Cole o token do bot aqui..."
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleSaveToken}
                disabled={savingToken || !botToken.trim()}
                className="gradient-pink text-primary-foreground border-none hover:opacity-90"
              >
                {savingToken ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Salvar token
              </Button>
              {hasToken && (
                <Button variant="outline" onClick={() => { setShowToken(false); setBotToken(""); }}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bot Customization Section */}
      <div className="wallet-section">
        <div className="wallet-section-header mb-5">
          <div className="wallet-section-icon">
            <Palette className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-display font-semibold text-sm">Personalização do Bot</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Altere o nome e o avatar que o bot exibe nas mensagens do Discord
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Preview */}
          <div className="rounded-xl bg-[#313338] p-4">
            <div className="flex items-start gap-3">
              {botAvatarUrl ? (
                <img src={botAvatarUrl} alt="Bot avatar" className="h-10 w-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {botName || "Drika Bot"}
                  </span>
                  <span className="text-[10px] bg-[#5865F2] text-white px-1.5 py-0.5 rounded font-medium">BOT</span>
                </div>
                <p className="text-[#dcddde] text-xs mt-1">Olá! Aqui está seu pedido 🎉</p>
              </div>
            </div>
          </div>

          {/* Bot Name */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Nome do Bot</Label>
            <Input
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Drika Bot"
              maxLength={32}
            />
            <p className="text-[11px] text-muted-foreground">
              Nome exibido nas mensagens via webhook. Máx. 32 caracteres.
            </p>
          </div>

          {/* Bot Avatar */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wider">Avatar do Bot</Label>
            <div className="flex items-center gap-3">
              {botAvatarUrl ? (
                <div className="relative">
                  <img src={botAvatarUrl} alt="Avatar" className="h-16 w-16 rounded-full object-cover border-2 border-border" />
                  <button
                    onClick={() => setBotAvatarUrl("")}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center"
                  >
                    <X className="h-3 w-3 text-destructive-foreground" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 rounded-full bg-muted/50 border-2 border-dashed border-border flex items-center justify-center">
                  <Bot className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-2 flex-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Fazer upload
                </Button>
                <Input
                  value={botAvatarUrl}
                  onChange={(e) => setBotAvatarUrl(e.target.value)}
                  placeholder="https://... ou faça upload"
                  className="text-sm"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Imagem quadrada recomendada (128x128 ou maior). Usado nas mensagens via webhook.
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="gradient-pink text-primary-foreground border-none hover:opacity-90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Salvar personalização
          </Button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} />
    </div>
  );
};

export default SettingsBotCustomizationTab;
