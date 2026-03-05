import { useState, useRef } from "react";
import { Sparkles, Wand2, FileText, Image, MessageSquare, Lightbulb, Copy, Check, Loader2, Send, ChevronDown, Zap, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const AI_TOOLS = [
  {
    id: "copy",
    label: "Copywriting",
    icon: Wand2,
    gradient: "from-[#FF6B9D] via-[#C44AFF] to-[#FF6B9D]",
    glow: "shadow-[0_0_40px_rgba(196,74,255,0.3)]",
    bgAccent: "bg-gradient-to-br from-[#FF6B9D]/10 to-[#C44AFF]/10",
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
    gradient: "from-[#A855F7] via-[#7C3AED] to-[#A855F7]",
    glow: "shadow-[0_0_40px_rgba(124,58,237,0.3)]",
    bgAccent: "bg-gradient-to-br from-[#A855F7]/10 to-[#7C3AED]/10",
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
    gradient: "from-[#F59E0B] via-[#EF4444] to-[#F59E0B]",
    glow: "shadow-[0_0_40px_rgba(245,158,11,0.3)]",
    bgAccent: "bg-gradient-to-br from-[#F59E0B]/10 to-[#EF4444]/10",
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
    gradient: "from-[#3B82F6] via-[#06B6D4] to-[#3B82F6]",
    glow: "shadow-[0_0_40px_rgba(59,130,246,0.3)]",
    bgAccent: "bg-gradient-to-br from-[#3B82F6]/10 to-[#06B6D4]/10",
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
    gradient: "from-[#10B981] via-[#059669] to-[#10B981]",
    glow: "shadow-[0_0_40px_rgba(16,185,129,0.3)]",
    bgAccent: "bg-gradient-to-br from-[#10B981]/10 to-[#059669]/10",
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
              if (content) { accumulated += content; setResult(accumulated); }
            } catch { buffer = line + "\n" + buffer; break; }
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Erro ao gerar conteúdo", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero Header with texture */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/15 p-6 sm:p-8">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a12] via-[#2d0a1e]/90 to-[#0f0a1a]" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, hsl(330 100% 60% / 0.3) 0%, transparent 50%),
                            radial-gradient(circle at 80% 20%, hsl(270 80% 60% / 0.2) 0%, transparent 40%),
                            radial-gradient(circle at 60% 80%, hsl(45 100% 50% / 0.15) 0%, transparent 40%)`
        }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
        {/* Animated mesh lines */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,105,180,0.4) 40px, rgba(255,105,180,0.1) 42px, transparent 42px, transparent 80px),
                            repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(196,74,255,0.3) 40px, rgba(196,74,255,0.08) 42px, transparent 42px, transparent 80px)`
        }} />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/30 to-[#C44AFF]/30 border border-primary/20 flex items-center justify-center backdrop-blur-sm">
              <Brain className="h-8 w-8 text-primary drop-shadow-[0_0_8px_rgba(255,105,180,0.5)]" />
            </div>
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-[#1a0a12] animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Assistente IA</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-primary/20 text-primary border border-primary/30">
                Beta
              </span>
            </div>
            <p className="text-sm text-white/50 max-w-lg">
              Gere textos persuasivos, imagens, descrições e estratégias com inteligência artificial — tudo otimizado para Discord.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-white/30">
            <Zap className="h-3.5 w-3.5 text-yellow-500" />
            <span>Powered by AI</span>
          </div>
        </div>
      </div>

      {/* Tool Selector - Glass Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {AI_TOOLS.map((tool) => {
          const isActive = selectedTool.id === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => { setSelectedTool(tool); setResult(""); setImageUrl(null); }}
              className={cn(
                "relative group flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-500 text-center overflow-hidden",
                isActive
                  ? `bg-card border-primary/30 ${tool.glow}`
                  : "bg-card/50 border-border/30 hover:border-primary/20 hover:bg-card/80"
              )}
            >
              {/* Subtle texture on active */}
              {isActive && (
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: `radial-gradient(circle at 50% 0%, white 0%, transparent 60%)`
                }} />
              )}
              <div className={cn(
                "relative h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-500",
                isActive ? `bg-gradient-to-br ${tool.gradient} shadow-lg scale-110` : `${tool.bgAccent} group-hover:scale-105`
              )}>
                <tool.icon className={cn("h-5 w-5 transition-all duration-300", isActive ? "text-white" : "text-muted-foreground")} />
                {isActive && <div className="absolute inset-0 rounded-xl bg-white/10 animate-pulse" />}
              </div>
              <span className={cn("text-xs font-bold tracking-wide", isActive ? "text-foreground" : "text-muted-foreground")}>
                {tool.label}
              </span>
              <span className="text-[10px] text-muted-foreground/60 leading-tight">{tool.description}</span>
              {isActive && (
                <div className={cn("absolute -bottom-px left-1/2 -translate-x-1/2 w-10 h-[2px] rounded-full bg-gradient-to-r", tool.gradient)} />
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Side */}
        <div className="space-y-4">
          {/* Quick Prompts - Styled */}
          <div className="relative overflow-hidden rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm p-5">
            <div className="absolute inset-0 opacity-[0.02]" style={{
              backgroundImage: `radial-gradient(circle at 100% 100%, hsl(330 100% 71% / 0.4) 0%, transparent 50%)`
            }} />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-bold text-foreground/80 uppercase tracking-widest">Sugestões rápidas</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {selectedTool.prompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(p)}
                    className={cn(
                      "group/prompt text-left text-xs px-4 py-3 rounded-xl border transition-all duration-300",
                      "bg-muted/30 border-border/20 text-muted-foreground",
                      "hover:bg-primary/5 hover:border-primary/25 hover:text-foreground hover:shadow-[0_0_20px_hsl(330_100%_71%/0.05)]"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/40 group-hover/prompt:bg-primary transition-colors shrink-0" />
                      {p}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Context Toggle */}
          <button
            onClick={() => setShowContext(!showContext)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors group/ctx"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform duration-300 group-hover/ctx:text-primary", showContext && "rotate-180")} />
            Adicionar contexto (opcional)
          </button>
          {showContext && (
            <Textarea
              placeholder="Ex: Minha loja vende contas de jogos, meu público são gamers de 18-25 anos..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="min-h-[80px] bg-card/60 border-border/30 text-sm resize-none backdrop-blur-sm"
            />
          )}

          {/* Main Input - Enhanced */}
          <div className="relative group/input">
            <div className={cn(
              "absolute -inset-px rounded-2xl transition-opacity duration-500 opacity-0 group-focus-within/input:opacity-100",
              `bg-gradient-to-r ${selectedTool.gradient} blur-sm`
            )} />
            <div className="relative rounded-2xl overflow-hidden border border-border/30 bg-card/80 backdrop-blur-sm">
              <Textarea
                placeholder={selectedTool.id === "image"
                  ? "Descreva a imagem que deseja gerar..."
                  : "Descreva o que deseja gerar..."
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                className="min-h-[130px] pr-14 bg-transparent border-0 text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="flex items-center justify-between px-4 pb-3">
                <span className="text-[10px] text-muted-foreground/40">
                  Enter para enviar • Shift+Enter para nova linha
                </span>
                <Button
                  size="icon"
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                  className={cn(
                    "h-9 w-9 rounded-xl shadow-lg transition-all duration-300",
                    "bg-gradient-to-r", selectedTool.gradient,
                    "hover:scale-105 hover:shadow-xl disabled:opacity-40 disabled:hover:scale-100"
                  )}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4 text-white" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Output Side */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("h-2 w-2 rounded-full", loading ? "bg-yellow-500 animate-pulse" : result ? "bg-green-500" : "bg-muted-foreground/30")} />
              <p className="text-xs font-bold text-foreground/80 uppercase tracking-widest">
                {loading ? "Gerando..." : "Resultado"}
              </p>
            </div>
            {result && !loading && (
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            )}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm min-h-[380px]">
            {/* Subtle grid texture */}
            <div className="absolute inset-0 opacity-[0.015]" style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '20px 20px'
            }} />
            {/* Top gradient accent */}
            <div className={cn("absolute top-0 left-0 right-0 h-px bg-gradient-to-r opacity-30", selectedTool.gradient)} />

            <div className="relative z-10 p-5" ref={resultRef}>
              {loading && !result && !imageUrl ? (
                <div className="flex flex-col items-center justify-center h-[340px] gap-4">
                  <div className="relative">
                    <div className={cn("h-16 w-16 rounded-2xl bg-gradient-to-br flex items-center justify-center", selectedTool.gradient)}>
                      <Sparkles className="h-7 w-7 text-white" />
                    </div>
                    <div className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br animate-ping opacity-20", selectedTool.gradient)} />
                    {/* Orbiting dots */}
                    <div className="absolute -inset-4 animate-spin" style={{ animationDuration: '3s' }}>
                      <div className="absolute top-0 left-1/2 h-1.5 w-1.5 rounded-full bg-primary/60" />
                    </div>
                    <div className="absolute -inset-6 animate-spin" style={{ animationDuration: '5s', animationDirection: 'reverse' }}>
                      <div className="absolute top-0 left-1/2 h-1 w-1 rounded-full bg-accent/40" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground/70">Gerando com IA...</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-1">Isso pode levar alguns segundos</p>
                  </div>
                </div>
              ) : imageUrl ? (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden border border-border/30 shadow-2xl">
                    <img src={imageUrl} alt="Imagem gerada por IA" className="w-full" />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl pointer-events-none" />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-border/30 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
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
                  {result && <p className="text-sm text-muted-foreground">{result}</p>}
                </div>
              ) : result ? (
                <div className="whitespace-pre-wrap text-sm text-foreground/85 leading-relaxed font-[system-ui] selection:bg-primary/20">
                  {result}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[340px] gap-4 text-center">
                  <div className={cn("h-20 w-20 rounded-3xl flex items-center justify-center", selectedTool.bgAccent, "border border-border/20")}>
                    <selectedTool.icon className="h-9 w-9 text-muted-foreground/30" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground/70">Nenhum resultado ainda</p>
                    <p className="text-xs text-muted-foreground/40 mt-1.5 max-w-[240px]">
                      Escolha uma sugestão rápida ou escreva seu prompt para começar a gerar
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
