import { useEffect } from "react";
import { Check, Zap } from "lucide-react";

interface Props {
  amount: string;
  pixKey: string;
  onClose: () => void;
}

export const PixSuccessAnimation = ({ amount, pixKey, onClose }: Props) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3800);
    return () => clearTimeout(t);
  }, [onClose]);

  // 18 confetti pieces with random positions/colors
  const confetti = Array.from({ length: 18 }, (_, i) => i);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md bg-background/80 animate-fade-in"
      onClick={onClose}
    >
      {/* Radial pulse rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="pix-ring pix-ring-1" />
        <div className="pix-ring pix-ring-2" />
        <div className="pix-ring pix-ring-3" />
      </div>

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((i) => (
          <span
            key={i}
            className="pix-confetti"
            style={{
              left: `${(i * 53) % 100}%`,
              animationDelay: `${(i % 6) * 0.08}s`,
              background: i % 3 === 0
                ? "hsl(var(--primary))"
                : i % 3 === 1
                ? "hsl(142 76% 50%)"
                : "hsl(48 96% 60%)",
            }}
          />
        ))}
      </div>

      {/* Main card */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-8 py-10 rounded-3xl border border-primary/30 bg-card/90 shadow-2xl shadow-primary/30 animate-scale-in max-w-md mx-4">
        {/* Animated check */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/30 blur-2xl pix-glow" />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center pix-bounce">
            <Check className="w-12 h-12 text-primary-foreground stroke-[3]" strokeDasharray="40" strokeDashoffset="0" style={{ animation: "pix-draw 0.6s 0.2s ease-out both" }} />
          </div>
          {/* Lightning sparks */}
          <Zap className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 fill-yellow-400 pix-spark" style={{ animationDelay: "0.4s" }} />
          <Zap className="absolute -bottom-1 -left-3 w-5 h-5 text-yellow-400 fill-yellow-400 pix-spark" style={{ animationDelay: "0.6s" }} />
        </div>

        <div className="text-center space-y-1">
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-bold">
            PIX Enviado
          </div>
          <div className="text-4xl font-black bg-gradient-to-r from-primary via-foreground to-primary bg-clip-text text-transparent pix-shimmer">
            R$ {amount}
          </div>
          <div className="text-xs text-muted-foreground pt-1 max-w-[260px] truncate">
            Para: <span className="font-mono">{pixKey}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Saldo debitado · Comprovante disponível
        </div>
      </div>

      <style>{`
        @keyframes pix-ring-pulse {
          0% { transform: scale(0.4); opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes pix-bounce-in {
          0% { transform: scale(0) rotate(-180deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes pix-draw {
          from { stroke-dashoffset: 40; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes pix-glow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
        @keyframes pix-spark {
          0% { transform: scale(0) rotate(0deg); opacity: 0; }
          50% { transform: scale(1.3) rotate(20deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes pix-confetti-fall {
          0% { transform: translateY(-20vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
        }
        @keyframes pix-shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .pix-ring {
          position: absolute;
          border-radius: 9999px;
          border: 2px solid hsl(var(--primary));
          width: 200px;
          height: 200px;
          animation: pix-ring-pulse 1.8s ease-out infinite;
        }
        .pix-ring-2 { animation-delay: 0.3s; }
        .pix-ring-3 { animation-delay: 0.6s; }
        .pix-bounce { animation: pix-bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .pix-glow { animation: pix-glow 1.6s ease-in-out infinite; }
        .pix-spark { animation: pix-spark 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .pix-confetti {
          position: absolute;
          top: -20px;
          width: 8px;
          height: 14px;
          border-radius: 2px;
          animation: pix-confetti-fall 2.4s cubic-bezier(0.4, 0.2, 0.6, 1) forwards;
        }
        .pix-shimmer {
          background-size: 200% auto;
          animation: pix-shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
