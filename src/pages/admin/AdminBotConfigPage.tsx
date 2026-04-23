import { useState, useEffect, useRef } from "react";
import { Bot, Loader2, Upload, X, Check, Info, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const AdminBotConfigPage = () => {
  const [status, setStatus] = useState("/panel");
  const [bannerUrl, setBannerUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reapplying, setReapplying] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [loadingDesc, setLoadingDesc] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("landing_config")
        .select("id, global_bot_status, global_bot_banner_url")
        .limit(1)
        .single();
      if (data) {
        setConfigId(data.id);
        setStatus(data.global_bot_status || "/panel");
        setBannerUrl(data.global_bot_banner_url || "");
      }
      setLoading(false);

      // Carrega descrição atual da aplicação Discord
      try {
        const { data: descData } = await supabase.functions.invoke("get-bot-description");
        if (descData?.description !== undefined) {
          setDescription(descData.description || "");
        }
      } catch (e) {
        console.warn("Falha ao carregar descrição do bot", e);
      } finally {
        setLoadingDesc(false);
      }
    })();
  }, []);

  const handleSaveDescription = async () => {
    setSavingDesc(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-bot-description", {
        body: { description: description.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Descrição atualizada no Discord ✅",
        description: "A nova bio aparece no perfil do bot em todos os servidores. Pode levar alguns minutos para o Discord propagar o cache.",
      });
    } catch (err: any) {
      toast({ title: "Erro ao salvar descrição", description: err.message, variant: "destructive" });
    } finally {
      setSavingDesc(false);
    }
  };

  const handleForceReapply = async () => {
    if (!configId) {
      toast({ title: "Configuração não carregada", variant: "destructive" });
      return;
    }
    setReapplying(true);
    try {
      const { error } = await (supabase as any)
        .from("landing_config")
        .update({ global_bot_banner_force_reapply_at: new Date().toISOString() })
        .eq("id", configId);
      if (error) throw error;
      toast({
        title: "Reaplicação solicitada ✅",
        description: "O bot vai reaplicar o banner em até 15 segundos em todos os contextos suportados (perfil global, capa do app e perfil em cada servidor).",
      });
    } catch (err: any) {
      toast({ title: "Erro ao solicitar", description: err.message, variant: "destructive" });
    } finally {
      setReapplying(false);
    }
  };

  const handleUploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `global/bot-banner/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("tenant-assets")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
      setBannerUrl(data.publicUrl);
      toast({ title: "Banner enviado!" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: configs } = await (supabase as any)
        .from("landing_config")
        .select("id")
        .limit(1)
        .single();
      if (!configs?.id) throw new Error("Config não encontrada");

      const { error } = await (supabase as any)
        .from("landing_config")
        .update({
          global_bot_status: status.trim() || "/panel",
          global_bot_banner_url: bannerUrl.trim() || null,
        })
        .eq("id", configs.id);
      if (error) throw error;
      toast({ title: "Configuração global salva! ✅" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Configuração Global do Bot</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurações que se aplicam globalmente ao bot externo, compartilhadas entre todos os servidores.
        </p>
      </div>

      <div className="rounded-lg bg-muted/30 border border-border p-3 flex items-start gap-3">
        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Essas configurações afetam o bot em <strong>todos</strong> os servidores. O status e o banner são globais
          porque o Discord permite apenas uma identidade por bot.
        </p>
      </div>

      {/* Status */}
      <div className="wallet-section space-y-4">
        <div className="wallet-section-header">
          <div className="wallet-section-icon">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-display font-semibold text-sm">Status do Bot</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Texto exibido como "Jogando" no Discord
            </p>
          </div>
        </div>

        <Textarea
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          rows={3}
          className="resize-none font-mono text-sm"
          placeholder={"/panel\nDrika Solutions"}
        />
        <p className="text-[11px] text-muted-foreground">
          Um status por linha. O bot alterna automaticamente entre eles. Sincronizado a cada 15 segundos.
        </p>
      </div>

      {/* Banner */}
      <div className="wallet-section space-y-4">
        <div className="wallet-section-header">
          <div className="wallet-section-icon">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-display font-semibold text-sm">Banner / Capa do Bot</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Capa exibida no perfil do bot (global, não personalizável por servidor)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {bannerUrl ? (
            <div className="relative">
              <img src={bannerUrl} alt="Banner" className="h-20 w-40 rounded-lg object-cover border border-border" />
              <button
                onClick={() => setBannerUrl("")}
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center"
              >
                <X className="h-3 w-3 text-destructive-foreground" />
              </button>
            </div>
          ) : (
            <div className="h-20 w-40 rounded-lg bg-muted/50 border-2 border-dashed border-border flex items-center justify-center">
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
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://... ou faça upload"
              className="text-sm"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Imagem 600x240 recomendada. Aplicada diretamente no perfil do bot no Discord.
        </p>
      </div>

      {/* Descrição (Bio) — global da aplicação Discord */}
      <div className="wallet-section space-y-4">
        <div className="wallet-section-header">
          <div className="wallet-section-icon">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground font-display font-semibold text-sm">Descrição / Bio do Bot</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Texto exibido em "Sobre Mim" no perfil do bot no Discord
            </p>
          </div>
        </div>

        {loadingDesc ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando descrição atual...
          </div>
        ) : (
          <>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 400))}
              rows={5}
              className="resize-none text-sm"
              placeholder="DRIKA HUB - O melhor bot de vendas automáticas para Discord..."
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                Aplicada via API do Discord — atualiza em todos os servidores instantaneamente.
              </p>
              <span className={`text-[11px] tabular-nums ${description.length > 380 ? "text-destructive" : "text-muted-foreground"}`}>
                {description.length}/400
              </span>
            </div>
            <Button
              onClick={handleSaveDescription}
              disabled={savingDesc}
              size="sm"
              className="gradient-pink text-primary-foreground border-none hover:opacity-90"
            >
              {savingDesc ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Check className="h-3.5 w-3.5 mr-2" />}
              Salvar descrição no Discord
            </Button>
          </>
        )}
      </div>


        <Button
          onClick={handleSave}
          disabled={saving}
          className="gradient-pink text-primary-foreground border-none hover:opacity-90"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
          Salvar configuração global
        </Button>

        <Button
          onClick={handleForceReapply}
          disabled={reapplying || !bannerUrl}
          variant="outline"
          className="gap-2"
          title={!bannerUrl ? "Configure um banner primeiro" : "Força o bot a reaplicar o banner em todos os contextos"}
        >
          {reapplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Aplicar banner em todas as áreas
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground -mt-3">
        O botão acima força o bot externo a reexecutar a aplicação do banner em até 15 segundos:
        perfil global do usuário, capa do aplicativo e perfil de membro em cada servidor.
        Útil quando o Discord aparenta estar com a versão antiga em cache.
      </p>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadBanner} />
    </div>
  );
};

export default AdminBotConfigPage;
