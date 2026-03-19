import { useState, useRef, useEffect } from "react";
import { Sparkles, Wand2, FileText, Image, MessageSquare, Lightbulb, Copy, Check, Loader2, Send, ChevronDown, Zap, Brain, Plus, User, Bot, Trash2, Stars, Orbit, Flame, Crown, Globe, Cpu, Network, Boxes, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const AI_TOOLS = [
  {
    id: "copy",
    label: "Copywriting",
    icon: Wand2,
    gradient: "from-[#FF6B9D] via-[#C44AFF] to-[#FF6B9D]",
    glow: "shadow-[0_0_60px_rgba(196,74,255,0.4)]",
    bgAccent: "bg-gradient-to-br from-[#FF6B9D]/10 to-[#C44AFF]/10",
    ring: "ring-[#C44AFF]/30",
    description: "Textos persuasivos para vendas",
    emoji: "✍️",
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
    glow: "shadow-[0_0_60px_rgba(124,58,237,0.4)]",
    bgAccent: "bg-gradient-to-br from-[#A855F7]/10 to-[#7C3AED]/10",
    ring: "ring-[#7C3AED]/30",
    description: "Descrições atraentes para produtos",
    emoji: "📝",
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
    glow: "shadow-[0_0_60px_rgba(245,158,11,0.4)]",
    bgAccent: "bg-gradient-to-br from-[#F59E0B]/10 to-[#EF4444]/10",
    ring: "ring-[#F59E0B]/30",
    description: "Banners, logos e thumbnails",
    emoji: "🎨",
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
    glow: "shadow-[0_0_60px_rgba(59,130,246,0.4)]",
    bgAccent: "bg-gradient-to-br from-[#3B82F6]/10 to-[#06B6D4]/10",
    ring: "ring-[#3B82F6]/30",
    description: "Textos formatados para embeds",
    emoji: "💬",
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
    glow: "shadow-[0_0_60px_rgba(16,185,129,0.4)]",
    bgAccent: "bg-gradient-to-br from-[#10B981]/10 to-[#059669]/10",
    ring: "ring-[#10B981]/30",
    description: "Dicas e estratégias de vendas",
    emoji: "💡",
    prompts: [
      "Como aumentar as vendas no meu servidor Discord?",
      "Estratégias para reter membros VIP",
      "Como criar promoções que funcionam no Discord?",
      "Dicas para melhorar o engajamento do servidor",
    ],
  },
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  toolId: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  toolId: string;
  createdAt: Date;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

/* ───── Animated background particles (pure CSS) ───── */
const ParticleField = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {Array.from({ length: 30 }).map((_, i) => (
      <div
        key={i}
        className="absolute rounded-full bg-primary/20"
        style={{
          width: `${Math.random() * 3 + 1}px`,
          height: `${Math.random() * 3 + 1}px`,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animation: `float ${Math.random() * 8 + 6}s ease-in-out infinite`,
          animationDelay: `${Math.random() * 5}s`,
          opacity: Math.random() * 0.6 + 0.2,
        }}
      />
    ))}
  </div>
);

/* ───── Neural network lines SVG ───── */
const NeuralLines = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="neural-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(330 100% 60%)" />
        <stop offset="50%" stopColor="hsl(270 80% 60%)" />
        <stop offset="100%" stopColor="hsl(200 100% 60%)" />
      </linearGradient>
    </defs>
    {Array.from({ length: 12 }).map((_, i) => (
      <line
        key={i}
        x1={`${(i * 9) % 100}%`}
        y1={`${(i * 13 + 5) % 100}%`}
        x2={`${(i * 11 + 30) % 100}%`}
        y2={`${(i * 7 + 40) % 100}%`}
        stroke="url(#neural-grad)"
        strokeWidth="1"
        opacity="0.5"
      />
    ))}
    {Array.from({ length: 8 }).map((_, i) => (
      <circle
        key={`c-${i}`}
        cx={`${(i * 14 + 10) % 100}%`}
        cy={`${(i * 17 + 8) % 100}%`}
        r="2"
        fill="url(#neural-grad)"
        opacity="0.6"
      />
    ))}
  </svg>
);

