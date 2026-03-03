import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const TermsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-8 gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display">Termos de Serviço</h1>
            <p className="text-sm text-muted-foreground">Última atualização: 03 de março de 2026</p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Shield className="h-5 w-5 text-primary" />
              1. Aceitação dos Termos
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ao acessar e utilizar a plataforma Drika Solutions ("Plataforma"), você concorda com estes Termos de Serviço. 
              Se você não concordar com qualquer parte destes termos, não utilize a Plataforma.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Descrição do Serviço</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A Drika Solutions oferece uma plataforma SaaS de gerenciamento de bots de vendas para Discord, incluindo:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
              <li>Sistema de loja automatizada com entrega digital</li>
              <li>Gerenciamento de produtos, estoque e variações</li>
              <li>Processamento de pagamentos via PIX e provedores integrados</li>
              <li>Sistema de tickets e suporte ao cliente</li>
              <li>Automações, sorteios e sistema VIP</li>
              <li>Personalização do bot e embeds</li>
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Conta e Token de Acesso</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O acesso à Plataforma é concedido através de um token único fornecido pela Drika Solutions. 
              Você é responsável por manter a confidencialidade do seu token de acesso e por todas as atividades 
              realizadas com ele. Não compartilhe seu token com terceiros.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Uso Aceitável</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">Ao utilizar a Plataforma, você concorda em:</p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
              <li>Não utilizar o serviço para atividades ilegais ou fraudulentas</li>
              <li>Não violar os Termos de Serviço do Discord</li>
              <li>Não realizar engenharia reversa ou tentativas de acesso não autorizado</li>
              <li>Não revender ou redistribuir o acesso sem autorização</li>
              <li>Manter informações de pagamento dos clientes em sigilo</li>
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Pagamentos e Planos</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Os planos e preços estão sujeitos a alterações com aviso prévio. Pagamentos processados não são 
              reembolsáveis, exceto em casos previstos pelo Código de Defesa do Consumidor. A Drika Solutions 
              não se responsabiliza por transações realizadas entre você e seus clientes finais.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Disponibilidade do Serviço</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A Drika Solutions se esforça para manter a Plataforma disponível 24/7, mas não garante 
              disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência. 
              Não nos responsabilizamos por indisponibilidades causadas por terceiros (Discord, provedores de pagamento, etc.).
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Propriedade Intelectual</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Todo o conteúdo, código, design e funcionalidades da Plataforma são propriedade da Drika Solutions. 
              É proibida a cópia, modificação ou distribuição sem autorização expressa.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Privacidade e Dados</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Coletamos e armazenamos apenas os dados necessários para o funcionamento do serviço, incluindo 
              informações do Discord (ID, nome de usuário, avatar) e dados de transações. Seus dados não serão 
              vendidos ou compartilhados com terceiros, exceto quando necessário para o funcionamento do serviço.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Suspensão e Encerramento</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A Drika Solutions reserva-se o direito de suspender ou encerrar o acesso à Plataforma em caso 
              de violação destes termos, uso indevido, ou por qualquer outro motivo a seu critério, com ou sem aviso prévio.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">10. Contato</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Para dúvidas sobre estes termos, entre em contato através do nosso canal de suporte no Discord 
              ou pela página de Suporte da Plataforma.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
