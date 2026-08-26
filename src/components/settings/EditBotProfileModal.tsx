import { useState, useRef, useEffect } from "react";
import { Loader2, Bot, Upload, Lock, Crown, ImageIcon, X, AlertTriangle, Clock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { isMaster } from "@/lib/plans";

// Cooldown em segundos
const NAME_AVATAR_COOLDOWN_S = 0;
// Cooldown de capa
const BANNER_COOLDOWN_S = 0;

function getCooldownKey(tenantId: string) {
  return `bot_profile_cooldown_${tenantId}`;
}

function loadCooldown(tenantId: string): { savedAt: number; type: "full" | "banner" } | null {
  try {
    const raw = localStorage.getItem(getCooldownKey(tenantId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveCooldown(tenantId: string, type: "full" | "banner") {
  localStorage.setItem(getCooldownKey(tenantId), JSON.stringify({ savedAt: Date.now(), type }));
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: any;
  tenantId: string | null;
  refetchTenant: () => void;
}

const EditBotProfileModal = ({ open, onOpenChange, tenant, tenantId, refetchTenant }: Props) => {
  const [botName, setBotName] = useState(tenant?.bot_name || "");
  const [botAvatarUrl, setBotAvatarUrl] = useState(tenant?.bot_avatar_url || "");
  const [botBannerUrl, setBotBannerUrl] = useState(tenant?.bot_banner_url || "");

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  // Cooldown state
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0);
  const [cooldownType, setCooldownType] = useState<"full" | "banner" | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userIsMaster = isMaster(tenant?.plan);

  // Re-sync on modal open
  useEffect(() => {
    if (open) {
      setBotName(tenant?.bot_name || "");
      setBotAvatarUrl(tenant?.bot_avatar_url || "");
      setBotBannerUrl(tenant?.bot_banner_url || "");
    }
  }, [open, tenant?.bot_name, tenant?.bot_avatar_url, tenant?.bot_banner_url]);

  // Initialize cooldown timer
  useEffect(() => {
    if (!tenantId || !open) return;

    const startTimer = () => {
      const stored = loadCooldown(tenantId);
      if (!stored) { setCooldownSecondsLeft(0); setCooldownType(null); return; }

      const limit = stored.type === "full" ? NAME_AVATAR_COOLDOWN_S : BANNER_COOLDOWN_S;
      const elapsed = Math.floor((Date.now() - stored.savedAt) / 1000);
      const remaining = limit - elapsed;

      if (remaining <= 0) {
        localStorage.removeItem(getCooldownKey(tenantId));
        setCooldownSecondsLeft(0);
        setCooldownType(null);
        return;
      }

      setCooldownSecondsLeft(remaining);
      setCooldownType(stored.type);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCooldownSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            localStorage.removeItem(getCooldownKey(tenantId));
            setCooldownType(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [open, tenantId]);

  const handleUpload = async (file: File, kind: "avatar" | "banner") => {
    if (!tenantId) return;
    const setUploading = kind === "avatar" ? setUploadingAvatar : setUploadingBanner;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const subdir = kind === "avatar" ? "bot-avatar" : "bot-banner";
      const path = `${tenantId}/${subdir}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("tenant-assets")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
      if (kind === "avatar") setBotAvatarUrl(data.publicUrl);
      else setBotBannerUrl(data.publicUrl);
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    if (cooldownSecondsLeft > 0) return; // guard extra

    setSaving(true);
    try {
      const updates: Record<string, any> = {
        bot_name: botName.trim() || null,
        bot_avatar_url: botAvatarUrl.trim() || null,
      };
      const changedBanner = userIsMaster && botBannerUrl !== (tenant?.bot_banner_url || "");
      if (userIsMaster) {
        updates.bot_banner_url = botBannerUrl.trim() || null;
      }

      const { data, error } = await supabase.functions.invoke("update-tenant", {
        body: { tenant_id: tenantId, updates },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await refetchTenant();

      // Start cooldown — full (60 min) if name/avatar changed; banner-only (10 min) if only banner
      const nameOrAvatarChanged =
        botName.trim() !== (tenant?.bot_name || "") ||
        botAvatarUrl !== (tenant?.bot_avatar_url || "");
      const coolType: "full" | "banner" = nameOrAvatarChanged ? "full" : "banner";
      saveCooldown(tenantId, coolType);
      const coolSecs = coolType === "full" ? NAME_AVATAR_COOLDOWN_S : BANNER_COOLDOWN_S;
      setCooldownSecondsLeft(coolSecs);
      setCooldownType(coolType);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCooldownSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            localStorage.removeItem(getCooldownKey(tenantId));
            setCooldownType(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      toast({ title: "Perfil salvo! ✅", description: `Próxima alteração liberada em ${formatCountdown(coolSecs)}.` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isBlocked = cooldownSecondsLeft > 0;
  const cooldownLabel = cooldownType === "full"
    ? `Aguarde ${formatCountdown(cooldownSecondsLeft)} para alterar novamente`
    : `Aguarde ${formatCountdown(cooldownSecondsLeft)} para trocar a capa`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
        </DialogHeader>

        {/* Global cooldown banner */}
        {isBlocked && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2.5 -mb-1">
            <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-xs text-destructive/90 space-y-0.5 flex-1">
              <p className="font-semibold text-destructive">
                {cooldownType === "full"
                  ? "⏳ Alteração de nome/avatar bloqueada"
                  : "⏳ Troca de capa bloqueada"}
              </p>
              <p>
                Para proteger seu bot do bloqueio do Discord, aguarde{" "}
                <strong className="tabular-nums text-destructive font-bold">
                  {formatCountdown(cooldownSecondsLeft)}
                </strong>{" "}
                antes de salvar novamente.
              </p>
              <p className="text-destructive/60">
                O Discord bloqueia bots que excedem o rate-limit de perfil — isso pode afetar todos os servidores simultaneamente.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-5 py-2">
          {/* Avatar */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              Avatar do Bot
              {isBlocked && cooldownType === "full" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive/80 bg-destructive/10 border border-destructive/25 px-1.5 py-0.5 rounded-full">
                  <Lock className="h-2.5 w-2.5" /> Bloqueado
                </span>
              )}
            </Label>
            <div className={`flex items-center gap-4 transition-opacity ${isBlocked && cooldownType === "full" ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="shrink-0">
                {botAvatarUrl ? (
                  <img src={botAvatarUrl} alt="Avatar" className="h-16 w-16 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                    <Bot className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => avatarRef.current?.click()}
                disabled={uploadingAvatar || (isBlocked && cooldownType === "full")}
              >
                {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Escolher Imagem
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">PNG, JPG até 10MB</p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              Nome do Bot
              {isBlocked && cooldownType === "full" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive/80 bg-destructive/10 border border-destructive/25 px-1.5 py-0.5 rounded-full">
                  <Lock className="h-2.5 w-2.5" /> Bloqueado
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="Drika Bot"
                maxLength={32}
                disabled={isBlocked && cooldownType === "full"}
                className={isBlocked && cooldownType === "full" ? "opacity-50" : ""}
              />
              {isBlocked && cooldownType === "full" && (
                <div className="absolute inset-y-0 right-3 flex items-center">
                  <Clock className="h-4 w-4 text-destructive/60 animate-pulse" />
                </div>
              )}
            </div>

            {/* Rate-limit info (when NOT blocked) */}
            {!isBlocked && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/8 p-2.5 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-200/80 leading-relaxed space-y-0.5">
                  <p>
                    <strong className="text-amber-300">Discord limita ≈ 2 trocas de nome por hora.</strong>{" "}
                    Ao salvar, o painel bloqueará novas alterações por <strong>60 minutos</strong>.
                  </p>
                  <p className="text-amber-200/50">Exceder o limite pode bloquear o bot em todos os servidores.</p>
                </div>
              </div>
            )}
          </div>

          {/* Banner — exclusivo Master */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                Capa do Bot
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 gap-1 border-primary/40 text-primary bg-primary/10"
                >
                  <Crown className="h-2.5 w-2.5" />
                  Master
                </Badge>
                {isBlocked && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive/80 bg-destructive/10 border border-destructive/25 px-1.5 py-0.5 rounded-full">
                    <Lock className="h-2.5 w-2.5" /> Bloqueado
                  </span>
                )}
              </Label>
              {!userIsMaster && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Bloqueado
                </span>
              )}
            </div>

            <div className={`relative ${(!userIsMaster || isBlocked) ? "opacity-50 pointer-events-none select-none" : ""}`}>
              <div className="flex items-center gap-4">
                <div className="shrink-0 relative">
                  {botBannerUrl ? (
                    <>
                      <img src={botBannerUrl} alt="Capa" className="h-16 w-28 rounded-md object-cover border-2 border-border" />
                      <button
                        type="button"
                        onClick={() => setBotBannerUrl("")}
                        disabled={!userIsMaster || isBlocked}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                        aria-label="Remover capa"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <div className="h-16 w-28 rounded-md bg-muted flex items-center justify-center border-2 border-border">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => bannerRef.current?.click()}
                  disabled={uploadingBanner || !userIsMaster || isBlocked}
                >
                  {uploadingBanner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {botBannerUrl ? "Trocar Capa" : "Escolher Capa"}
                </Button>
              </div>
            </div>

            {!userIsMaster ? (
              <p className="text-[11px] text-muted-foreground">
                <Crown className="inline h-3 w-3 mr-1 text-primary" />
                Disponível apenas no plano <strong className="text-primary">Master</strong>.
              </p>
            ) : !isBlocked ? (
              <>
                <p className="text-[11px] text-muted-foreground">
                  PNG, JPG até 10MB. Recomendado 960×540px.
                  {botBannerUrl && " Clique no X para remover."}
                </p>
                <div className="rounded-md border border-amber-500/30 bg-amber-500/8 p-2.5 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-200/80 leading-relaxed space-y-0.5">
                    <p>
                      <strong className="text-amber-300">Aguarde ≥10 min entre trocas de capa.</strong>{" "}
                      Ao salvar, o painel bloqueará por <strong>10 minutos</strong>.
                    </p>
                    <p className="text-amber-200/50">
                      Trocas em excesso disparam backoff progressivo — pode bloquear avatar/nome/capa em todos os servidores.
                    </p>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-col items-stretch">
          {/* Cooldown progress bar */}
          {isBlocked && (
            <div className="w-full space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-destructive animate-pulse" />
                  Liberação em: <strong className="tabular-nums text-foreground">{formatCountdown(cooldownSecondsLeft)}</strong>
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {cooldownType === "full" ? "Protegendo nome + avatar" : "Protegendo capa"}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-destructive/60 rounded-full transition-all"
                  style={{
                    width: `${(cooldownSecondsLeft / (cooldownType === "full" ? NAME_AVATAR_COOLDOWN_S : BANNER_COOLDOWN_S)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || isBlocked}
              title={isBlocked ? cooldownLabel : undefined}
              className={`gap-2 ${isBlocked ? "opacity-50 cursor-not-allowed" : "gradient-pink text-primary-foreground border-none"}`}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isBlocked ? (
                <Clock className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isBlocked ? `Bloqueado (${formatCountdown(cooldownSecondsLeft)})` : "Salvar"}
            </Button>
          </div>
        </DialogFooter>

        <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file, "avatar");
          if (avatarRef.current) avatarRef.current.value = "";
        }} />
        <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file, "banner");
          if (bannerRef.current) bannerRef.current.value = "";
        }} />
      </DialogContent>
    </Dialog>
  );
};

export default EditBotProfileModal;
