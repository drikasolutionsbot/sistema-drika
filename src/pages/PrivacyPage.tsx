import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const PrivacyPage = () => {
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
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-display">Política de Privacidade</h1>
            <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground/90">
          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Shield className="h-5 w-5 text-primary" />
              1. Coleta de Informações
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A Drika Solutions coleta apenas as informações essenciais para o funcionamento e operação da Plataforma. 
              Isso inclui dados básicos de identificação (como e-mail, nome e informações de perfil do Discord) 
              e dados necessários para o processamento de transações.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Uso das Informações</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              As informações coletadas são utilizadas exclusivamente para:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
              <li>Fornecer, manter e melhorar nossos serviços;</li>
              <li>Processar transações e enviar avisos relacionados;</li>
              <li>Responder a comentários, dúvidas e oferecer suporte ao cliente;</li>
              <li>Monitorar e analisar tendências, uso e atividades na Plataforma.</li>
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Compartilhamento de Dados</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Não vendemos ou alugamos suas informações pessoais para terceiros. Seus dados poderão ser 
              compartilhados apenas com provedores de serviços confiáveis (como gateways de pagamento e serviços de hospedagem) 
              na medida necessária para a prestação do nosso serviço, sempre sob rigorosas obrigações de confidencialidade.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Segurança</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Implementamos medidas de segurança razoáveis e proporcionais para proteger suas informações contra acesso não autorizado, 
              alteração, divulgação ou destruição. No entanto, lembre-se que nenhum método de transmissão pela Internet 
              ou armazenamento eletrônico é 100% seguro.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Integração com o Discord</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nossa plataforma atua como um intermediário operando dentro da plataforma Discord.
              Portanto, a sua utilização também está sujeita aos Termos de Serviço e à Política de Privacidade 
              do próprio Discord. Recomendamos que você analise as políticas deles.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Retenção de Dados</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Manteremos suas informações pessoais apenas pelo tempo necessário para cumprir os propósitos descritos 
              nesta Política de Privacidade, ou conforme exigido por leis aplicáveis, para resolução de disputas 
              e para a execução de nossos acordos.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Seus Direitos</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Você tem o direito de solicitar acesso, correção, atualização ou exclusão de suas informações pessoais. 
              Para exercer qualquer um desses direitos, entre em contato conosco através dos nossos canais de suporte oficiais.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Alterações a esta Política</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente para refletir mudanças em nossas práticas. 
              Recomendamos revisar esta página regularmente. O uso continuado do serviço após eventuais alterações 
              constitui sua aceitação das novas políticas.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Contato</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Em caso de dúvidas sobre esta Política de Privacidade ou sobre as práticas de dados da nossa plataforma, 
              entre em contato através do nosso canal de suporte no Discord ou pela página de Suporte da Plataforma.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
