import { useState, useRef } from "react";
import { Sparkles, Wand2, FileText, Image, MessageSquare, Lightbulb, Copy, Check, Loader2, Send, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const AI_TOOLS = [
  {
    id: "copy",
    label: "Copywriting",
    icon: Wand2,
    color: "from-pink-500 to-rose-600",
    description: "Textos persuasivos para vendas",
    prompts: [
      "Crie uma copy de venda para meu produto digital no Discord",
      "Escreva um texto de urgência para promoção relâmpago",
      "Crie um anúncio para atrair novos membros ao servidor",
      "Escreva uma mensagem de boas-vindas que converte",
    ],
  },
  {
    id: "description",
    label: "Descrições",
    icon: FileText,
    color: "from-violet-500 to-purple-600",
    description: "Descrições atraentes para produtos",
    prompts: [
      "Crie uma descrição para meu produto de contas digitais",
      "Escreva uma descrição para serviço de boost Discord",
      "Crie descrição para pack de créditos de jogo",
      "Descreva meu serviço VIP com benefícios exclusivos",
    ],
  },
  {
    id: "image",
    label: "Gerar Imagem",
    icon: Image,
    color: "from-amber-500 to-orange-600",
    description: "Banners, logos e thumbnails",
    prompts: [
      "Banner para loja de produtos digitais no Discord, estilo gaming neon",
      "Logo minimalista para servidor de vendas Discord",
      "Thumbnail promocional com desconto de 50%",
      "Banner de boas-vindas para servidor Discord premium",
    ],
  },
  {
    id: "embed",
    label: "Embeds Discord",
    icon: MessageSquare,
    color: "from-blue-500 to-cyan-600",
    description: "Textos formatados para embeds",
    prompts: [
      "Crie um embed de regras para meu servidor de vendas",
      "Escreva um embed de anúncio de novo produto",
      "Crie um embed para sistema de tickets",
      "Escreva embed de boas-vindas com informações do servidor",
    ],
  },
  {
    id: "strategy",
    label: "Estratégia",
    icon: Lightbulb,
    color: "from-emerald-500 to-green-600",
    description: "Dicas e estratégias de vendas",
    prompts: [
      "Como aumentar as vendas no meu servidor Discord?",
      "Estratégias para reter membros VIP",
      "Como criar promoções que funcionam no Discord?",
      "Dicas para melhorar o engajamento do servidor",
    ],
  },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

export default function AIAssistantPage() {
  const [selectedTool, setSelectedTool] = useState(AI_TOOLS[0]);
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Digite algo", description: "Escreva o que deseja gerar.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult("");
    setImageUrl(null);

    try {
      if (selectedTool.id === "image") {
        const { data, error } = await supabase.functions.invoke("ai-assistant", {
          body: { type: "image", prompt, context },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.image_url) setImageUrl(data.image_url);
        if (data?.text) setResult(data.text);
      } else {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ type: selectedTool.id, prompt, context }),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData?.error || "Erro ao gerar conteúdo");
        }

        const reader = resp.body?.getReader();
        if (!reader) throw new Error("Stream não disponível");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                accumulated += content;
                setResult(accumulated);
              }
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Erro ao gerar conteúdo", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePromptClick = (p: string) => {
    setPrompt(p);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assistente IA</h1>
          <p className="text-sm text-muted-foreground">Gere textos, imagens e estratégias com inteligência artificial</p>
        </div>
      </div>

      {/* Tool Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {AI_TOOLS.map((tool) => {
          const isActive = selectedTool.id === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => { setSelectedTool(tool); setResult(""); setImageUrl(null); }}
              className={cn(
                "relative group flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300 text-center",
                isActive
                  ? "bg-card border-primary/30 shadow-[0_0_30px_hsl(330_100%_71%/0.1)]"
                  : "bg-card/50 border-border/50 hover:border-primary/20 hover:bg-card"
              )}
            >
              <div className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center bg-gradient-to-br transition-all duration-300",
                tool.color,
                isActive ? "shadow-lg scale-110" : "opacity-70 group-hover:opacity-100"
              )}>
                <tool.icon className="h-5 w-5 text-white" />
              </div>
              <span className={cn("text-xs font-semibold", isActive ? "text-foreground" : "text-muted-foreground")}>
                {tool.label}
              </span>
              <span className="text-[10px] text-muted-foreground/70 leading-tight">{tool.description}</span>
              {isActive && (
                <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Side */}
        <div className="space-y-4">
          {/* Quick Prompts */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">💡 Sugestões rápidas</p>
              <div className="grid grid-cols-1 gap-2">
                {selectedTool.prompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handlePromptClick(p)}
                    className="text-left text-xs px-3 py-2.5 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20 transition-all duration-200 text-muted-foreground"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Context (collapsible) */}
          <button
            onClick={() => setShowContext(!showContext)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", showContext && "rotate-180")} />
            Adicionar contexto (opcional)
          </button>
          {showContext && (
            <Textarea
              placeholder="Ex: Minha loja vende contas de jogos, meu público são gamers de 18-25 anos..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="min-h-[80px] bg-card/80 border-border/50 text-sm resize-none"
            />
          )}

          {/* Main Input */}
          <div className="relative">
            <Textarea
              placeholder={selectedTool.id === "image"
                ? "Descreva a imagem que deseja gerar..."
                : "Descreva o que deseja gerar..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
              className="min-h-[120px] pr-14 bg-card border-border/50 text-sm resize-none focus:border-primary/40"
            />
            <Button
              size="icon"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="absolute bottom-3 right-3 h-9 w-9 rounded-xl bg-primary hover:bg-primary/90 shadow-lg"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Output Side */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              ✨ Resultado
            </p>
            {result && !loading && (
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs gap-1.5">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            )}
          </div>

          <Card className="border-border/50 bg-card/80 backdrop-blur-sm min-h-[340px]">
            <CardContent className="p-4" ref={resultRef}>
              {loading && !result && !imageUrl ? (
                <div className="flex flex-col items-center justify-center h-[300px] gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                    <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" />
                  </div>
                  <p className="text-sm text-muted-foreground">Gerando com IA...</p>
                </div>
              ) : imageUrl ? (
                <div className="space-y-3">
                  <img
                    src={imageUrl}
                    alt="Imagem gerada por IA"
                    className="w-full rounded-xl border border-border/50 shadow-lg"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = imageUrl;
                        a.download = "ai-generated.png";
                        a.click();
                      }}
                    >
                      Baixar Imagem
                    </Button>
                  </div>
                  {result && (
                    <p className="text-sm text-muted-foreground">{result}</p>
                  )}
                </div>
              ) : result ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                    {result}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] gap-3 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <selectedTool.icon className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Nenhum resultado ainda</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Escolha uma sugestão ou escreva seu prompt para começar
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
