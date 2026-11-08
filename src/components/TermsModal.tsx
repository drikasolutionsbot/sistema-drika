import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Shield, ExternalLink, Calculator, Percent, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TermsModal = ({ open, onOpenChange }: TermsModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 border-white/15 bg-[#090d1a] text-white">
        <DialogHeader className="p-6 pb-4 border-b border-white/10">
          <DialogTitle className="flex items-center gap-2 text-lg text-white">
            <Shield className="h-5 w-5 text-pink-500" />
            Termos de Serviço & Política de Taxas Drika Hub
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[58vh] px-6 py-4">
          <div className="space-y-5 text-sm">
            {/* Highlight Box: Taxas & Split */}
            <div className="rounded-2xl border border-pink-500/30 bg-pink-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-pink-300 font-bold text-xs uppercase tracking-wider">
                <Percent className="h-4 w-4" />
                <span>Resumo Oficial de Taxas (Carteira & Split PIX)</span>
              </div>
              <ul className="text-xs text-slate-200 space-y-1.5 list-disc pl-4">
                <li>
                  <strong>Taxa por Venda Aprovada (Split PIX):</strong>{" "}
                  <span className="text-pink-300 font-bold">R$ 1,00 fixo + 2%</span> sobre o valor do pedido pago.
                </li>
                <li>
                  <strong>Geração de QR Code PIX:</strong> <span className="text-emerald-400 font-bold">GRÁTIS</span>{" "}
                  (pedidos não pagos não geram cobrança).
                </li>
                <li>
                  <strong>Saques PIX da Carteira:</strong>{" "}
                  <span className="text-emerald-400 font-bold">1º saque da semana GRÁTIS (R$ 0,00)</span>. Saques
                  adicionais na mesma semana têm taxa fixa de <strong>R$ 1,00</strong> (saque mínimo de R$ 10,00).
                </li>
              </ul>
            </div>

            <section className="space-y-1.5">
              <h3 className="font-semibold text-white">1. Aceitação dos Termos</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Ao acessar e utilizar a plataforma Drika Hub / Drika Solutions ("Plataforma"), você concorda com estes
                Termos de Serviço e com a nossa Política de Taxas e Liquidação.
              </p>
            </section>

            <section className="space-y-1.5">
              <h3 className="font-semibold text-white">2. Funcionamento da Carteira Digital & Split</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Todas as vendas do seu bot no Discord são processadas automaticamente via PIX integrado. Assim que o
                cliente final paga, a taxa de intermediação (R$ 1,00 fixo + 2%) é descontada automaticamente e o valor
                líquido é creditado na hora na sua Carteira Drika Hub.
              </p>
            </section>

            <section className="space-y-1.5">
              <h3 className="font-semibold text-white">3. Saques PIX, Segurança e Prevenção a Fraudes (MED)</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                Os saques são enviados via PIX para a chave cadastrada pelo lojista e acompanham comprovante oficial em
                PDF. Em caso de contestação bancária (MED / fraude reportada pelo banco do comprador), o valor
                correspondente poderá ser retido ou estornado cautelarmente. É proibido comercializar itens ilícitos ou
                fraudulentos.
              </p>
            </section>

            <section className="space-y-1.5">
              <h3 className="font-semibold text-white">4. Responsabilidade do Lojista</h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                A Drika Hub fornece a infraestrutura tecnológica de automação. O lojista é o único responsável pelos
                produtos anunciados, entrega de estoque e suporte prestado aos membros de seu servidor Discord.
              </p>
            </section>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 bg-[#070a14]">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-pink-500/40 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20 hover:text-white text-xs"
              onClick={() => {
                onOpenChange(false);
                navigate("/taxas");
              }}
            >
              <Calculator className="h-3.5 w-3.5" />
              Calculadora de Margem & Taxas
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-slate-300 hover:text-white text-xs"
              onClick={() => {
                onOpenChange(false);
                navigate("/termos");
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Termos Completos
            </Button>
          </div>

          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="bg-pink-600 hover:bg-pink-500 text-white font-semibold text-xs"
          >
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TermsModal;
