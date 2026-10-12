import { useState } from "react";
import { User, Copy, CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck, Lock, ExternalLink, Sparkles, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";

// Discord SVG Icon
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

interface Props {
  tenant?: any;
  tenantId?: string | null;
}

const SettingsDiscordProfileTab = ({ tenant: propTenant }: Props) => {
  const { user, signInWithDiscord } = useAuth();
  const { tenant: ctxTenant } = useTenant();
  const currentTenant = propTenant || ctxTenant;

  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

  // Get token from localStorage session or tenant
  let activeToken = currentTenant?.token || currentTenant?.access_token || "";
  if (!activeToken) {
    try {
      const s = localStorage.getItem("token_session");
      if (s) {
        const parsed = JSON.parse(s);
        activeToken = parsed.token || "";
      }
    } catch {}
  }

  // Discord profile info resolution
  const userMeta = user?.user_metadata || {};
  const isDiscordAuth = user?.app_metadata?.provider === "discord" || !!userMeta?.provider_id;

  const discordUsername =
    userMeta?.full_name ||
    userMeta?.name ||
    userMeta?.user_name ||
    userMeta?.custom_claims?.global_name ||
    currentTenant?.owner_discord_username ||
    "Usuário Discord";

  const discordHandle = userMeta?.user_name || userMeta?.name || currentTenant?.owner_discord_username || "";
  const discordId = userMeta?.provider_id || userMeta?.sub || currentTenant?.owner_discord_id || null;
  const discordAvatar = userMeta?.avatar_url || null;
  const discordEmail = user?.email || userMeta?.email || currentTenant?.email || null;

  const handleCopyToken = () => {
    if (!activeToken) {
      toast({ title: "Nenhum token encontrado", description: "O token ainda não foi carregado.", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(activeToken);
    setTokenCopied(true);
    toast({
      title: "✅ Token copiado com sucesso!",
      description: "Guarde seu token em segurança para acessar o painel.",
    });
    setTimeout(() => setTokenCopied(false), 2500);
  };

  const handleCopyDiscordId = () => {
    if (!discordId) return;
    navigator.clipboard.writeText(String(discordId));
    setIdCopied(true);
    toast({ title: "ID copiado!", description: `ID ${discordId} copiado.` });
    setTimeout(() => setIdCopied(false), 2500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ===== CARD 1: PERFIL DO DISCORD ===== */}
      <div className="relative overflow-hidden rounded-2xl border border-[#5865F2]/25 bg-gradient-to-b from-[#5865F2]/[0.08] via-card/70 to-card/90 backdrop-blur-xl shadow-xl p-6 group">
        {/* Glow Decorativo */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-gradient-to-br from-[#5865F2]/25 to-purple-500/20 rounded-full blur-[80px] pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-700" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/50">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl shadow-inner border bg-[#5865F2]/15 border-[#5865F2]/30 text-[#5865F2] shrink-0">
                <DiscordIcon className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold tracking-tight text-foreground">Perfil do Discord</h3>
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 gap-1 text-[11px] font-semibold py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {isDiscordAuth ? "Conectado" : "Vinculado"}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Sua conta do Discord associada a esta loja
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => signInWithDiscord()}
              className="border-[#5865F2]/30 hover:bg-[#5865F2]/10 hover:text-white text-xs gap-1.5 self-start sm:self-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reconectar Discord
            </Button>
          </div>

          {/* User Info Grid */}
          <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Avatar & Display Name */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-background/50 border border-border/50 shadow-sm md:col-span-1">
              <div className="relative shrink-0">
                {discordAvatar ? (
                  <img
                    src={discordAvatar}
                    alt={discordUsername}
                    className="h-16 w-16 rounded-2xl object-cover border-2 border-[#5865F2]/40 shadow-[0_0_15px_rgba(88,101,242,0.25)]"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-[#5865F2]/20 border-2 border-[#5865F2]/40 flex items-center justify-center text-[#5865F2] font-black text-xl shadow-[0_0_15px_rgba(88,101,242,0.25)]">
                    {discordUsername.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-background" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-foreground truncate">{discordUsername}</p>
                {discordHandle && (
                  <p className="text-xs text-[#5865F2] font-medium truncate mt-0.5">@{discordHandle}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" /> Dono da Loja
                </p>
              </div>
            </div>

            {/* Discord ID & Copy */}
            <div className="p-4 rounded-xl bg-background/50 border border-border/50 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ID do Discord</p>
                <p className="font-mono text-sm text-foreground font-semibold mt-1 truncate">
                  {discordId || "Não identificado"}
                </p>
              </div>

              {discordId && (
                <div className="pt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCopyDiscordId}
                    className="w-full h-8 text-xs gap-1.5 bg-muted/60 hover:bg-muted"
                  >
                    {idCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {idCopied ? "ID Copiado!" : "Copiar ID"}
                  </Button>
                </div>
              )}
            </div>

            {/* Email da Conta */}
            <div className="p-4 rounded-xl bg-background/50 border border-border/50 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">E-mail Vinculado</p>
                <p className="text-sm text-foreground font-medium mt-1 truncate">
                  {discordEmail || "—"}
                </p>
              </div>

              <div className="pt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3 text-primary shrink-0" />
                Autenticado via OAuth2
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== CARD 2: TOKEN DE ACESSO DO CLIENTE ===== */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/[0.06] via-card/70 to-card/90 backdrop-blur-xl shadow-xl p-6 group">
        {/* Glow Decorativo */}
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-gradient-to-tr from-primary/20 to-pink-500/15 rounded-full blur-[80px] pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-700" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl shadow-inner border bg-primary/10 border-primary/25 text-primary shrink-0">
              <KeyRound className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold tracking-tight text-foreground">Token de Acesso ao Painel</h3>
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                  Chave Mestra
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Use este token para acessar seu painel diretamente em qualquer dispositivo sem precisar de senha
              </p>
            </div>
          </div>

          {/* Token Box with Copy Button */}
          <div className="mt-4 rounded-xl border border-border/60 bg-background/80 p-4 sm:p-5 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Seu Token Exclusivo
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors bg-transparent border-none cursor-pointer font-medium"
                  >
                    {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{showToken ? "Ocultar" : "Mostrar"}</span>
                  </button>
                </div>

                <div className="font-mono text-sm sm:text-base font-semibold text-foreground tracking-wide select-all break-all py-1.5 px-3 rounded-lg bg-muted/40 border border-border/40">
                  {activeToken ? (
                    showToken ? (
                      activeToken
                    ) : (
                      "•".repeat(Math.min(activeToken.length, 36))
                    )
                  ) : (
                    <span className="text-muted-foreground italic text-xs">Carregando token...</span>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center pt-2 sm:pt-4">
                <Button
                  onClick={handleCopyToken}
                  disabled={!activeToken}
                  className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm gap-2 shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all cursor-pointer"
                >
                  {tokenCopied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copiar Token</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Instructions Box */}
          <div className="mt-5 rounded-xl border border-border/40 bg-muted/20 p-4 flex items-start gap-3">
            <Lock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground">Como usar seu token para entrar:</p>
              <p className="mt-1">
                Ao acessar a tela de login (<span className="text-primary font-mono">drikahub.com/login</span>), clique na opção <strong>"Já tenho um token"</strong> e cole o código acima para ter acesso instantâneo ao seu painel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsDiscordProfileTab;
