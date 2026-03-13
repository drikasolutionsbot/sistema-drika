import { useState, useRef, useEffect } from "react";
import { Sparkles, Wand2, FileText, Image, MessageSquare, Lightbulb, Copy, Check, Loader2, Send, ChevronDown, Zap, Brain, Plus, User, Bot, Trash2 } from "lucide-react";
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

export default function AIAssistantPage() {
  const [selectedTool, setSelectedTool] = useState(AI_TOOLS[0]);
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
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
          body: { type: "image", prompt: currentPrompt, context },
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
        // Add empty assistant message for streaming
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
          body: JSON.stringify({ type: selectedTool.id, prompt: currentPrompt, context }),
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
      // Remove empty assistant message on error
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
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/15 p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0a12] via-[#2d0a1e]/90 to-[#0f0a1a]" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, hsl(330 100% 60% / 0.3) 0%, transparent 50%),
                            radial-gradient(circle at 80% 20%, hsl(270 80% 60% / 0.2) 0%, transparent 40%),
                            radial-gradient(circle at 60% 80%, hsl(45 100% 50% / 0.15) 0%, transparent 40%)`
        }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,105,180,0.4) 40px, rgba(255,105,180,0.1) 42px, transparent 42px, transparent 80px),
                            repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(196,74,255,0.3) 40px, rgba(196,74,255,0.08) 42px, transparent 42px, transparent 80px)`
        }} />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/30 to-[#C44AFF]/30 border border-primary/20 flex items-center justify-center backdrop-blur-sm">
              <Brain className="h-8 w-8 text-primary drop-shadow-[0_0_8px_rgba(255,105,180,0.5)]" />
            </div>
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">P-CON IA</h1>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-green-500">IA Ativa</span>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-primary/20 text-primary border border-primary/30">
                Global
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-lg">
              Inteligência artificial proprietária da Drika — gere textos, imagens, descrições e estratégias otimizadas para Discord.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card/80 border border-border/30">
              <Zap className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-[11px] font-semibold text-foreground/80">P-CON Engine</span>
            </div>
            <span className="text-[10px] text-muted-foreground/50">Multi-modelo inteligente</span>
          </div>
        </div>
      </div>

      {/* Tool Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {AI_TOOLS.map((tool) => {
          const isActive = selectedTool.id === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => { setSelectedTool(tool); setActiveSessionId(null); }}
              className={cn(
                "relative group flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-500 text-center overflow-hidden",
                isActive
                  ? `bg-card border-primary/30 ${tool.glow}`
                  : "bg-card/50 border-border/30 hover:border-primary/20 hover:bg-card/80"
              )}
            >
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

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar - History */}
        <div className="space-y-3">
          <Button
            onClick={handleNewChat}
            className={cn("w-full gap-2 rounded-xl bg-gradient-to-r text-white font-semibold shadow-lg hover:scale-[1.02] transition-all", selectedTool.gradient)}
          >
            <Plus className="h-4 w-4" />
            Novo Chat
          </Button>

          {/* History List */}
          <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/20">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">Histórico</p>
            </div>
            <ScrollArea className="h-[300px]">
              {filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-xs text-muted-foreground/50">Nenhum chat ainda</p>
                  <p className="text-[10px] text-muted-foreground/30 mt-1">Comece uma conversa!</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredSessions.map(session => (
                    <div
                      key={session.id}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200",
                        activeSessionId === session.id
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/50 border border-transparent"
                      )}
                      onClick={() => setActiveSessionId(session.id)}
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground/80 truncate">{session.title}</p>
                        <p className="text-[10px] text-muted-foreground/40">
                          {session.messages.length} msg • {session.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3 text-destructive/60" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Quick Prompts */}
          {!activeSessionId && (
            <div className="rounded-2xl border border-primary/10 p-4 bg-card/50">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-[11px] font-bold text-foreground/80 uppercase tracking-widest">Sugestões</p>
              </div>
              <div className="space-y-1.5">
                {selectedTool.prompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(p)}
                    className="w-full text-left text-[11px] px-3 py-2 rounded-lg border border-border/20 text-muted-foreground hover:bg-primary/5 hover:border-primary/25 hover:text-foreground transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-primary/40 shrink-0" />
                      {p}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex flex-col rounded-2xl border border-primary/10 bg-card overflow-hidden min-h-[500px]">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/20 bg-card/80">
            <div className="flex items-center gap-3">
              <div className={cn("h-2 w-2 rounded-full transition-all duration-500", loading ? "bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.6)]" : messages.length > 0 ? "bg-green-500" : "bg-muted-foreground/30")} />
              <p className="text-xs font-bold text-foreground/80 uppercase tracking-widest">
                {activeSession ? activeSession.title.slice(0, 30) : selectedTool.label}
              </p>
              {loading && (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 animate-fade-in">
                  <div className="relative h-3.5 w-3.5">
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                  </div>
                  <span className="text-[10px] font-semibold text-primary tracking-wide">P-CON processando...</span>
                </div>
              )}
            </div>
            {messages.length > 0 && !loading && (
              <span className="text-[10px] text-muted-foreground/40">{messages.length} mensagens</span>
            )}
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-4">
              {messages.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <div className={cn("h-20 w-20 rounded-3xl flex items-center justify-center", selectedTool.bgAccent, "border border-border/20")}>
                    <selectedTool.icon className="h-9 w-9 text-muted-foreground/30" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground/70">Comece uma conversa</p>
                    <p className="text-xs text-muted-foreground/40 mt-1.5 max-w-[260px]">
                      Escolha uma sugestão ou escreva seu prompt para começar
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br", selectedTool.gradient)}>
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                      msg.role === "user"
                        ? "bg-primary/15 border border-primary/20 text-foreground"
                        : "bg-muted/40 border border-border/20 text-foreground/85"
                    )}>
                      {msg.imageUrl && (
                        <div className="mb-3 relative rounded-xl overflow-hidden border border-border/30 shadow-lg">
                          <img src={msg.imageUrl} alt="IA" className="w-full" />
                          <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl pointer-events-none" />
                        </div>
                      )}
                      {msg.imageUrl && (
                        <div className="mb-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[11px] h-7 border-border/30 hover:bg-primary/10 hover:text-primary"
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
                          className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-primary transition-colors"
                        >
                          {copied === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copied === msg.id ? "Copiado" : "Copiar"}
                        </button>
                      )}
                      {msg.role === "assistant" && !msg.content && !msg.imageUrl && loading && (
                        <div className="flex items-center gap-2 py-1">
                          <div className="flex gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                          <span className="text-[11px] text-muted-foreground/40">Gerando...</span>
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-primary/20 border border-primary/30">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-border/20 p-4">
            {/* Context Toggle */}
            <div className="mb-2">
              <button
                onClick={() => setShowContext(!showContext)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-primary transition-colors"
              >
                <ChevronDown className={cn("h-3 w-3 transition-transform", showContext && "rotate-180")} />
                Contexto (opcional)
              </button>
              {showContext && (
                <Textarea
                  placeholder="Ex: Minha loja vende contas de jogos..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="mt-2 min-h-[60px] bg-muted/30 border-border/20 text-xs resize-none"
                />
              )}
            </div>

            <div className="relative group/input">
              <div className={cn(
                "absolute -inset-px rounded-xl transition-opacity duration-500 opacity-0 group-focus-within/input:opacity-100",
                `bg-gradient-to-r ${selectedTool.gradient} blur-sm`
              )} />
              <div className="relative flex items-end gap-2 rounded-xl border border-primary/10 bg-card p-2">
                <Textarea
                  placeholder={selectedTool.id === "image" ? "Descreva a imagem..." : "Escreva seu prompt..."}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                  className="min-h-[44px] max-h-[120px] bg-transparent border-0 text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0 py-2.5"
                />
                <Button
                  size="icon"
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                  className={cn(
                    "h-9 w-9 rounded-lg shrink-0 shadow-lg transition-all",
                    "bg-gradient-to-r", selectedTool.gradient,
                    "hover:scale-105 disabled:opacity-40"
                  )}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4 text-white" />}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/30 mt-1.5 text-center">Enter para enviar • Shift+Enter para nova linha</p>
          </div>
        </div>
      </div>
    </div>
  );
}
