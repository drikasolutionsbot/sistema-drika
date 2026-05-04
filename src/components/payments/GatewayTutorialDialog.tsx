import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Check, Copy, ExternalLink, Lightbulb, AlertTriangle, Rocket, KeyRound, Webhook, Settings, ShieldCheck, CheckCircle2, List, Zap, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

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

const CopyableCode = ({ value, label }: { value: string; label?: string }) => {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs sm:text-sm overflow-hidden">
      <span className="truncate flex-1 text-foreground">{value}</span>
      <button
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success(`${label || t.gateways.common.copyLabel} ${t.common.copied.toLowerCase()}`);
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground transition"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
};

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gatewayKey: string | null;
}

export function GatewayTutorialDialog({ open, onOpenChange, gatewayKey }: Props) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);

  const tutorials: Record<string, GatewayTutorial> = {
    mercadopago: {
      key: "mercadopago",
      name: "Mercado Pago",
      brandColor: "00B1EA",
      brandBg: "from-sky-500/20 to-blue-600/10",
      slides: [
        {
          icon: Rocket,
          title: t.gateways.mercadopago.welcomeTitle,
          subtitle: t.gateways.mercadopago.welcomeSubtitle,
          body: (
            <div className="space-y-3 text-sm sm:text-base text-foreground/80">
              <p>{t.gateways.mercadopago.welcomeBody}</p>
              <p>{t.gateways.mercadopago.tutorialSteps}</p>
              <ul className="space-y-1.5 ml-4">
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 mt-0.5" /> {t.gateways.mercadopago.step1}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 mt-0.5" /> {t.gateways.mercadopago.step2}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 mt-0.5" /> {t.gateways.mercadopago.step3}</li>
              </ul>
            </div>
          ),
        },
        {
          icon: ExternalLink,
          title: t.gateways.mercadopago.passo1Title,
          body: (
            <div className="space-y-3">
              <Step n={1}>{t.gateways.mercadopago.passo1Step1}</Step>
              <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noopener noreferrer" className="block">
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 hover:bg-sky-500/20 transition flex items-center justify-between">
                  <span className="font-mono text-sm">mercadopago.com.br/developers/panel/app</span>
                  <ExternalLink className="h-4 w-4" />
                </div>
              </a>
              <Step n={2}>{t.gateways.mercadopago.passo1Step2}</Step>
              <Tip>{t.gateways.mercadopago.passo1Tip}</Tip>
            </div>
          ),
        },
        {
          icon: Settings,
          title: t.gateways.mercadopago.passo2Title,
          body: (
            <div className="space-y-3">
              <Step n={1}>{t.gateways.mercadopago.passo2Step1}</Step>
              <Step n={2}>{t.gateways.mercadopago.passo2Step2}</Step>
              <Step n={3}>
                {t.gateways.mercadopago.passo2Step3}
                <div className="mt-2 rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-sm">
                  {t.gateways.mercadopago.passo2Product}
                </div>
              </Step>
              <Step n={4}>{t.gateways.mercadopago.passo2Step4}</Step>
              <Step n={5}>{t.gateways.mercadopago.passo2Step5}</Step>
            </div>
          ),
        },
        {
          icon: KeyRound,
          title: t.gateways.mercadopago.passo3Title,
          body: (
            <div className="space-y-3">
              <Step n={1}>{t.gateways.mercadopago.passo3Step1}</Step>
              <Step n={2}>
                {t.gateways.mercadopago.passo3Step2}
                <div className="mt-2">
                  <CopyableCode value="APP_USR-xxxxxxxx-xxxxxx-xxxxxx..." label="Example" />
                </div>
              </Step>
              <Step n={3}>{t.gateways.mercadopago.passo3Step3}</Step>
              <Warn>{t.gateways.mercadopago.passo3Warn}</Warn>
            </div>
          ),
        },
        {
          icon: CheckCircle2,
          title: t.gateways.mercadopago.passo4Title,
          body: (
            <div className="space-y-3">
              <Step n={1}>{t.gateways.mercadopago.passo4Step1}</Step>
              <Step n={2}>{t.gateways.mercadopago.passo4Step2}</Step>
              <Step n={3}>{t.gateways.mercadopago.passo4Step3}</Step>
              <Step n={4}>{t.gateways.mercadopago.passo4Step4}</Step>
              <Tip>{t.gateways.mercadopago.passo4Tip}</Tip>
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
          title: t.gateways.stripe.welcomeTitle,
          subtitle: t.gateways.stripe.welcomeSubtitle,
          body: (
            <div className="space-y-3 text-sm sm:text-base text-foreground/80">
              <p>{t.gateways.stripe.welcomeBody}</p>
              <p>{t.gateways.stripe.tutorialSteps}</p>
              <ul className="space-y-1.5 ml-4">
                <li className="flex gap-2"><Check className="h-4 w-4 text-violet-400 mt-0.5" /> {t.gateways.stripe.step1}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-violet-400 mt-0.5" /> {t.gateways.stripe.step2}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 text-violet-400 mt-0.5" /> {t.gateways.stripe.step3}</li>
              </ul>
              <Warn>{t.gateways.stripe.warn}</Warn>
            </div>
          ),
        },
        {
          icon: KeyRound,
          title: t.gateways.stripe.passo1Title,
          body: (
            <div className="space-y-3">
              <Step n={1}>{t.gateways.stripe.passo1Step1}</Step>
              <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="block">
                <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 hover:bg-violet-500/20 transition flex items-center justify-between">
                  <span className="font-mono text-sm">dashboard.stripe.com/apikeys</span>
                  <ExternalLink className="h-4 w-4" />
                </div>
              </a>
              <Step n={2}>{t.gateways.stripe.passo1Step2}</Step>
              <Step n={3}>
                {t.gateways.stripe.passo1Step3}
                <div className="mt-2">
                  <CopyableCode value="sk_live_xxxxxxxxxxxxxxxxxxxxxxxx" label="Secret Key" />
                </div>
              </Step>
              <Tip>{t.gateways.stripe.passo1Tip}</Tip>
            </div>
          ),
        },
        {
          icon: Webhook,
          title: t.gateways.stripe.passo2Title,
          body: (
            <div className="space-y-3">
              <Step n={1}>{t.gateways.stripe.passo2Step1}</Step>
              <Step n={2}>{t.gateways.stripe.passo2Step2}</Step>
              <Step n={3}>
                {t.gateways.stripe.passo2Step3}
                <div className="mt-2">
                  <CopyableCode value={`${WEBHOOK_BASE}/stripe-webhook`} label="Webhook URL" />
                </div>
              </Step>
              <Step n={4}>
                {t.gateways.stripe.passo2Step4}
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
          title: t.gateways.stripe.passo3Title,
          body: (
            <div className="space-y-3">
              <Step n={1}>{t.gateways.stripe.passo3Step1}</Step>
              <Step n={2}>
                {t.gateways.stripe.passo3Step2}
                <div className="mt-2">
                  <CopyableCode value="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" label="Signing Secret" />
                </div>
              </Step>
              <Warn>{t.gateways.stripe.passo3Warn}</Warn>
            </div>
          ),
        },
        {
          icon: CheckCircle2,
          title: t.gateways.stripe.passo4Title,
          body: (
            <div className="space-y-3">
              <Step n={1}>{t.gateways.stripe.passo4Step1}</Step>
              <Step n={2}>{t.gateways.stripe.passo4Step2}</Step>
              <Step n={3}>{t.gateways.stripe.passo4Step3}</Step>
              <Step n={4}>
                {t.gateways.stripe.passo4Step4}
                <ul className="mt-2 space-y-1 ml-4 text-sm">
                  <li>• {t.gateways.stripe.passo4Currency}</li>
                  <li>• {t.gateways.stripe.passo4Gateway}</li>
                </ul>
              </Step>
              <Tip>{t.gateways.stripe.passo4Tip}</Tip>
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
  };

  const tutorial = gatewayKey ? tutorials[gatewayKey] : null;

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
                {t.gateways.common.tutorialName.replace("{name}", tutorial.name)}
              </div>
              <div className="text-xs text-muted-foreground">
                {t.gateways.common.stepCounter
                  .replace("{current}", (index + 1).toString())
                  .replace("{total}", tutorial.slides.length.toString())}
              </div>
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-foreground">{slide.title}</h2>
          {slide.subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{slide.subtitle}</p>
          )}
        </div>

        <div className="p-6 sm:p-8 min-h-[280px] max-h-[55vh] overflow-y-auto">
          {slide.body}
        </div>

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

        <div className="flex items-center justify-between p-4 sm:p-6 border-t border-white/10 bg-black/20">
          <Button
            variant="outline"
            onClick={() => setIndex(i => Math.max(i - 1, 0))}
            disabled={isFirst}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> {t.gateways.common.previous}
          </Button>

          {isLast ? (
            <Button
              onClick={() => onOpenChange(false)}
              style={{ backgroundColor: `#${tutorial.brandColor}` }}
              className="text-white hover:opacity-90"
            >
              <Check className="h-4 w-4 mr-1" /> {t.gateways.common.finish}
            </Button>
          ) : (
            <Button
              onClick={() => setIndex(i => Math.min(i + 1, tutorial.slides.length - 1))}
              style={{ backgroundColor: `#${tutorial.brandColor}` }}
              className="text-white hover:opacity-90"
            >
              {t.gateways.common.next} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
