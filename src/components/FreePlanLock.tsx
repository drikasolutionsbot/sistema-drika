import { Crown, Lock, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openUpgradeModal } from "@/components/ProUpgradeModal";

interface FreePlanLockProps {
  /** Nome amigável da seção bloqueada (ex.: "Loja", "Personalização do Bot") */
  feature?: string;
}

const FEATURES = [
  "Cadastrar produtos e vender no Discord",
  "Personalizar nome, avatar e cores do bot",
  "Embeds, cupons, sorteios e tickets",
  "Estoque, automações, IA e proteção",
  "Marketplace e recursos premium",
];

const FreePlanLock = ({ feature }: FreePlanLockProps) => {
  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 animate-fade-in">
      {/* Glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px] animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div className="relative max-w-xl w-full">
        <div className="relative rounded-3xl border border-primary/20 bg-card/60 backdrop-blur-2xl p-8 md:p-10 shadow-2xl overflow-hidden animate-scale-in">
          {/* Top gradient bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse" />
              <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/40">
                <Lock className="h-10 w-10 text-primary-foreground" />
              </div>
            </div>
          </div>

          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              Recurso Premium
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              {feature ? `${feature} bloqueado` : "Esta área é exclusiva para planos pagos"}
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              O plano <strong>Free</strong> permite apenas acessar o painel. Para usar todos os
              recursos do Drika Hub, faça upgrade para <strong>Pro</strong> ou <strong>Master</strong>.
            </p>
          </div>

          {/* Features list */}
          <div className="space-y-2 mb-7">
            {FEATURES.map((f, i) => (
              <div
                key={f}
                className="flex items-center gap-3 text-sm text-foreground/90 animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="h-6 w-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                  <Zap className="h-3 w-3 text-primary" />
                </div>
                <span>{f}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={() => openUpgradeModal("pro")}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold h-12 shadow-lg shadow-emerald-500/30"
            >
              <Crown className="h-4 w-4 mr-2" />
              Assinar Pro
            </Button>
            <Button
              onClick={() => openUpgradeModal("master")}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-bold h-12 shadow-lg shadow-primary/30"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Assinar Master
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-4">
            Ativação automática via PIX em segundos.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FreePlanLock;
