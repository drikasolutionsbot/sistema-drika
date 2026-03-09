import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, AlertTriangle, ExternalLink, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import drikaLogo from "@/assets/DRIKA_HUB_SEM_FUNDO.png";

type Status = "success" | "error" | "warning";

function safeStatus(input: string | null): Status {
  if (input === "success" || input === "error" || input === "warning") return input;
  return "success";
}

const VerifyResultPage = () => {
  const [params] = useSearchParams();

  const status = safeStatus(params.get("status"));
  const title = params.get("title") || (status === "success" ? "Verificado com sucesso" : "Não foi possível verificar");
  const message = params.get("message") || "Você pode fechar esta aba e voltar ao Discord.";
  const logoUrl = params.get("logo") || drikaLogo;

  const ui = useMemo(() => {
    if (status === "success") {
      return {
        icon: <CheckCircle2 className="h-8 w-8 text-primary" />,
        badge: <Badge className="bg-primary text-primary-foreground">Verificado</Badge>,
      };
    }

    if (status === "warning") {
      return {
        icon: <AlertTriangle className="h-8 w-8 text-primary" />,
        badge: <Badge variant="outline">Atenção</Badge>,
      };
    }

    return {
      icon: <XCircle className="h-8 w-8 text-destructive" />,
      badge: <Badge variant="destructive">Erro</Badge>,
    };
  }, [status]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-card flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-border/60 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70 shadow-lg glow-pink">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <img
              src={logoUrl}
              alt="DRIKA HUB"
              className="h-10 w-auto"
              loading="eager"
            />
            {ui.badge}
          </div>

          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center">{ui.icon}</div>
            <CardTitle className="text-xl">{title}</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{message}</p>

          <div className="flex flex-col gap-2">
            <Button asChild className="w-full gap-2">
              <a href="https://discord.com/channels/@me" target="_blank" rel="noreferrer">
                Voltar ao Discord
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => window.close()}
            >
              Fechar esta aba
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">Se o botão de fechar não funcionar, pode fechar manualmente.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyResultPage;
