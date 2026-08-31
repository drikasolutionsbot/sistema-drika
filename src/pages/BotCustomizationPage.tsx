import { useState, useRef, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/contexts/TenantContext";
import { Bot, Pencil, ImageIcon, Lock, Crown, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EditBotProfileModal from "@/components/settings/EditBotProfileModal";
import BannerCropModal from "@/components/customization/BannerCropModal";
import { openUpgradeModal } from "@/components/ProUpgradeModal";
import { isMaster } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const BotCustomizationPage = () => {
  const { tenant, tenantId, refetch, globalBotBanner } = useTenant();
  const [editOpen, setEditOpen] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Cleanup do object URL quando o preview muda/desmonta
  useEffect(() => {
    return () => {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerPreview]);

  if (!tenant) return <Skeleton className="h-64" />;

  const botName = tenant.bot_name || "Drika Bot";
  const botAvatar = tenant.bot_avatar_url;
  const botBanner = (tenant as any).bot_banner_url as string | null;
  const effectiveBanner = botBanner || globalBotBanner;
  const userIsMaster = isMaster((tenant as any).plan);

  const botId = (tenant as any).discord_bot_id || tenant.id;

  const ALLOWED_BANNER_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
  const ALLOWED_BANNER_EXTS = ["jpg", "jpeg", "png", "webp"];
  const MAX_BANNER_MB = 8;

  const handleBannerUpload = async (file: File) => {
    if (!tenantId || !userIsMaster) return;

    // Validação de tipo (MIME + extensão como fallback)
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const mimeOk = (ALLOWED_BANNER_TYPES as readonly string[]).includes(file.type);
    const extOk = ALLOWED_BANNER_EXTS.includes(ext);
    if (!mimeOk && !extOk) {
      toast({
        title: "Formato inválido",
        description: "Envie uma imagem JPG, PNG ou WebP.",
        variant: "destructive",
      });
      return;
    }

    // Validação de tamanho
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_BANNER_MB) {
      toast({
        title: "Imagem muito grande",
        description: `A capa deve ter no máximo ${MAX_BANNER_MB}MB (atual: ${sizeMb.toFixed(1)}MB).`,
        variant: "destructive",
      });
      return;
    }
    if (file.size === 0) {
      toast({ title: "Arquivo vazio", description: "Selecione uma imagem válida.", variant: "destructive" });
      return;
    }

    // Preview imediato
    const localUrl = URL.createObjectURL(file);
    setBannerPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return localUrl;
    });

    setUploadingBanner(true);
    let stage: "upload" | "publicUrl" | "update" | "refetch" = "upload";
    try {
      const safeExt = extOk ? ext : "png";
      const path = `${tenantId}/bot-banner/${crypto.randomUUID()}.${safeExt}`;

      // 1) Upload no Storage
      stage = "upload";
      const { error: upErr } = await supabase.storage
        .from("tenant-assets")
        .upload(path, file, {
          upsert: true,
          contentType: mimeOk ? file.type : `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
        });
      if (upErr) {
        const msg = (upErr.message || "").toLowerCase();
        if (msg.includes("exceeded") || msg.includes("size")) {
          throw new Error(`Arquivo excede o limite do servidor (${MAX_BANNER_MB}MB).`);
        }
        if (msg.includes("mime") || msg.includes("type")) {
          throw new Error("Tipo de arquivo não permitido pelo servidor. Use JPG, PNG ou WebP.");
        }
        if (msg.includes("permission") || msg.includes("not authorized") || msg.includes("rls")) {
          throw new Error("Sem permissão para enviar no storage. Verifique seu login.");
        }
        throw new Error(`Falha no upload: ${upErr.message}`);
      }

      // 2) URL pública
      stage = "publicUrl";
      const { data: pub } = supabase.storage.from("tenant-assets").getPublicUrl(path);
      if (!pub?.publicUrl) {
        throw new Error("Não foi possível gerar a URL pública da capa.");
      }

      // 3) Atualizar tenant via edge function
      stage = "update";
      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: { tenant_id: tenantId, updates: { bot_banner_url: pub.publicUrl } },
      });

      // Tratar rate-limit do Discord (429) — edge function ainda salvou a URL no DB
      if (error) {
        let bannerRateLimited = false;
        let retryAfterSec: number | null = null;
        let friendlyMsg = error.message || "erro desconhecido";
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            if (body?.error === "BANNER_RATE_LIMIT") {
              bannerRateLimited = true;
              friendlyMsg = body.message || friendlyMsg;
              if (typeof body.retry_after === "number") retryAfterSec = body.retry_after;
            }
          }
        } catch (_) { /* ignore */ }

        if (bannerRateLimited) {
          const waitTxt =
            retryAfterSec && retryAfterSec > 0
              ? retryAfterSec >= 60
                ? `cerca de ${Math.ceil(retryAfterSec / 60)} min`
                : `cerca de ${Math.ceil(retryAfterSec)}s`
              : "alguns minutos";
          toast({
            title: "⏳ Aguarde para trocar a capa novamente",
            description: `O Discord limita quantas vezes a capa do bot pode ser alterada em sequência. Sua nova imagem já foi salva ✅ — ela será aplicada automaticamente em ${waitTxt}. Não precisa reenviar.`,
          });
          // Mantém o preview como confirmação visual e encerra sem lançar erro
          setUploadingBanner(false);
          if (bannerInputRef.current) bannerInputRef.current.value = "";
          return;
        }
        throw new Error(`Não foi possível salvar a capa no servidor: ${friendlyMsg}.`);
      }
      if (data?.error) {
        throw new Error(`Servidor recusou a atualização: ${data.error}`);
      }

      // 4) Refetch (não é fatal se falhar)
      stage = "refetch";
      try {
        await refetch();
      } catch (refetchErr) {
        console.warn("[bot-banner] refetch falhou após update bem-sucedido:", refetchErr);
        toast({
          title: "Capa salva, recarregue a página",
          description: "A imagem foi aplicada, mas não conseguimos atualizar a tela automaticamente.",
        });
      }

      setBannerPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      toast({ title: "Capa aplicada! ✅", description: "Sua nova capa já está ativa no Discord." });
    } catch (err: any) {
      console.error("[bot-banner] erro no estágio", stage, err);

      // Descarta o preview para não enganar o usuário
      setBannerPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

      const stageLabel: Record<typeof stage, string> = {
        upload: "Falha ao enviar a imagem",
        publicUrl: "Falha ao processar a imagem",
        update: "Falha ao salvar no perfil do bot",
        refetch: "Falha ao atualizar a tela",
      };

      toast({
        title: stageLabel[stage],
        description:
          err?.message?.toString().slice(0, 220) ||
          "Tente novamente em alguns instantes. Se persistir, verifique sua conexão.",
        variant: "destructive",
      });
    } finally {
      // GARANTIA: botão nunca trava
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Personalização</h1>
        <p className="text-muted-foreground text-sm">
          Configure a identidade visual do <strong className="text-foreground">{botName}</strong> no Discord.
        </p>
      </div>

      {/* Hero Card - Discord Profile Style */}
      <div className="relative rounded-[24px] overflow-hidden border border-border/50 bg-card shadow-xl min-h-[340px] group transition-all duration-300 hover:border-primary/30">
        {/* Banner background (preview tem prioridade) */}
        {(bannerPreview || effectiveBanner) ? (
          <div className="absolute inset-0">
            <img
              src={bannerPreview || effectiveBanner!}
              alt="Capa do bot"
              className={`w-full h-full object-cover transition-all duration-500 ${
                !userIsMaster && effectiveBanner && !bannerPreview ? "blur-xl scale-110 opacity-60" : "group-hover:scale-[1.02]"
              } ${uploadingBanner ? "opacity-50 blur-sm" : "opacity-100"}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted/40 to-background" />
        )}

        {/* Overlay de upload em andamento */}
        {uploadingBanner && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 rounded-full bg-background/80 px-4 py-2 border border-border shadow-lg">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs font-semibold text-foreground">Enviando nova capa...</span>
            </div>
          </div>
        )}

        {/* Master lock overlay for non-master users with banner */}
        {botBanner && !userIsMaster && (
          <div className="absolute top-3 left-3 z-10">
            <button
              type="button"
              onClick={() => openUpgradeModal("master")}
              className="group focus:outline-none focus:ring-2 focus:ring-primary/60 rounded-full"
              title="Assinar plano Master"
            >
              <Badge
                variant="outline"
                className="gap-1 bg-background/80 backdrop-blur-sm border-primary/40 text-primary cursor-pointer transition-all group-hover:bg-primary/10 group-hover:border-primary/70"
              >
                <Lock className="h-3 w-3" />
                <Crown className="h-3 w-3" />
                Master
              </Badge>
            </button>
          </div>
        )}

        {/* Banner edit button (top-right) */}
        <div className="absolute top-3 right-3 z-10">
          {userIsMaster ? (
            <Button
              variant="secondary"
              size="sm"
              className="gap-2 bg-background/80 backdrop-blur-sm hover:bg-background"
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
            >
              {uploadingBanner ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : botBanner ? (
                <Pencil className="h-3.5 w-3.5" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {botBanner ? "Trocar Capa" : "Adicionar Capa"}
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => openUpgradeModal("master")}
              className="group focus:outline-none focus:ring-2 focus:ring-primary/60 rounded-full"
              title="Assinar plano Master para liberar capa personalizada"
            >
              <Badge
                variant="outline"
                className="gap-1 bg-background/80 backdrop-blur-sm border-primary/40 text-primary cursor-pointer transition-all group-hover:bg-primary/10 group-hover:border-primary/70"
              >
                <Crown className="h-3 w-3" />
                Capa Master
              </Badge>
            </button>
          )}
        </div>

        {/* Foreground content - aligned left like Discord embed */}
        <div className="relative flex flex-col items-start pt-24 pb-8 pl-8 sm:pl-12 gap-4 text-left h-full justify-end min-h-[340px]">
          {/* Avatar */}
          <div className="relative group/avatar cursor-pointer transition-transform hover:scale-105" onClick={() => setEditOpen(true)}>
            {botAvatar ? (
              <img
                src={botAvatar}
                alt="Bot avatar"
                className="h-28 w-28 rounded-full object-cover border-[6px] border-background shadow-2xl bg-muted"
              />
            ) : (
              <div className="h-28 w-28 rounded-full bg-muted border-[6px] border-background shadow-2xl flex items-center justify-center">
                <Bot className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            <div className="absolute bottom-1 right-1 h-6 w-6 rounded-full bg-emerald-500 border-[4px] border-background shadow-sm" />
            
            {/* Avatar Hover Edit Overlay */}
            <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
              <Pencil className="h-6 w-6 text-white" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {/* Name */}
            <h2 className="text-3xl font-display font-bold text-foreground drop-shadow-xl flex items-center gap-2">
              {botName}
              <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/30 text-[10px] px-2 py-0 h-5">BOT</Badge>
            </h2>
          </div>

          {/* Edit Button */}
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 mt-2 bg-background/80 hover:bg-background border border-border/50 shadow-sm backdrop-blur-md rounded-full px-5 transition-all hover:border-primary/50"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5 text-primary" />
            <span>Editar Perfil</span>
          </Button>
        </div>

        {/* Hidden file input — abre o modal de crop */}
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              // Validações rápidas antes de abrir o crop
              const sizeMb = file.size / (1024 * 1024);
              if (sizeMb > MAX_BANNER_MB) {
                toast({
                  title: "Imagem muito grande",
                  description: `A capa deve ter no máximo ${MAX_BANNER_MB}MB (atual: ${sizeMb.toFixed(1)}MB).`,
                  variant: "destructive",
                });
              } else {
                setCropFile(file);
                setCropOpen(true);
              }
            }
            if (bannerInputRef.current) bannerInputRef.current.value = "";
          }}
        />
      </div>

      {/* Informações Card */}
      <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm p-6 space-y-6 shadow-sm">
        <div>
          <h3 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Informações do Bot
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Detalhes técnicos da sua aplicação conectada.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-background/60 border border-border/50 rounded-xl p-4 flex flex-col gap-1.5 transition-colors hover:border-primary/30">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome da Aplicação</span>
            <span className="text-base font-semibold text-foreground truncate">{botName}</span>
          </div>
          <div className="bg-background/60 border border-border/50 rounded-xl p-4 flex flex-col gap-1.5 transition-colors hover:border-primary/30">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              ID da Aplicação
            </span>
            <span className="text-sm font-mono text-foreground/80 truncate" title={botId}>{botId}</span>
          </div>
          <div className="bg-background/60 border border-border/50 rounded-xl p-4 flex flex-col gap-1.5 transition-colors hover:border-emerald-500/30">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status do Bot</span>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-base font-semibold text-emerald-500">Online & Operante</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <EditBotProfileModal
        open={editOpen}
        onOpenChange={setEditOpen}
        tenant={tenant}
        tenantId={tenantId}
        refetchTenant={refetch}
      />

      {/* Banner Crop Modal */}
      <BannerCropModal
        open={cropOpen}
        onOpenChange={(o) => {
          setCropOpen(o);
          if (!o) setCropFile(null);
        }}
        file={cropFile}
        botName={botName}
        botAvatarUrl={botAvatar}
        onConfirm={async (croppedFile) => {
          await handleBannerUpload(croppedFile);
        }}
      />
    </div>
  );
};

export default BotCustomizationPage;
