import { useState, useRef, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant } from "@/contexts/TenantContext";
import { Bot, Pencil, ImageIcon, Lock, Crown, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EditBotProfileModal from "@/components/settings/EditBotProfileModal";
import { isMaster } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const BotCustomizationPage = () => {
  const { tenant, tenantId, refetch } = useTenant();
  const [editOpen, setEditOpen] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
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
    try {
      const safeExt = extOk ? ext : "png";
      const path = `${tenantId}/bot-banner/${crypto.randomUUID()}.${safeExt}`;
      const { error: upErr } = await supabase.storage
        .from("tenant-assets")
        .upload(path, file, {
          upsert: true,
          contentType: mimeOk ? file.type : `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
        });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("tenant-assets").getPublicUrl(path);

      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: { tenant_id: tenantId, updates: { bot_banner_url: pub.publicUrl } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetch();
      toast({ title: "Capa aplicada! ✅" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar capa", description: err.message, variant: "destructive" });
    } finally {
      setUploadingBanner(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Personalização</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure o <strong className="text-foreground">{botName}</strong> para o seu estilo.
        </p>
      </div>

      {/* Hero Card */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-card min-h-[280px]">
        {/* Banner background */}
        {botBanner ? (
          <div className="absolute inset-0">
            <img
              src={botBanner}
              alt="Capa do bot"
              className={`w-full h-full object-cover ${!userIsMaster ? "blur-md scale-110" : ""}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-card/40" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted/40 to-card" />
        )}

        {/* Master lock overlay for non-master users with banner */}
        {botBanner && !userIsMaster && (
          <div className="absolute top-3 left-3 z-10">
            <Badge variant="outline" className="gap-1 bg-background/80 backdrop-blur-sm border-primary/40 text-primary">
              <Lock className="h-3 w-3" />
              <Crown className="h-3 w-3" />
              Master
            </Badge>
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
            <Badge
              variant="outline"
              className="gap-1 bg-background/80 backdrop-blur-sm border-primary/40 text-primary cursor-help"
              title="Disponível apenas no plano Master"
            >
              <Crown className="h-3 w-3" />
              Capa Master
            </Badge>
          )}
        </div>

        {/* Foreground content */}
        <div className="relative flex flex-col items-center pt-16 pb-8 gap-3">
          {/* Avatar */}
          <div className="relative">
            {botAvatar ? (
              <img
                src={botAvatar}
                alt="Bot avatar"
                className="h-24 w-24 rounded-full object-cover border-4 border-card shadow-xl"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-muted border-4 border-card shadow-xl flex items-center justify-center">
                <Bot className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-emerald-500 border-[3px] border-card" />
          </div>

          {/* Name */}
          <h2 className="text-xl font-bold text-foreground drop-shadow-lg">{botName}</h2>

          {/* Edit Button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 mt-1 bg-background/60 backdrop-blur-sm"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar Perfil
          </Button>
        </div>

        {/* Hidden file input */}
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleBannerUpload(file);
            if (bannerInputRef.current) bannerInputRef.current.value = "";
          }}
        />
      </div>

      {/* Informações Card */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Informações</h3>
          <p className="text-xs text-muted-foreground">Dados da aplicação.</p>
        </div>
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">Nome da Aplicação</span>
            <span className="text-sm font-semibold text-foreground">{botName}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">ID da Aplicação</span>
            <span className="text-sm font-mono text-foreground">{botId}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className="text-sm font-semibold text-emerald-400">Online</span>
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
    </div>
  );
};

export default BotCustomizationPage;
