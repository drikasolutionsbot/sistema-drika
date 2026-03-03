import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Shield, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TermsModal = ({ open, onOpenChange }: TermsModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Termos de Serviço
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] px-6 py-4">
          <div className="space-y-5 text-sm">
            <section className="space-y-2">
              <h3 className="font-semibold text-foreground">1. Aceitação dos Termos</h3>
              <p className="text-muted-foreground leading-relaxed">
                Ao acessar e utilizar a plataforma Drika Solutions ("Plataforma"), você concorda com estes Termos de Serviço. 
                Se você não concordar com qualquer parte destes termos, não utilize a Plataforma.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-foreground">2. Descrição do Serviço</h3>
              <p className="text-muted-foreground leading-relaxed">
                A Drika Solutions oferece uma plataforma SaaS de gerenciamento de bots de vendas para Discord, incluindo:
              </p>
              <ul className="text-muted-foreground space-y-1 list-disc pl-5">
                <li>Sistema de loja automatizada com entrega digital</li>
                <li>Gerenciamento de produtos, estoque e variações</li>
                <li>Processamento de pagamentos via PIX e provedores integrados</li>
                <li>Sistema de tickets e suporte ao cliente</li>
                <li>Automações, sorteios e sistema VIP</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-foreground">3. Conta e Token de Acesso</h3>
              <p className="text-muted-foreground leading-relaxed">
                O acesso à Plataforma é concedido através de um token único. Você é responsável por manter a 
                confidencialidade do seu token e por todas as atividades realizadas com ele.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-foreground">4. Uso Aceitável</h3>
              <ul className="text-muted-foreground space-y-1 list-disc pl-5">
                <li>Não utilizar o serviço para atividades ilegais ou fraudulentas</li>
                <li>Não violar os Termos de Serviço do Discord</li>
                <li>Não realizar engenharia reversa ou tentativas de acesso não autorizado</li>
                <li>Não revender ou redistribuir o acesso sem autorização</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-foreground">5. Pagamentos e Planos</h3>
              <p className="text-muted-foreground leading-relaxed">
                Os planos e preços estão sujeitos a alterações com aviso prévio. A Drika Solutions não se 
                responsabiliza por transações realizadas entre você e seus clientes finais.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-foreground">6. Disponibilidade e Privacidade</h3>
              <p className="text-muted-foreground leading-relaxed">
                A Drika Solutions se esforça para manter a Plataforma disponível 24/7, mas não garante disponibilidade 
                ininterrupta. Coletamos apenas os dados necessários para o funcionamento do serviço e seus dados não 
                serão vendidos a terceiros.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-semibold text-foreground">7. Suspensão e Encerramento</h3>
              <p className="text-muted-foreground leading-relaxed">
                A Drika Solutions reserva-se o direito de suspender ou encerrar o acesso à Plataforma em caso 
                de violação destes termos.
              </p>
            </section>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            onClick={() => {
              onOpenChange(false);
              navigate("/termos");
            }}
          >
            <ExternalLink className="h-4 w-4" />
            Ver página completa
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TermsModal;
