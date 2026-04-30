import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Check, Copy, ExternalLink, Lightbulb, AlertTriangle, Rocket, KeyRound, Webhook, Settings, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Slide = {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  body: React.ReactNode;
};

type GatewayTutorial = {
  key: string;
  name: string;
  brandColor: string; // hex sem #
  brandBg: string; // tailwind class
  webhookUrl?: string;
  slides: Slide[];
};

const WEBHOOK_BASE = "https://krudxivcuygykoswjbbx.supabase.co/functions/v1";

const CopyableCode = ({ value, label }: { value: string; label?: string }) => (
  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs sm:text-sm overflow-hidden">
    <span className="truncate flex-1 text-foreground">{value}</span>
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        toast.success(`${label || "Copiado"} copiado!`);
      }}
      className="shrink-0 text-muted-foreground hover:text-foreground transition"
    >
      <Copy className="h-4 w-4" />
    </button>
  </div>
);

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <div className="flex gap-3 items-start">
    <div className="shrink-0 h-7 w-7 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">
      {n}
    </div>
    <div className="flex-1 text-sm sm:text-base text-foreground/90 pt-0.5">{children}</div>
  </div>
);

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 items-start rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
    <Lightbulb className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
    <div className="text-yellow-100/90">{children}</div>
  </div>
);

const Warn = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2 items-start rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">
    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
    <div className="text-red-100/90">{children}</div>
  </div>
);

// =============================================================
// CONTEÚDO DOS 6 TUTORIAIS
// =============================================================

