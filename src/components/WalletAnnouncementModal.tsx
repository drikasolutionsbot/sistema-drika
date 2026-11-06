import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Sparkles, Zap, ShieldCheck, ArrowRight, Percent, CheckCircle2 } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";

const STORAGE_KEY_PREFIX = "drika_wallet_split_popup_v1";

export const WalletAnnouncementModal = () => {
  const { tenantId, tenant } = useTenant();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const storageKey = `${STORAGE_KEY_PREFIX}:${tenantId}`;
    const alreadySeenInSession = sessionStorage.getItem(storageKey);
    if (!alreadySeenInSession) {
      const timer = setTimeout(() => {
        setOpen(true);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [tenantId]);

  const handleClose = () => {
    if (tenantId) {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}:${tenantId}`, "true");
    }
    setOpen(false);
  };

  const handleGoToWallet = () => {
    if (tenantId) {
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}:${tenantId}`, "true");
    }
    setOpen(false);
    navigate("/wallet");
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-[440px] overflow-hidden rounded-2xl border border-primary/30 bg-[#0d0e12]/95 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_0_60px_rgba(236,72,153,0.2)]">
        {/* Ambient Glow Effects */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-64 rounded-full bg-primary/20 blur-[70px]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-44 w-44 rounded-full bg-emerald-500/10 blur-[60px]" />

        <DialogHeader className="relative z-10 flex flex-col items-center text-center space-y-2">
          {/* Drika Hub Official Logo */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary/25 blur-xl scale-125" />
            <img
              src={drikaLogo}
              alt="Drika Hub"
              className="relative h-12 sm:h-14 w-auto object-contain drop-shadow-[0_0_15px_rgba(236,72,153,0.4)]"
            />
          </div>

          {/* Launch Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm">
            <Sparkles className="h-3 w-3 animate-pulse" />
            Novo Sistema de Split & Carteira
          </div>

          <DialogTitle className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-white leading-snug">
            Pagamentos 100% via{" "}
            <span className="bg-gradient-to-r from-primary via-pink-400 to-purple-400 bg-clip-text text-transparent">
              Carteira Drika Hub
            </span>
          </DialogTitle>

          <DialogDescription className="text-xs text-muted-foreground max-w-sm leading-relaxed">
            Agora todas as vendas da sua loja no Discord são processadas automaticamente pela{" "}
            <strong className="text-white/90">Carteira Integrada Drika Hub</strong> — sem precisar configurar chaves de banco ou gateways externos!
          </DialogDescription>
        </DialogHeader>

        <div className="relative z-10 space-y-3 my-1">
          {/* Fee Highlight Card */}
          <div className="relative overflow-hidden rounded-xl border border-primary/35 bg-gradient-to-br from-primary/15 via-primary/[0.06] to-transparent p-3 text-center shadow-inner">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/90 mb-1 flex items-center justify-center gap-1">
              <Percent className="h-3 w-3" /> Taxa Oficial da Plataforma
            </p>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="font-display text-xl sm:text-2xl font-black text-white tracking-tight">
                R$ 1,00
              </span>
              <span className="font-display text-lg sm:text-xl font-extrabold text-primary">
                + 2% de taxa
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Desconto automático por transação aprovada via Split PIX
            </p>
          </div>

          {/* Key Benefits */}
          <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Zap className="h-3 w-3" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white/95">Checkout PIX Pronto para Vender</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Geração de QR Code PIX e entrega automática de estoque 24/7 direto no seu servidor.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/15 border border-primary/30 text-primary">
                <Wallet className="h-3 w-3" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white/95">Saldo & Saques PIX no Painel</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Acompanhe seu saldo em tempo real, extrato de vendas e solicite saques PIX na aba <strong>Carteira</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-500/15 border border-sky-500/30 text-sky-400">
                <ShieldCheck className="h-3 w-3" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-white/95">Segurança & Comprovante Oficial</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Todos os saques contam com comprovante PDF oficial no painel e aviso automático no Discord.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons (Mobile & Desktop friendly) */}
        <div className="relative z-10 flex flex-col sm:flex-row gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="w-full sm:flex-1 rounded-xl border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-xs sm:text-sm font-semibold h-10"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-400" />
            Entendi
          </Button>
          <Button
            type="button"
            onClick={handleGoToWallet}
            className="w-full sm:flex-1 rounded-xl gradient-pink text-primary-foreground font-semibold text-xs sm:text-sm h-10 shadow-[0_0_25px_rgba(236,72,153,0.35)] hover:opacity-95 transition-all gap-1.5"
          >
            <Wallet className="h-4 w-4" />
            Ver Minha Carteira
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletAnnouncementModal;