export default function AIAssistantPage() {
  const [selectedTool, setSelectedTool] = useState(AI_TOOLS[0]);
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [provider, setProvider] = useState<"drika" | "google">("drika");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages.length, messages[messages.length - 1]?.content]);

  const createNewSession = (toolId: string, firstMessage?: string) => {
    const id = crypto.randomUUID();
    const session: ChatSession = {
      id,
      title: firstMessage?.slice(0, 50) || "Novo chat",
      messages: [],
      toolId,
      createdAt: new Date(),
    };
    setSessions(prev => [session, ...prev]);
    setActiveSessionId(id);
    return id;
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setPrompt("");
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Digite algo", description: "Escreva o que deseja gerar.", variant: "destructive" });
      return;
    }

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = createNewSession(selectedTool.id, prompt);
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      toolId: selectedTool.id,
      timestamp: new Date(),
    };

    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length === 0 ? prompt.slice(0, 50) : s.title } : s
    ));

    const currentPrompt = prompt;
    setPrompt("");
    setLoading(true);

    const assistantMsgId = crypto.randomUUID();

    try {
      if (selectedTool.id === "image") {
        const { data, error } = await supabase.functions.invoke("ai-assistant", {
          body: { type: "image", prompt: currentPrompt, context, provider },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const assistantMsg: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: data?.text || "",
          imageUrl: data?.image_url || undefined,
          toolId: selectedTool.id,
          timestamp: new Date(),
        };
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s
        ));
      } else {
        const emptyAssistant: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          toolId: selectedTool.id,
          timestamp: new Date(),
        };
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, messages: [...s.messages, emptyAssistant] } : s
        ));

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ type: selectedTool.id, prompt: currentPrompt, context, provider }),
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
                const acc = accumulated;
                setSessions(prev => prev.map(s =>
                  s.id === sessionId
                    ? { ...s, messages: s.messages.map(m => m.id === assistantMsgId ? { ...m, content: acc } : m) }
                    : s
                ));
              }
            } catch { buffer = line + "\n" + buffer; break; }
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Erro ao gerar conteúdo", variant: "destructive" });
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: s.messages.filter(m => m.id !== assistantMsgId || m.content) } : s
      ));
    } finally { setLoading(false); }
  };

  const handleCopy = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopied(msgId);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência." });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const filteredSessions = sessions.filter(s => s.toolId === selectedTool.id);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ═══════════════ HERO — Surreal Cosmic Header ═══════════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/10 min-h-[180px]">
        {/* Deep cosmic background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0015] via-[#1a0025] to-[#050020]" />
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 20% 40%, rgba(196,74,255,0.15) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 75% 20%, rgba(255,105,180,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 50% 60% at 50% 90%, rgba(59,130,246,0.1) 0%, transparent 50%),
            radial-gradient(circle at 90% 80%, rgba(16,185,129,0.08) 0%, transparent 40%)
          `
        }} />
        <ParticleField />
        <NeuralLines />

        {/* Holographic scanline effect */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)`
        }} />

        {/* Aurora glow top */}
        <div className="absolute top-0 left-0 right-0 h-[2px]">
          <div className="h-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="h-8 bg-gradient-to-b from-primary/10 to-transparent" />
        </div>

        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* AI Core orb */}
          <div className="relative group">
            <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-primary/20 via-[#C44AFF]/20 to-primary/20 blur-xl animate-pulse opacity-60" />
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/30 to-[#C44AFF]/30 animate-spin" style={{ animationDuration: "8s" }} />
            <div className="relative h-18 w-18 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-[#1a0a20] to-[#0a0520] border border-primary/20 flex items-center justify-center backdrop-blur-sm overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
              <Brain className="h-9 w-9 sm:h-10 sm:w-10 text-primary drop-shadow-[0_0_15px_rgba(255,105,180,0.6)] relative z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-primary/10 to-transparent" />
            </div>
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 border-2 border-background flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-primary/90 to-[#C44AFF] tracking-tight">
                DRIKA HUB IA
              </h1>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 backdrop-blur-sm">
                <div className="relative h-2 w-2">
                  <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                  <div className="relative h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">Neural Ativa</span>
              </div>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] rounded-full bg-gradient-to-r from-primary/15 to-[#C44AFF]/15 text-primary border border-primary/20 backdrop-blur-sm">
                v3.0 Quantum
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
              Motor de inteligência artificial da Drika — gere textos, imagens, descrições e estratégias com precisão sobrenatural.
            </p>
          </div>

          {/* Engine Selector — Desktop */}
          <div className="hidden lg:flex flex-col items-end gap-3">
            <div className="relative flex items-center gap-0 p-1.5 rounded-2xl bg-card/50 border border-border/20 backdrop-blur-xl shadow-lg">
              {/* Drika */}
              <button
                onClick={() => setProvider("drika")}
                className={cn(
                  "relative z-10 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300",
                  provider === "drika"
                    ? "bg-gradient-to-r from-primary/20 to-[#C44AFF]/20 text-primary border border-primary/30 shadow-[0_0_16px_hsl(330_100%_50%/0.12)]"
                    : "text-muted-foreground/60 hover:text-foreground/80"
                )}
              >
                <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center transition-all duration-300",
                  provider === "drika" ? "bg-primary/20" : "bg-muted/20"
                )}>
                  <Zap className={cn("h-3.5 w-3.5 transition-all", provider === "drika" ? "text-primary drop-shadow-[0_0_6px_rgba(255,105,180,0.6)]" : "text-muted-foreground/50")} />
                </div>
                <div className="flex flex-col items-start">
                  <span className="leading-none">Drika</span>
                  <span className={cn("text-[8px] font-medium mt-0.5", provider === "drika" ? "text-primary/60" : "text-muted-foreground/30")}>Gemini • GPT</span>
                </div>
              </button>
              {/* Google AI */}
              <button
                onClick={() => setProvider("google")}
                className={cn(
                  "relative z-10 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300",
                  provider === "google"
                    ? "bg-gradient-to-r from-[#4285F4]/20 to-[#34A853]/20 text-[#4285F4] border border-[#4285F4]/30 shadow-[0_0_16px_rgba(66,133,244,0.12)]"
                    : "text-muted-foreground/60 hover:text-foreground/80"
                )}
              >
                <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center transition-all duration-300",
                  provider === "google" ? "bg-[#4285F4]/20" : "bg-muted/20"
                )}>
                  <Gem className={cn("h-3.5 w-3.5 transition-all", provider === "google" ? "text-[#4285F4] drop-shadow-[0_0_6px_rgba(66,133,244,0.6)]" : "text-muted-foreground/50")} />
                </div>
                <div className="flex flex-col items-start">
                  <span className="leading-none">Google AI</span>
                  <span className={cn("text-[8px] font-medium mt-0.5", provider === "google" ? "text-[#4285F4]/60" : "text-muted-foreground/30")}>Gemini 2.5</span>
                </div>
              </button>
            </div>
            {/* Active model info */}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
              <div className={cn("h-1.5 w-1.5 rounded-full", 
                provider === "drika" ? "bg-primary/60" : "bg-[#4285F4]/60"
              )} />
              <span className="font-medium">
                {provider === "drika" ? "Multi-model fallback • 8 modelos" : "Google AI Studio • Gemini"}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom edge glow */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      {/* ═══════════════ TOOL SELECTOR — Holographic Cards ═══════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {AI_TOOLS.map((tool) => {
          const isActive = selectedTool.id === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => { setSelectedTool(tool); setActiveSessionId(null); }}
              className={cn(
                "relative group flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-500 text-center overflow-hidden",
                isActive
                  ? `bg-card/80 border-primary/30 ${tool.glow} ring-1 ${tool.ring} scale-[1.02]`
                  : "bg-card/30 border-border/20 hover:border-primary/15 hover:bg-card/50 hover:scale-[1.01]"
              )}
            >
              {/* Active glow overlay */}
              {isActive && (
                <>
                  <div className="absolute inset-0 opacity-[0.06]" style={{
                    backgroundImage: `radial-gradient(circle at 50% 0%, white 0%, transparent 60%)`
                  }} />
                  <div className="absolute -inset-px rounded-2xl opacity-20" style={{
                    backgroundImage: `conic-gradient(from 0deg, transparent, rgba(196,74,255,0.3), transparent, rgba(255,105,180,0.3), transparent)`
                  }} />
                </>
              )}

              {/* Tool icon */}
              <div className={cn(
                "relative h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-500",
                isActive ? `bg-gradient-to-br ${tool.gradient} shadow-lg` : `${tool.bgAccent} group-hover:scale-105`
              )}>
                <tool.icon className={cn("h-5 w-5 transition-all duration-300", isActive ? "text-white" : "text-muted-foreground")} />
                {isActive && <div className="absolute inset-0 rounded-xl bg-white/10 animate-pulse" />}
              </div>

              {/* Emoji badge */}
              <span className="text-lg leading-none">{tool.emoji}</span>
              
              <span className={cn("text-xs font-bold tracking-wide", isActive ? "text-foreground" : "text-muted-foreground")}>
                {tool.label}
              </span>
               <span className="text-[10px] text-muted-foreground/50 leading-tight">{tool.description}</span>

              {/* Active indicator bar */}
              {isActive && (
                <div className={cn("absolute -bottom-px left-1/2 -translate-x-1/2 w-12 h-[2px] rounded-full bg-gradient-to-r", tool.gradient)} />
              )}
            </button>
          );
        })}
      </div>

      {/* ═══════════════ MAIN AREA ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* ── Sidebar ── */}
        <div className="space-y-3">
          <Button
            onClick={handleNewChat}
            className={cn(
              "w-full gap-2 rounded-xl text-white font-bold shadow-lg hover:scale-[1.02] transition-all duration-300 h-11",
              "bg-gradient-to-r", selectedTool.gradient
            )}
          >
            <Plus className="h-4 w-4" />
            Novo Chat
          </Button>

          {/* History */}
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/10 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">Histórico</p>
            </div>
            <ScrollArea className="h-[280px]">
              {filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-muted/20 flex items-center justify-center mb-3">
                    <MessageSquare className="h-5 w-5 text-muted-foreground/15" />
                  </div>
                   <p className="text-xs text-muted-foreground/50">Nenhum chat ainda</p>
                   <p className="text-[10px] text-muted-foreground/40 mt-1">Comece uma conversa!</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredSessions.map(session => (
                    <div
                      key={session.id}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200",
                        activeSessionId === session.id
                          ? "bg-primary/10 border border-primary/20 shadow-sm"
                          : "hover:bg-muted/30 border border-transparent"
                      )}
                      onClick={() => setActiveSessionId(session.id)}
                    >
                      <div className={cn(
                        "h-6 w-6 rounded-lg flex items-center justify-center shrink-0",
                        activeSessionId === session.id ? "bg-primary/20" : "bg-muted/20"
                      )}>
                        <MessageSquare className="h-3 w-3 text-muted-foreground/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground/80 truncate">{session.title}</p>
                        <p className="text-[10px] text-muted-foreground/55">
                          {session.messages.length} msg • {session.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3 text-destructive/50" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Quick Prompts */}
          {!activeSessionId && (
            <div className="rounded-2xl border border-primary/10 p-4 bg-gradient-to-b from-card/50 to-card/30 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-primary/70" />
                <p className="text-[10px] font-bold text-foreground/60 uppercase tracking-[0.2em]">Sugestões Rápidas</p>
              </div>
              <div className="space-y-1.5">
                {selectedTool.prompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(p)}
                    className="w-full text-left text-[11px] px-3 py-2.5 rounded-xl border border-border/15 text-muted-foreground/70 hover:bg-primary/5 hover:border-primary/20 hover:text-foreground/90 transition-all duration-300 group"
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/30 shrink-0 group-hover:bg-primary/60 transition-colors" />
                      {p}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Chat Area ── */}
        <div className="relative flex flex-col rounded-2xl border border-primary/10 bg-gradient-to-b from-card/80 to-card/50 overflow-hidden min-h-[520px] backdrop-blur-sm">
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px"
          }} />

          {/* Chat Header */}
          <div className="relative flex items-center justify-between px-5 py-3.5 border-b border-border/10 bg-card/40 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-2.5 w-2.5 rounded-full transition-all duration-700",
                loading
                  ? "bg-yellow-400 animate-pulse shadow-[0_0_12px_rgba(250,204,21,0.6)]"
                  : messages.length > 0
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                  : "bg-muted-foreground/20"
              )} />
              <div>
                <p className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                  {activeSession ? activeSession.title.slice(0, 30) : selectedTool.label}
                </p>
                {!loading && messages.length > 0 && (
                  <p className="text-[10px] text-muted-foreground/55">{messages.length} mensagens</p>
                )}
              </div>
              {loading && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 animate-fade-in ml-2">
                  <div className="relative h-3.5 w-3.5">
                    <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                  </div>
                  <span className="text-[10px] font-semibold text-primary/80 tracking-wide">Processando...</span>
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0 relative z-10">
            <div className="p-5 space-y-5">
              {messages.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
                  {/* Floating orb */}
                  <div className="relative">
                    <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-primary/10 to-[#C44AFF]/10 blur-2xl animate-pulse" />
                    <div className={cn("relative h-24 w-24 rounded-3xl flex items-center justify-center border border-border/15", selectedTool.bgAccent)}>
                      <selectedTool.icon className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  </div>
                  <div>
                     <p className="text-base font-bold text-foreground/80 mb-1">Inicie uma conversa</p>
                    <p className="text-xs text-muted-foreground/60 max-w-[280px] leading-relaxed">
                       Escolha uma sugestão rápida ou escreva seu prompt para começar a gerar com a Drika IA
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/45">
                    <Orbit className="h-3 w-3" />
                    <span>Powered by Drika Engine v3.0</span>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <div className="relative shrink-0">
                        <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-primary/20 to-[#C44AFF]/20 blur-md opacity-50" />
                        <div className={cn("relative h-9 w-9 rounded-xl flex items-center justify-center bg-gradient-to-br border border-white/10", selectedTool.gradient)}>
                          <Bot className="h-4 w-4 text-white drop-shadow-sm" />
                        </div>
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                      msg.role === "user"
                        ? "bg-primary/12 border border-primary/15 text-foreground"
                        : "bg-muted/20 border border-border/15 text-foreground/90 backdrop-blur-sm"
                    )}>
                      {msg.imageUrl && (
                        <div className="mb-3 relative rounded-xl overflow-hidden border border-border/20 shadow-xl">
                          <img src={msg.imageUrl} alt="IA" className="w-full" />
                          <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-xl pointer-events-none" />
                        </div>
                      )}
                      {msg.imageUrl && (
                        <div className="mb-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[11px] h-7 border-border/20 hover:bg-primary/10 hover:text-primary"
                            onClick={() => {
                              const a = document.createElement("a");
                              a.href = msg.imageUrl!;
                              a.download = "ai-generated.png";
                              a.click();
                            }}
                          >
                            Baixar Imagem
                          </Button>
                        </div>
                      )}
                      {msg.content && (
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                      )}
                      {msg.role === "assistant" && msg.content && !loading && (
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="mt-2.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-primary transition-colors"
                        >
                          {copied === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copied === msg.id ? "Copiado" : "Copiar"}
                        </button>
                      )}
                      {/* Loading animation — surreal thinking */}
                      {msg.role === "assistant" && !msg.content && !msg.imageUrl && loading && (
                        <div className="flex flex-col gap-4 py-3 min-w-[220px]">
                          <div className="flex items-center gap-3">
                            <div className="relative h-8 w-8">
                              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/30 to-[#C44AFF]/30 animate-spin" style={{ animationDuration: "3s" }} />
                              <div className="absolute inset-[3px] rounded-full bg-card flex items-center justify-center">
                                <Brain className="h-3.5 w-3.5 text-primary animate-pulse" />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[11px] font-bold text-foreground/60">Processamento neural</span>
                              <div className="flex gap-1.5">
                                {[0, 1, 2, 3, 4].map(i => (
                                  <div
                                    key={i}
                                    className="h-1 w-4 rounded-full bg-gradient-to-r from-primary/50 to-[#C44AFF]/50"
                                    style={{
                                      animation: `pulse 1.5s ease-in-out infinite`,
                                      animationDelay: `${i * 200}ms`,
                                      opacity: 0.3,
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          {/* Shimmer blocks */}
                          <div className="space-y-2.5">
                            {[85, 65, 45].map((w, i) => (
                              <div
                                key={i}
                                className="h-2 rounded-full overflow-hidden"
                                style={{ width: `${w}%` }}
                              >
                                <div
                                  className="h-full w-[200%] bg-gradient-to-r from-muted/30 via-muted/10 to-muted/30"
                                  style={{
                                    animation: `shimmer 2s linear infinite`,
                                    animationDelay: `${i * 300}ms`,
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/15 border border-primary/20">
                        <User className="h-4 w-4 text-primary/80" />
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* ── Input Area ── */}
          <div className="relative border-t border-border/10 p-4 bg-card/40 backdrop-blur-md z-10">
            {/* Provider + Context controls */}
            <div className="mb-2 flex items-center gap-3 flex-wrap">
              {/* Mobile provider toggle */}
              <div className="flex items-center gap-0 p-1 rounded-xl bg-card/40 border border-border/20 backdrop-blur-md lg:hidden">
                <button
                  onClick={() => setProvider("drika")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300",
                    provider === "drika"
                      ? "bg-primary/15 text-primary border border-primary/25 shadow-sm"
                      : "text-muted-foreground/60 hover:text-foreground/80"
                  )}
                >
                  <Zap className="h-3 w-3" />
                  Drika
                </button>
                <button
                  onClick={() => setProvider("google")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300",
                    provider === "google"
                      ? "bg-[#4285F4]/15 text-[#4285F4] border border-[#4285F4]/25 shadow-sm"
                      : "text-muted-foreground/60 hover:text-foreground/80"
                  )}
                >
                  <Gem className="h-3 w-3" />
                  Google
                </button>
              </div>


              <button
                onClick={() => setShowContext(!showContext)}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-primary/80 transition-colors font-medium"
              >
                <ChevronDown className={cn("h-3 w-3 transition-transform duration-300", showContext && "rotate-180")} />
                Contexto (opcional)
              </button>
            </div>
            {showContext && (
              <Textarea
                placeholder="Ex: Minha loja vende contas de jogos..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="mb-2 min-h-[50px] bg-muted/10 border-border/15 text-xs resize-none"
              />
            )}

            <div className="relative group/input">
              {/* Glow border on focus */}
              <div className={cn(
                "absolute -inset-px rounded-xl transition-opacity duration-500 opacity-0 group-focus-within/input:opacity-100",
                `bg-gradient-to-r ${selectedTool.gradient} blur-sm`
              )} />
              <div className="relative flex items-end gap-2 rounded-xl border border-primary/10 bg-card/80 p-2 backdrop-blur-sm">
                <Textarea
                  placeholder={selectedTool.id === "image" ? "Descreva a imagem que deseja gerar..." : "Escreva seu prompt para a Drika IA..."}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                  className="min-h-[44px] max-h-[120px] bg-transparent border-0 text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0 py-2.5 placeholder:text-muted-foreground/40"
                />
                <Button
                  size="icon"
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                  className={cn(
                    "h-10 w-10 rounded-xl shrink-0 shadow-lg transition-all duration-300",
                    "bg-gradient-to-r", selectedTool.gradient,
                    "hover:scale-110 hover:shadow-xl disabled:opacity-30 disabled:hover:scale-100"
                  )}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4 text-white" />}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/40 mt-2 text-center tracking-wide">
              Enter para enviar • Shift+Enter para nova linha • {provider === "google" ? "Powered by Google AI Studio 💎" : "Powered by Drika Engine"}
            </p>
          </div>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-15px) translateX(5px); }
          50% { transform: translateY(-5px) translateX(-5px); }
          75% { transform: translateY(-20px) translateX(3px); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(0%); }
        }
      `}</style>
    </div>
  );
}