const tutorials: Record<string, GatewayTutorial> = {
  mercadopago: {
    key: "mercadopago",
    name: "Mercado Pago",
    brandColor: "00B1EA",
    brandBg: "from-sky-500/20 to-blue-600/10",
    slides: [
      {
        icon: Rocket,
        title: "Bem-vindo ao tutorial do Mercado Pago",
        subtitle: "Em poucos minutos seu gateway estará pronto para receber PIX",
        body: (
          <div className="space-y-3 text-sm sm:text-base text-foreground/80">
            <p>O Mercado Pago é o gateway mais popular do Brasil, com taxa baixa, aprovação rápida e PIX instantâneo.</p>
            <p>Neste tutorial você vai:</p>
            <ul className="space-y-1.5 ml-4">
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 mt-0.5" /> Criar uma aplicação na sua conta MP</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 mt-0.5" /> Pegar seu Access Token de produção</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 mt-0.5" /> Colar no painel e ativar o gateway</li>
            </ul>
          </div>
        ),
      },
      {
        icon: ExternalLink,
        title: "Passo 1 — Acesse o painel de Devs",
        body: (
          <div className="space-y-3">
            <Step n={1}>
              Abra o painel de desenvolvedores do Mercado Pago:
            </Step>
            <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noopener noreferrer" className="block">
              <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 hover:bg-sky-500/20 transition flex items-center justify-between">
                <span className="font-mono text-sm">mercadopago.com.br/developers/panel/app</span>
                <ExternalLink className="h-4 w-4" />
              </div>
            </a>
            <Step n={2}>Faça login com a conta que vai receber os pagamentos.</Step>
            <Tip>
              Use a conta <strong>vendedor</strong> (a que tem CNPJ ou CPF que vai receber o dinheiro), não uma conta de teste.
            </Tip>
          </div>
        ),
      },
      {
        icon: Settings,
        title: "Passo 2 — Crie uma aplicação",
        body: (
          <div className="space-y-3">
            <Step n={1}>Clique em <strong>"Criar aplicação"</strong>.</Step>
            <Step n={2}>Dê um nome (ex: <em>"Meu Bot Discord"</em>).</Step>
            <Step n={3}>
              Em <strong>"Produto integrado"</strong>, escolha:
              <div className="mt-2 rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-sm">
                Checkout Pro / Checkout Transparente
              </div>
            </Step>
            <Step n={4}>Em <strong>"Modelo de integração"</strong>: <em>Pagamentos online</em>.</Step>
            <Step n={5}>Marque <strong>PIX</strong> como meio de pagamento.</Step>
          </div>
        ),
      },
      {
        icon: KeyRound,
        title: "Passo 3 — Copie o Access Token",
        body: (
          <div className="space-y-3">
            <Step n={1}>Dentro da aplicação criada, vá em <strong>"Credenciais de produção"</strong>.</Step>
            <Step n={2}>
              Procure pelo campo <strong>"Access Token"</strong>. Ele começa com:
              <div className="mt-2">
                <CopyableCode value="APP_USR-xxxxxxxx-xxxxxx-xxxxxx..." label="Exemplo" />
              </div>
            </Step>
            <Step n={3}>Clique em <strong>"Copiar"</strong>.</Step>
            <Warn>
              <strong>NUNCA</strong> compartilhe esse token com ninguém. Ele dá acesso total à sua conta MP. O DRIKA HUB armazena de forma criptografada.
            </Warn>
          </div>
        ),
      },
      {
        icon: CheckCircle2,
        title: "Passo 4 — Cole no DRIKA HUB",
        body: (
          <div className="space-y-3">
            <Step n={1}>Volte para esta página de Pagamentos.</Step>
            <Step n={2}>No card do <strong>Mercado Pago</strong>, cole o Access Token no campo <strong>"Access Token"</strong>.</Step>
            <Step n={3}>Clique em <strong>"Testar Conexão"</strong> — deve aparecer ✅ verde.</Step>
            <Step n={4}>Clique em <strong>"Salvar"</strong> e ative o switch no canto.</Step>
            <Tip>
              Pronto! Agora todos os produtos com gateway PIX vão gerar QR Code via Mercado Pago automaticamente.
            </Tip>
          </div>
        ),
      },
    ],
  },

  pushinpay: {
    key: "pushinpay",
    name: "PushinPay",
    brandColor: "10B981",
    brandBg: "from-emerald-500/20 to-green-600/10",
    slides: [
      {
        icon: Rocket,
        title: "Tutorial do PushinPay",
        subtitle: "Gateway brasileiro especializado em PIX automático",
        body: (
          <div className="space-y-3 text-sm sm:text-base text-foreground/80">
            <p>O PushinPay é uma alternativa moderna e ágil ao Mercado Pago, com aprovação rápida e dashboard simples.</p>
            <p>Você precisa de:</p>
            <ul className="space-y-1.5 ml-4">
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 mt-0.5" /> Conta criada no PushinPay</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 mt-0.5" /> Documentos validados (KYC)</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 mt-0.5" /> Token da API</li>
            </ul>
          </div>
        ),
      },
      {
        icon: ExternalLink,
        title: "Passo 1 — Acesse o painel",
        body: (
          <div className="space-y-3">
            <Step n={1}>Abra o painel do PushinPay:</Step>
            <a href="https://app.pushinpay.com.br" target="_blank" rel="noopener noreferrer" className="block">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 hover:bg-emerald-500/20 transition flex items-center justify-between">
                <span className="font-mono text-sm">app.pushinpay.com.br</span>
                <ExternalLink className="h-4 w-4" />
              </div>
            </a>
            <Step n={2}>Faça login ou crie sua conta.</Step>
            <Tip>Se for primeira vez, complete a verificação KYC antes — sem isso o PIX fica bloqueado.</Tip>
          </div>
        ),
      },
      {
        icon: KeyRound,
        title: "Passo 2 — Gere o Token API",
        body: (
          <div className="space-y-3">
            <Step n={1}>No menu lateral, vá em <strong>"Integrações"</strong> ou <strong>"API"</strong>.</Step>
            <Step n={2}>Clique em <strong>"Gerar novo Token"</strong>.</Step>
            <Step n={3}>
              Copie o token que aparecer (formato UUID):
              <div className="mt-2">
                <CopyableCode value="9C2F0E1A-1234-5678-90AB-CDEFGHIJKLMN" label="Exemplo" />
              </div>
            </Step>
            <Warn>O token só aparece uma vez! Salve em local seguro caso precise depois.</Warn>
          </div>
        ),
      },
      {
        icon: CheckCircle2,
        title: "Passo 3 — Configure no DRIKA HUB",
        body: (
          <div className="space-y-3">
            <Step n={1}>No card do <strong>PushinPay</strong>, cole o token no campo <strong>"API Token"</strong>.</Step>
            <Step n={2}>Clique em <strong>"Testar Conexão"</strong>.</Step>
            <Step n={3}>Salve e ative o gateway. Pronto! ✅</Step>
            <Tip>Os pagamentos serão processados em até 30 segundos após o cliente pagar o PIX.</Tip>
          </div>
        ),
      },
    ],
  },

  efi: {
    key: "efi",
    name: "Efí (Gerencianet)",
    brandColor: "F59E0B",
    brandBg: "from-amber-500/20 to-orange-600/10",
    slides: [
      {
        icon: Rocket,
        title: "Tutorial da Efí Bank",
        subtitle: "Antiga Gerencianet — segurança bancária com PIX",
        body: (
          <div className="space-y-3 text-sm sm:text-base text-foreground/80">
            <p>A Efí é o gateway mais robusto e seguro, usando certificado mTLS para autenticação. É a escolha de quem fatura alto.</p>
            <p>Você vai precisar de:</p>
            <ul className="space-y-1.5 ml-4">
              <li className="flex gap-2"><Check className="h-4 w-4 text-amber-400 mt-0.5" /> Conta Efí com PIX habilitado</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-amber-400 mt-0.5" /> Aplicação criada</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-amber-400 mt-0.5" /> Client ID + Client Secret</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-amber-400 mt-0.5" /> Certificado .p12</li>
            </ul>
          </div>
        ),
      },
      {
        icon: ExternalLink,
        title: "Passo 1 — Painel da Efí",
        body: (
          <div className="space-y-3">
            <Step n={1}>Acesse o painel:</Step>
            <a href="https://app.efipay.com.br" target="_blank" rel="noopener noreferrer" className="block">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 hover:bg-amber-500/20 transition flex items-center justify-between">
                <span className="font-mono text-sm">app.efipay.com.br</span>
                <ExternalLink className="h-4 w-4" />
              </div>
            </a>
            <Step n={2}>Vá em <strong>API</strong> → <strong>Minhas Aplicações</strong>.</Step>
            <Step n={3}>Clique em <strong>"Nova Aplicação"</strong> e dê um nome.</Step>
          </div>
        ),
      },
      {
        icon: KeyRound,
        title: "Passo 2 — Credenciais",
        body: (
          <div className="space-y-3">
            <Step n={1}>Dentro da aplicação, marque os escopos de <strong>PIX</strong> (gn.pix.send, gn.pix.read, etc).</Step>
            <Step n={2}>
              Copie o <strong>Client ID</strong>:
              <div className="mt-2">
                <CopyableCode value="Client_Id_xxxxxxxxxxxxxxxxxxxx" label="Client ID exemplo" />
              </div>
            </Step>
            <Step n={3}>
              Copie o <strong>Client Secret</strong>:
              <div className="mt-2">
                <CopyableCode value="Client_Secret_xxxxxxxxxxxxxxxx" label="Client Secret exemplo" />
              </div>
            </Step>
            <Tip>Use as credenciais de <strong>Produção</strong>, não Homologação.</Tip>
          </div>
        ),
      },
      {
        icon: ShieldCheck,
        title: "Passo 3 — Certificado .p12",
        body: (
          <div className="space-y-3">
            <Step n={1}>Ainda na aplicação, vá em <strong>"Certificados"</strong>.</Step>
            <Step n={2}>Clique em <strong>"Novo Certificado"</strong> e escolha ambiente <strong>Produção</strong>.</Step>
            <Step n={3}>Baixe o arquivo <code className="bg-black/40 px-1.5 py-0.5 rounded">.p12</code>.</Step>
            <Step n={4}>No DRIKA HUB, faça upload do arquivo no campo <strong>"Certificado .p12"</strong>.</Step>
            <Warn>O certificado .p12 é como uma "chave de cofre" — guarde com extremo cuidado.</Warn>
          </div>
        ),
      },
      {
        icon: CheckCircle2,
        title: "Passo 4 — Finalizar",
        body: (
          <div className="space-y-3">
            <Step n={1}>Cole Client ID, Client Secret e suba o certificado no painel.</Step>
            <Step n={2}>Clique em <strong>"Testar Conexão"</strong>.</Step>
            <Step n={3}>Salve e ative. Tudo pronto! 🎉</Step>
            <Tip>A Efí não usa webhook — o DRIKA HUB faz polling a cada 1 minuto para confirmar pagamentos.</Tip>
          </div>
        ),
      },
    ],
  },

  misticpay: {
    key: "misticpay",
    name: "MisticPay",
    brandColor: "8B5CF6",
    brandBg: "from-violet-500/20 to-purple-600/10",
    slides: [
      {
        icon: Rocket,
        title: "Tutorial do MisticPay",
        subtitle: "PIX com aprovação instantânea e taxa competitiva",
        body: (
          <div className="space-y-3 text-sm sm:text-base text-foreground/80">
            <p>O MisticPay é um gateway nacional focado em alta conversão e pagamentos automatizados via PIX.</p>
            <p>Setup em 3 passos:</p>
          </div>
        ),
      },
      {
        icon: ExternalLink,
        title: "Passo 1 — Acesse o painel",
        body: (
          <div className="space-y-3">
            <Step n={1}>Abra o painel do MisticPay:</Step>
            <a href="https://app.misticpay.com.br" target="_blank" rel="noopener noreferrer" className="block">
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 hover:bg-violet-500/20 transition flex items-center justify-between">
                <span className="font-mono text-sm">app.misticpay.com.br</span>
                <ExternalLink className="h-4 w-4" />
              </div>
            </a>
            <Step n={2}>Faça login na sua conta.</Step>
          </div>
        ),
      },
      {
        icon: KeyRound,
        title: "Passo 2 — Gere a Secret Key",
        body: (
          <div className="space-y-3">
            <Step n={1}>No menu, vá em <strong>"Integrações"</strong> → <strong>"API Keys"</strong>.</Step>
            <Step n={2}>Clique em <strong>"Nova chave"</strong>.</Step>
            <Step n={3}>
              Copie a <strong>Secret Key</strong>:
              <div className="mt-2">
                <CopyableCode value="sk_live_misticpay_xxxxxxxxxx" label="Secret Key exemplo" />
              </div>
            </Step>
            <Warn>Salve em lugar seguro — a chave não é exibida novamente.</Warn>
          </div>
        ),
      },
      {
        icon: CheckCircle2,
        title: "Passo 3 — Configure no DRIKA HUB",
        body: (
          <div className="space-y-3">
            <Step n={1}>No card do <strong>MisticPay</strong>, cole a Secret Key.</Step>
            <Step n={2}>Teste a conexão e ative o gateway.</Step>
            <Tip>Pronto! O MisticPay já está integrado e processa pagamentos automaticamente.</Tip>
          </div>
        ),
      },
    ],
  },

  abacatepay: {
    key: "abacatepay",
    name: "AbacatePay",
    brandColor: "84CC16",
    brandBg: "from-lime-500/20 to-green-600/10",
    slides: [
      {
        icon: Rocket,
        title: "Tutorial do AbacatePay 🥑",
        subtitle: "PIX simples, rápido e dev-friendly",
        body: (
          <div className="space-y-3 text-sm sm:text-base text-foreground/80">
            <p>O AbacatePay é um gateway PIX moderno feito para desenvolvedores, com API limpa e setup rapidíssimo.</p>
          </div>
        ),
      },
      {
        icon: ExternalLink,
        title: "Passo 1 — Crie sua conta",
        body: (
          <div className="space-y-3">
            <Step n={1}>Acesse:</Step>
            <a href="https://app.abacatepay.com" target="_blank" rel="noopener noreferrer" className="block">
              <div className="rounded-lg border border-lime-500/30 bg-lime-500/10 p-3 hover:bg-lime-500/20 transition flex items-center justify-between">
                <span className="font-mono text-sm">app.abacatepay.com</span>
                <ExternalLink className="h-4 w-4" />
              </div>
            </a>
            <Step n={2}>Cadastre-se e complete a verificação KYC.</Step>
          </div>
        ),
      },
      {
        icon: KeyRound,
        title: "Passo 2 — API Key",
        body: (
          <div className="space-y-3">
            <Step n={1}>No painel, vá em <strong>"Integrar"</strong> → <strong>"API Keys"</strong>.</Step>
            <Step n={2}>
              Copie sua chave de produção:
              <div className="mt-2">
                <CopyableCode value="abc_live_xxxxxxxxxxxxxxxxxxxx" label="API Key exemplo" />
              </div>
            </Step>
            <Tip>
              Use <code className="bg-black/40 px-1.5 py-0.5 rounded">abc_live_</code> para receber dinheiro real.
              Use <code className="bg-black/40 px-1.5 py-0.5 rounded">abc_dev_</code> apenas para testes.
            </Tip>
          </div>
        ),
      },
      {
        icon: CheckCircle2,
        title: "Passo 3 — Ative no DRIKA HUB",
        body: (
          <div className="space-y-3">
            <Step n={1}>Cole a API Key no card do <strong>AbacatePay</strong>.</Step>
            <Step n={2}>Teste, salve e ative. Tudo certo! 🥑✨</Step>
          </div>
        ),
      },
    ],
  },

  stripe: {
    key: "stripe",
    name: "Stripe",
    brandColor: "635BFF",
    brandBg: "from-violet-500/20 to-indigo-600/10",
    webhookUrl: `${WEBHOOK_BASE}/stripe-webhook`,
    slides: [
      {
        icon: Rocket,
        title: "Tutorial do Stripe",
        subtitle: "Cartão de crédito internacional (USD, EUR, BRL)",
        body: (
          <div className="space-y-3 text-sm sm:text-base text-foreground/80">
            <p>O Stripe permite vender no <strong>exterior</strong> aceitando cartões de crédito em mais de 135 moedas.</p>
            <p>Você vai precisar de:</p>
            <ul className="space-y-1.5 ml-4">
              <li className="flex gap-2"><Check className="h-4 w-4 text-violet-400 mt-0.5" /> Conta Stripe verificada</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-violet-400 mt-0.5" /> Secret Key</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-violet-400 mt-0.5" /> Webhook configurado</li>
            </ul>
            <Warn>Stripe requer documentação válida (LLC, EIN ou CNPJ internacional). No Brasil sozinho, prefira PIX.</Warn>
          </div>
        ),
      },
      {
        icon: KeyRound,
        title: "Passo 1 — Pegue a Secret Key",
        body: (
          <div className="space-y-3">
            <Step n={1}>Acesse o dashboard do Stripe:</Step>
            <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="block">
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 hover:bg-violet-500/20 transition flex items-center justify-between">
                <span className="font-mono text-sm">dashboard.stripe.com/apikeys</span>
                <ExternalLink className="h-4 w-4" />
              </div>
            </a>
            <Step n={2}>Vá em <strong>Desenvolvedores</strong> → <strong>Chaves de API</strong>.</Step>
            <Step n={3}>
              Copie a <strong>Secret Key</strong>:
              <div className="mt-2">
                <CopyableCode value="sk_live_xxxxxxxxxxxxxxxxxxxxxxxx" label="Secret Key exemplo" />
              </div>
            </Step>
            <Tip>Para testar sem cobrar, use <code className="bg-black/40 px-1.5 py-0.5 rounded">sk_test_</code>.</Tip>
          </div>
        ),
      },
      {
        icon: Webhook,
        title: "Passo 2 — Configure o Webhook",
        body: (
          <div className="space-y-3">
            <Step n={1}>No Stripe, vá em <strong>Desenvolvedores</strong> → <strong>Webhooks</strong>.</Step>
            <Step n={2}>Clique em <strong>"Adicionar destino"</strong>.</Step>
            <Step n={3}>
              Cole esta URL:
              <div className="mt-2">
                <CopyableCode value={`${WEBHOOK_BASE}/stripe-webhook`} label="URL do webhook" />
              </div>
            </Step>
            <Step n={4}>
              Selecione os eventos:
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 mt-0.5" /> <code className="bg-black/40 px-1.5 py-0.5 rounded">checkout.session.completed</code></div>
                <div className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 mt-0.5" /> <code className="bg-black/40 px-1.5 py-0.5 rounded">payment_intent.succeeded</code></div>
                <div className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 mt-0.5" /> <code className="bg-black/40 px-1.5 py-0.5 rounded">payment_intent.payment_failed</code></div>
              </div>
            </Step>
          </div>
        ),
      },
      {
        icon: ShieldCheck,
        title: "Passo 3 — Signing Secret",
        body: (
          <div className="space-y-3">
            <Step n={1}>Após criar o webhook, clique nele para abrir.</Step>
            <Step n={2}>
              Copie o <strong>"Segredo da assinatura"</strong> (começa com <code className="bg-black/40 px-1.5 py-0.5 rounded">whsec_</code>):
              <div className="mt-2">
                <CopyableCode value="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" label="Signing Secret exemplo" />
              </div>
            </Step>
            <Warn>Este segredo é usado para validar que os eventos vieram REALMENTE da Stripe. Sem ele, qualquer um poderia forjar pagamentos falsos.</Warn>
          </div>
        ),
      },
      {
        icon: CheckCircle2,
        title: "Passo 4 — Configure no DRIKA HUB",
        body: (
          <div className="space-y-3">
            <Step n={1}>No card do <strong>Stripe</strong>, cole a <strong>Secret Key</strong>.</Step>
            <Step n={2}>Cole o <strong>Signing Secret (Webhook)</strong>.</Step>
            <Step n={3}>Salve e ative o gateway.</Step>
            <Step n={4}>
              Nos seus produtos, defina:
              <ul className="mt-2 space-y-1 ml-4 text-sm">
                <li>• <strong>Moeda:</strong> USD, EUR ou BRL</li>
                <li>• <strong>Gateway:</strong> Stripe (Cartão)</li>
              </ul>
            </Step>
            <Tip>Pronto! O botão <strong>"💳 Pagar com Cartão"</strong> aparecerá no checkout do bot para esses produtos.</Tip>
          </div>
        ),
      },
    ],
  },
};

// =============================================================
// COMPONENTE DIALOG
// =============================================================

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gatewayKey: string | null;
}

export function GatewayTutorialDialog({ open, onOpenChange, gatewayKey }: Props) {
  const tutorial = gatewayKey ? tutorials[gatewayKey] : null;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open, gatewayKey]);

  useEffect(() => {
    if (!open || !tutorial) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex(i => Math.min(i + 1, tutorial.slides.length - 1));
      if (e.key === "ArrowLeft") setIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, tutorial]);

  if (!tutorial) return null;

  const slide = tutorial.slides[index];
  const Icon = slide.icon;
  const isLast = index === tutorial.slides.length - 1;
  const isFirst = index === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-white/10 bg-card gap-0">
        {/* Header com gradiente da marca */}
        <div className={cn("relative bg-gradient-to-br p-6 sm:p-8 border-b border-white/10", tutorial.brandBg)}>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center transition"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `#${tutorial.brandColor}20`, border: `1px solid #${tutorial.brandColor}40` }}
            >
              <Icon className="h-6 w-6" style={{ color: `#${tutorial.brandColor}` }} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Tutorial · {tutorial.name}
              </div>
              <div className="text-xs text-muted-foreground">
                Passo {index + 1} de {tutorial.slides.length}
              </div>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-foreground">{slide.title}</h2>
          {slide.subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{slide.subtitle}</p>
          )}
        </div>

        {/* Conteúdo */}
        <div className="p-6 sm:p-8 min-h-[280px] max-h-[55vh] overflow-y-auto">
          {slide.body}
        </div>

        {/* Indicadores */}
        <div className="flex items-center justify-center gap-1.5 px-6 py-3 border-t border-white/10">
          {tutorial.slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-8" : "w-1.5 hover:w-3",
              )}
              style={{
                backgroundColor: i === index ? `#${tutorial.brandColor}` : "hsl(var(--muted))",
              }}
            />
          ))}
        </div>

        {/* Footer com navegação */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-t border-white/10 bg-black/20">
          <Button
            variant="outline"
            onClick={() => setIndex(i => Math.max(i - 1, 0))}
            disabled={isFirst}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>

          {isLast ? (
            <Button
              onClick={() => onOpenChange(false)}
              style={{ backgroundColor: `#${tutorial.brandColor}` }}
              className="text-white hover:opacity-90"
            >
              <Check className="h-4 w-4 mr-1" /> Concluir tutorial
            </Button>
          ) : (
            <Button
              onClick={() => setIndex(i => Math.min(i + 1, tutorial.slides.length - 1))}
              style={{ backgroundColor: `#${tutorial.brandColor}` }}
              className="text-white hover:opacity-90"
            >
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
