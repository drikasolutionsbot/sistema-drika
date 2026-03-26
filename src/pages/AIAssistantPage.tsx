import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles, Wand2, FileText, Image, MessageSquare, Lightbulb, Copy, Check,
  Loader2, Send, ChevronDown, Zap, Brain, Plus, User, Bot, Trash2, Orbit,
  Paperclip, X, RefreshCw, Stars, RotateCcw, Crown, Flame, Clock, ArrowRight,
  History, RotateCw, Bookmark, BookmarkCheck, Lock, TrendingUp, Gauge, Download,
  ImagePlus, Database, Square
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";

// ═══════════════════════════════════════════════════════════
// PLAN & CREDITS CONFIGURATION (ready for backend integration)
// ═══════════════════════════════════════════════════════════

const PLAN_LIMITS: Record<string, { daily: number; label: string; badge: string; color: string }> = {
  free: { daily: 5, label: "Free", badge: "Free", color: "text-muted-foreground" },
  trial: { daily: 15, label: "Trial", badge: "Trial", color: "text-yellow-400" },
  pro: { daily: 100, label: "Pro", badge: "Pro", color: "text-primary" },
  business: { daily: 500, label: "Business", badge: "Business", color: "text-emerald-400" },
};

const CREDIT_COSTS: Record<string, number> = {
  copy: 1,
  description: 1,
  embed: 1,
  strategy: 2,
  prompt_enhancer: 1,
  image: 3,
  variations: 2,
  improve: 1,
};

// ═══════════════════════════════════════════════════════════

const AI_TOOL_DEFS = [
  {
    id: "copy",
    labelKey: "toolCopywriting" as const,
    icon: Wand2,
    gradient: "from-[#FF6B9D] via-[#C44AFF] to-[#FF6B9D]",
    glow: "shadow-[0_0_60px_rgba(196,74,255,0.4)]",
    bgAccent: "bg-gradient-to-br from-[#FF6B9D]/10 to-[#C44AFF]/10",
    ring: "ring-[#C44AFF]/30",
    descKey: "toolCopywritingDesc" as const,
    emoji: "✍️",
    credits: 1,
    promptKeys: ["copyPrompt1", "copyPrompt2", "copyPrompt3", "copyPrompt4"] as const,
  },
  {
    id: "description",
    labelKey: "toolDescriptions" as const,
    icon: FileText,
    gradient: "from-[#A855F7] via-[#7C3AED] to-[#A855F7]",
    glow: "shadow-[0_0_60px_rgba(124,58,237,0.4)]",
    bgAccent: "bg-gradient-to-br from-[#A855F7]/10 to-[#7C3AED]/10",
    ring: "ring-[#7C3AED]/30",
    descKey: "toolDescriptionsDesc" as const,
    emoji: "📝",
    credits: 1,
    promptKeys: ["descPrompt1", "descPrompt2", "descPrompt3", "descPrompt4"] as const,
  },
  {
    id: "image",
    labelKey: "toolImage" as const,
    icon: Image,
    gradient: "from-[#F59E0B] via-[#EF4444] to-[#F59E0B]",
    glow: "shadow-[0_0_60px_rgba(245,158,11,0.4)]",
    bgAccent: "bg-gradient-to-br from-[#F59E0B]/10 to-[#EF4444]/10",
    ring: "ring-[#F59E0B]/30",
    descKey: "toolImageDesc" as const,
    emoji: "🎨",
    credits: 3,
    promptKeys: ["imagePrompt1", "imagePrompt2", "imagePrompt3", "imagePrompt4"] as const,
  },
  {
    id: "embed",
    labelKey: "toolEmbed" as const,
    icon: MessageSquare,
    gradient: "from-[#3B82F6] via-[#06B6D4] to-[#3B82F6]",
    glow: "shadow-[0_0_60px_rgba(59,130,246,0.4)]",
    bgAccent: "bg-gradient-to-br from-[#3B82F6]/10 to-[#06B6D4]/10",
    ring: "ring-[#3B82F6]/30",
    descKey: "toolEmbedDesc" as const,
    emoji: "💬",
    credits: 1,
    promptKeys: ["embedPrompt1", "embedPrompt2", "embedPrompt3", "embedPrompt4"] as const,
  },
  {
    id: "strategy",
    labelKey: "toolStrategy" as const,
    icon: Lightbulb,
    gradient: "from-[#10B981] via-[#059669] to-[#10B981]",
    glow: "shadow-[0_0_60px_rgba(16,185,129,0.4)]",
    bgAccent: "bg-gradient-to-br from-[#10B981]/10 to-[#059669]/10",
    ring: "ring-[#10B981]/30",
    descKey: "toolStrategyDesc" as const,
    emoji: "💡",
    credits: 2,
    promptKeys: ["strategyPrompt1", "strategyPrompt2", "strategyPrompt3", "strategyPrompt4"] as const,
  },
  {
    id: "prompt_enhancer",
    labelKey: "toolEnhancer" as const,
    icon: Stars,
    gradient: "from-[#EC4899] via-[#8B5CF6] to-[#EC4899]",
    glow: "shadow-[0_0_60px_rgba(139,92,246,0.4)]",
    bgAccent: "bg-gradient-to-br from-[#EC4899]/10 to-[#8B5CF6]/10",
    ring: "ring-[#8B5CF6]/30",
    descKey: "toolEnhancerDesc" as const,
    emoji: "🚀",
    credits: 1,
    promptKeys: ["enhancerPrompt1", "enhancerPrompt2", "enhancerPrompt3", "enhancerPrompt4"] as const,
  },
];

interface Attachment {
  id: string;
  type: "image";
  data: string;
  name: string;
  preview: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  enhancedPrompt?: string;
  attachments?: Attachment[];
  toolId: string;
  timestamp: string;
  saved?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  toolId: string;
  createdAt: string;
}

interface CreditsState {
  remaining: number;
  daily: number;
  loaded: boolean;
}

interface DbGeneration {
  id: string;
  category: string;
  user_input: string;
  enhanced_prompt: string | null;
  result_text: string | null;
  result_image_url: string | null;
  credits_used: number;
  created_at: string;
}

const STORAGE_KEY = "drika-ai-sessions";
const SAVED_KEY = "drika-ai-saved";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    // Keep only last 50 sessions to avoid storage overflow
    const trimmed = sessions.slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* full storage */ }
}


function loadSaved(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSavedMessages(msgs: ChatMessage[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(msgs.slice(0, 100))); } catch { }
}

// ═══════════════════════════════════════════════════════════

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
      <line key={i} x1={`${(i * 9) % 100}%`} y1={`${(i * 13 + 5) % 100}%`} x2={`${(i * 11 + 30) % 100}%`} y2={`${(i * 7 + 40) % 100}%`} stroke="url(#neural-grad)" strokeWidth="1" opacity="0.5" />
    ))}
    {Array.from({ length: 8 }).map((_, i) => (
      <circle key={`c-${i}`} cx={`${(i * 14 + 10) % 100}%`} cy={`${(i * 17 + 8) % 100}%`} r="2" fill="url(#neural-grad)" opacity="0.6" />
    ))}
  </svg>
);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function AIAssistantPage() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Build translated tools
  const AI_TOOLS = AI_TOOL_DEFS.map(def => ({
    ...def,
    label: t.ai[def.labelKey],
    description: t.ai[def.descKey],
    prompts: def.promptKeys.map(k => t.ai[k]),
  }));

  const [selectedTool, setSelectedTool] = useState(AI_TOOLS[0]);

  // Keep selectedTool in sync with language changes
  useEffect(() => {
    setSelectedTool(prev => AI_TOOLS.find(t2 => t2.id === prev.id) || AI_TOOLS[0]);
  }, [t]);
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [credits, setCredits] = useState<CreditsState>({ remaining: 100, daily: 100, loaded: false });
  const [savedMessages, setSavedMessages] = useState<ChatMessage[]>(() => loadSaved());
  const [showSaved, setShowSaved] = useState(false);
  const [dbHistory, setDbHistory] = useState<DbGeneration[]>([]);
  const [dbHistoryLoading, setDbHistoryLoading] = useState(false);
  const [showDbHistory, setShowDbHistory] = useState(false);
  const [dbFilterCategory, setDbFilterCategory] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TODO: Replace with real plan from tenant context
  const currentPlan = "pro";
  const planConfig = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free;
  const creditsRemaining = Math.max(0, credits.remaining);
  const creditsPercent = ((credits.daily - credits.remaining) / credits.daily) * 100;

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];

  // ═══ PERSIST ═══
  useEffect(() => { saveSessions(sessions); }, [sessions]);
  useEffect(() => { saveSavedMessages(savedMessages); }, [savedMessages]);

  // ═══ LOAD CREDITS FROM DB ═══
  const loadCreditsFromDb = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from("tenant_credits")
        .select("credits_remaining, daily_limit")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setCredits({ remaining: (data as any).credits_remaining, daily: (data as any).daily_limit, loaded: true });
      } else {
        // Create initial credits row
        await supabase.from("tenant_credits").insert({ tenant_id: tenantId, credits_remaining: 100, daily_limit: 100 } as any);
        setCredits({ remaining: 100, daily: 100, loaded: true });
      }
    } catch (e) {
      console.error("Error loading credits:", e);
      setCredits({ remaining: 100, daily: 100, loaded: true });
    }
  }, [tenantId]);

  useEffect(() => { loadCreditsFromDb(); }, [loadCreditsFromDb]);
  useEffect(() => { saveSavedMessages(savedMessages); }, [savedMessages]);

  // ═══ LOAD DB HISTORY ═══
  const loadDbHistory = useCallback(async () => {
    if (!tenantId) return;
    setDbHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_generations")
        .select("id, category, user_input, enhanced_prompt, result_text, result_image_url, credits_used, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setDbHistory((data as DbGeneration[]) || []);
    } catch (e: any) {
      console.error("Error loading AI history:", e);
    } finally {
      setDbHistoryLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (showDbHistory && tenantId) loadDbHistory();
  }, [showDbHistory, tenantId, loadDbHistory]);

  // ═══ SAVE TO DB ═══
  const saveGenerationToDb = useCallback(async (params: {
    category: string;
    userInput: string;
    enhancedPrompt?: string;
    resultText?: string;
    resultImageUrl?: string;
    creditsUsed: number;
  }) => {
    if (!tenantId || !user?.id) return;
    try {
      await supabase.from("ai_generations").insert({
        tenant_id: tenantId,
        user_id: user.id,
        category: params.category,
        user_input: params.userInput,
        enhanced_prompt: params.enhancedPrompt || null,
        result_text: params.resultText || null,
        result_image_url: params.resultImageUrl || null,
        credits_used: params.creditsUsed,
      } as any);
    } catch (e) {
      console.error("Error saving generation:", e);
    }
  }, [tenantId, user?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages.length, messages[messages.length - 1]?.content]);

  const consumeCredits = useCallback(async (amount: number) => {
    setCredits(prev => ({ ...prev, remaining: Math.max(0, prev.remaining - amount) }));
    if (tenantId) {
      try {
        const { data } = await supabase
          .from("tenant_credits")
          .select("credits_remaining")
          .eq("tenant_id", tenantId)
          .maybeSingle();
        const current = (data as any)?.credits_remaining ?? 100;
        await supabase
          .from("tenant_credits")
          .update({ credits_remaining: Math.max(0, current - amount), updated_at: new Date().toISOString() } as any)
          .eq("tenant_id", tenantId);
      } catch (e) {
        console.error("Error updating credits:", e);
      }
    }
  }, [tenantId]);

  const canAfford = useCallback((cost: number) => {
    return credits.remaining >= cost;
  }, [credits]);

  const createNewSession = (toolId: string, firstMessage?: string) => {
    const id = crypto.randomUUID();
    const session: ChatSession = {
      id,
      title: firstMessage?.slice(0, 50) || t.ai.newChat,
      messages: [],
      toolId,
      createdAt: new Date().toISOString(),
    };
    setSessions(prev => [session, ...prev]);
    setActiveSessionId(id);
    return id;
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setPrompt("");
    setAttachments([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: t.ai.fileTooLarge, description: t.ai.fileTooLargeDesc.replace("{name}", file.name), variant: "destructive" });
        continue;
      }
      if (!file.type.startsWith("image/")) {
        toast({ title: t.ai.unsupportedFormat, description: t.ai.sendImagesOnly, variant: "destructive" });
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setAttachments(prev => [...prev, { id: crypto.randomUUID(), type: "image", data: base64, name: file.name, preview: base64 }]);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // ═══ REUSE GENERATION ═══
  const handleReuse = (msg: ChatMessage) => {
    // Find the user message that preceded this assistant message
    if (!activeSession) return;
    const idx = activeSession.messages.findIndex(m => m.id === msg.id);
    if (idx <= 0) return;
    const userMsg = activeSession.messages[idx - 1];
    if (userMsg?.role === "user") {
      setPrompt(userMsg.content);
      const tool = AI_TOOLS.find(t2 => t2.id === msg.toolId);
      if (tool) setSelectedTool(tool);
      toast({ title: t.ai.promptRestored });
    }
  };

  // ═══ SAVE/BOOKMARK ═══
  const handleToggleSave = (msg: ChatMessage) => {
    const isSaved = savedMessages.some(m => m.id === msg.id);
    if (isSaved) {
      setSavedMessages(prev => prev.filter(m => m.id !== msg.id));
      toast({ title: t.ai.removedFromSaved });
    } else {
      setSavedMessages(prev => [{ ...msg, saved: true }, ...prev]);
      toast({ title: t.ai.savedSuccess, description: t.ai.savedDesc });
    }
  };

  // ═══ IMPROVE PROMPT ═══
  const handleImprovePrompt = async () => {
    if (!prompt.trim()) {
      toast({ title: t.ai.typeSomething, description: t.ai.writeIdeaToImprove, variant: "destructive" });
      return;
    }
    if (!canAfford(CREDIT_COSTS.improve)) {
      toast({ title: t.ai.insufficientCredits, description: t.ai.dailyLimitReached, variant: "destructive" });
      return;
    }
    setActionLoading("improve");
    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { action: "improve_prompt", prompt, context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPrompt(data.improved_prompt || prompt);
      consumeCredits(CREDIT_COSTS.improve);
      toast({ title: t.ai.promptImproved, description: t.ai.promptImprovedDesc });
    } catch (e: any) {
      toast({ title: t.ai.error, description: e.message || t.ai.errorImproving, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // ═══ GENERATE VARIATIONS ═══
  const handleGenerateVariations = async (originalContent: string, sessionId: string) => {
    if (!canAfford(CREDIT_COSTS.variations)) {
      toast({ title: t.ai.insufficientCredits, description: t.ai.dailyLimitReached, variant: "destructive" });
      return;
    }
    setActionLoading("variations");
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: t.ai.generateVariationsUser,
      toolId: selectedTool.id,
      timestamp: new Date().toISOString(),
    };
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, messages: [...s.messages, userMsg] } : s
    ));

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { action: "generate_variations", originalContent, context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.variations || t.ai.couldNotGenerate,
        toolId: selectedTool.id,
        timestamp: new Date().toISOString(),
      };
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s
      ));
      consumeCredits(CREDIT_COSTS.variations);
    } catch (e: any) {
      toast({ title: t.ai.error, description: e.message || t.ai.errorGeneratingVariations, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // ═══ GENERATE IMAGE VARIATION ═══
  const handleImageVariation = async (enhancedPrompt: string, sessionId: string) => {
    const cost = CREDIT_COSTS.image;
    if (!canAfford(cost)) {
      toast({ title: t.ai.insufficientCredits, description: t.ai.dailyLimitReached, variant: "destructive" });
      return;
    }
    setActionLoading("image_variation");
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: t.ai.generateImageVariationUser,
      toolId: "image",
      timestamp: new Date().toISOString(),
    };
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, messages: [...s.messages, userMsg] } : s
    ));

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { action: "generate_image_variation", originalContent: enhancedPrompt, context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.text || "",
        imageUrl: data.image_url || undefined,
        enhancedPrompt: data.enhanced_prompt || undefined,
        toolId: "image",
        timestamp: new Date().toISOString(),
      };
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s
      ));
      consumeCredits(cost);
    } catch (e: any) {
      toast({ title: t.ai.errorGeneratingVariation, description: e.message || t.ai.tryAgain, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // ═══ DOWNLOAD IMAGE ═══
  const handleDownloadImage = async (url: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `ai-generated-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast({ title: t.ai.downloadStarted });
    } catch {
      window.open(url, "_blank");
    }
  };

  // ═══ MAIN GENERATE ═══
  const handleGenerate = async () => {
    if (!prompt.trim() && attachments.length === 0) {
      toast({ title: t.ai.typeSomething, description: t.ai.writeWhatToGenerate, variant: "destructive" });
      return;
    }

    const cost = CREDIT_COSTS[selectedTool.id] || 1;
    if (!canAfford(cost)) {
      toast({ title: t.ai.limitReached, description: t.ai.limitReachedDesc.replace("{n}", String(credits.daily)), variant: "destructive" });
      return;
    }

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = createNewSession(selectedTool.id, prompt || t.ai.imageAnalysis);
    }

    const currentAttachments = [...attachments];
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt || (currentAttachments.length > 0 ? t.ai.analyzeImage : ""),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      toolId: selectedTool.id,
      timestamp: new Date().toISOString(),
    };

    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, messages: [...s.messages, userMsg], title: s.messages.length === 0 ? (prompt || "Análise de imagem").slice(0, 50) : s.title } : s
    ));

    const currentPrompt = prompt || (currentAttachments.length > 0 ? "Analise detalhadamente esta imagem." : "");
    setPrompt("");
    setAttachments([]);
    setLoading(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const assistantMsgId = crypto.randomUUID();

    try {
      if (selectedTool.id === "image") {
        const apiAttachments = currentAttachments.map(a => ({ type: a.type, data: a.data }));
        const { data, error } = await supabase.functions.invoke("ai-assistant", {
          body: {
            type: "image",
            prompt: currentPrompt,
            context,
            attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
          },
        });
        if (abortController.signal.aborted) throw new Error("Geração cancelada");
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const assistantMsg: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: data?.text || "",
          imageUrl: data?.image_url || undefined,
          enhancedPrompt: data?.enhanced_prompt || undefined,
          toolId: selectedTool.id,
          timestamp: new Date().toISOString(),
        };
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s
        ));
        saveGenerationToDb({
          category: "image",
          userInput: currentPrompt,
          enhancedPrompt: data?.enhanced_prompt,
          resultText: data?.text,
          resultImageUrl: data?.image_url,
          creditsUsed: cost,
        });
      } else {
        const emptyAssistant: ChatMessage = {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          toolId: selectedTool.id,
          timestamp: new Date().toISOString(),
        };
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, messages: [...s.messages, emptyAssistant] } : s
        ));

        const apiAttachments = currentAttachments.map(a => ({ type: a.type, data: a.data }));

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            type: selectedTool.id,
            prompt: currentPrompt,
            context,
            attachments: apiAttachments.length > 0 ? apiAttachments : undefined,
          }),
          signal: abortController.signal,
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
      consumeCredits(cost);
      // Save text generation to DB (get final accumulated content from session)
      const finalSession = sessions.find(s => s.id === sessionId);
      const finalMsg = finalSession?.messages.find(m => m.id === assistantMsgId);
      if (selectedTool.id !== "image") {
        // For streamed text, we need to read the accumulated content
        // We save after the streaming is done
        setTimeout(() => {
          setSessions(prev => {
            const sess = prev.find(s => s.id === sessionId);
            const msg = sess?.messages.find(m => m.id === assistantMsgId);
            if (msg?.content) {
              saveGenerationToDb({
                category: selectedTool.id,
                userInput: currentPrompt,
                resultText: msg.content,
                creditsUsed: cost,
              });
            }
            return prev;
          });
        }, 100);
      }
    } catch (e: any) {
      if (e.name === "AbortError" || e.message === "Geração cancelada") {
        toast({ title: "Cancelado", description: "Geração interrompida." });
      } else {
        toast({ title: "Erro", description: e.message || "Erro ao gerar conteúdo", variant: "destructive" });
      }
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: s.messages.filter(m => m.id !== assistantMsgId || m.content) } : s
      ));
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setLoading(false);
    abortControllerRef.current = null;
  };

  const handleCopy = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopied(msgId);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDeleteSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const filteredSessions = sessions.filter(s => s.toolId === selectedTool.id);

  const lastAssistantContent = messages.filter(m => m.role === "assistant" && m.content && !m.imageUrl).pop()?.content;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ═══════════════ HERO ═══════════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/10 min-h-[180px]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0015] via-[#1a0025] to-[#050020]" />
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 20% 40%, rgba(196,74,255,0.15) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 75% 20%, rgba(255,105,180,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 50% 60% at 50% 90%, rgba(59,130,246,0.1) 0%, transparent 50%)
          `
        }} />
        <ParticleField />
        <NeuralLines />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)`
        }} />
        <div className="absolute top-0 left-0 right-0 h-[2px]">
          <div className="h-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="h-8 bg-gradient-to-b from-primary/10 to-transparent" />
        </div>

        <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative group">
            <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-primary/20 via-[#C44AFF]/20 to-primary/20 blur-xl animate-pulse opacity-60" />
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/30 to-[#C44AFF]/30 animate-spin" style={{ animationDuration: "8s" }} />
            <div className="relative h-18 w-18 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-[#1a0a20] to-[#0a0520] border border-primary/20 flex items-center justify-center backdrop-blur-sm overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
              <Brain className="h-9 w-9 sm:h-10 sm:w-10 text-primary drop-shadow-[0_0_15px_rgba(255,105,180,0.6)] relative z-10" />
            </div>
            <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 border-2 border-background flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-primary/90 to-[#C44AFF] tracking-tight">
                Gerador IA
              </h1>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 backdrop-blur-sm">
                <div className="relative h-2 w-2">
                  <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                  <div className="relative h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">Neural Ativa</span>
              </div>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] rounded-full bg-gradient-to-r from-primary/15 to-[#C44AFF]/15 text-primary border border-primary/20 backdrop-blur-sm">
                v4.0 Orchestrator
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
              Escreva pouco, receba muito — textos, imagens e estratégias de nível premium com orquestração inteligente.
            </p>
          </div>

          {/* ── Credits Widget ── */}
          <div className="hidden lg:flex flex-col items-end gap-3 min-w-[200px]">
            <div className="w-full p-3.5 rounded-2xl bg-card/50 border border-border/20 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Flame className={cn("h-4 w-4", creditsPercent > 80 ? "text-red-400" : "text-primary")} />
                  <span className="text-[11px] font-bold text-foreground/80">Créditos Diários</span>
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", planConfig.color,
                  currentPlan === "pro" ? "bg-primary/10 border-primary/20" :
                  currentPlan === "business" ? "bg-emerald-400/10 border-emerald-400/20" :
                  "bg-muted/20 border-border/20"
                )}>
                  {planConfig.badge}
                </span>
              </div>
              <div className="flex items-end justify-between mb-1.5">
                <span className={cn("text-2xl font-extrabold tabular-nums", creditsRemaining <= 5 ? "text-red-400" : "text-foreground")}>
                  {creditsRemaining}
                </span>
                <span className="text-[10px] text-muted-foreground/60">/ {credits.daily} hoje</span>
              </div>
              <Progress value={Math.min(creditsPercent, 100)} className="h-1.5" />
              {creditsPercent >= 80 && (
                <p className="text-[9px] text-red-400/70 mt-1.5 flex items-center gap-1">
                  <TrendingUp className="h-2.5 w-2.5" />
                  Créditos baixos — faça upgrade!
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
              <div className="h-1.5 w-1.5 rounded-full bg-primary/60" />
              <span className="font-medium">Custo: {CREDIT_COSTS[selectedTool.id] || 1} crédito(s) por geração</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      {/* ── Mobile Credits Bar ── */}
      <div className="lg:hidden flex items-center gap-3 p-3 rounded-2xl bg-card/50 border border-border/20">
        <Flame className={cn("h-4 w-4 shrink-0", creditsPercent > 80 ? "text-red-400" : "text-primary")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold">{creditsRemaining} créditos restantes</span>
            <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", planConfig.color, "bg-primary/10 border border-primary/20")}>
              {planConfig.badge}
            </span>
          </div>
          <Progress value={Math.min(creditsPercent, 100)} className="h-1" />
        </div>
      </div>

      {/* ═══════════════ TOOL SELECTOR ═══════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {AI_TOOLS.map((tool) => {
          const isActive = selectedTool.id === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => { setSelectedTool(tool); setActiveSessionId(null); setShowSaved(false); }}
              className={cn(
                "relative group flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-500 text-center overflow-hidden",
                isActive
                  ? `bg-card/80 border-primary/30 ${tool.glow} ring-1 ${tool.ring} scale-[1.02]`
                  : "bg-card/30 border-border/20 hover:border-primary/15 hover:bg-card/50 hover:scale-[1.01]"
              )}
            >
              {isActive && (
                <>
                  <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(circle at 50% 0%, white 0%, transparent 60%)` }} />
                  <div className="absolute -inset-px rounded-2xl opacity-20" style={{ backgroundImage: `conic-gradient(from 0deg, transparent, rgba(196,74,255,0.3), transparent, rgba(255,105,180,0.3), transparent)` }} />
                </>
              )}
              <div className={cn(
                "relative h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-500",
                isActive ? `bg-gradient-to-br ${tool.gradient} shadow-lg` : `${tool.bgAccent} group-hover:scale-105`
              )}>
                <tool.icon className={cn("h-5 w-5 transition-all duration-300", isActive ? "text-white" : "text-muted-foreground")} />
                {isActive && <div className="absolute inset-0 rounded-xl bg-white/10 animate-pulse" />}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-lg leading-none">{tool.emoji}</span>
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                  tool.credits >= 3 ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" :
                  tool.credits >= 2 ? "bg-purple-500/15 text-purple-400 border border-purple-500/20" :
                  "bg-muted/20 text-muted-foreground/60 border border-border/20"
                )}>
                  {tool.credits}cr
                </span>
              </div>
              <span className={cn("text-xs font-bold tracking-wide", isActive ? "text-foreground" : "text-muted-foreground")}>{tool.label}</span>
              <span className="text-[10px] text-muted-foreground/50 leading-tight">{tool.description}</span>
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
          <Button onClick={handleNewChat} className={cn("w-full gap-2 rounded-xl text-white font-bold shadow-lg hover:scale-[1.02] transition-all duration-300 h-11", "bg-gradient-to-r", selectedTool.gradient)}>
            <Plus className="h-4 w-4" />
            Novo Chat
          </Button>

          {/* Sidebar Tabs: Histórico | Salvos | Banco */}
          <div className="flex gap-1 p-1 rounded-xl bg-card/30 border border-border/20">
            <button
              onClick={() => { setShowSaved(false); setShowDbHistory(false); }}
              className={cn("flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all",
                !showSaved && !showDbHistory ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              <History className="h-3 w-3" /> Chats
            </button>
            <button
              onClick={() => { setShowSaved(true); setShowDbHistory(false); }}
              className={cn("flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all",
                showSaved ? "bg-amber-400/15 text-amber-400 border border-amber-400/20" : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              <Bookmark className="h-3 w-3" /> Salvos
              {savedMessages.length > 0 && (
                <span className="text-[8px] bg-amber-400/20 px-1 rounded">{savedMessages.length}</span>
              )}
            </button>
            <button
              onClick={() => { setShowDbHistory(true); setShowSaved(false); }}
              className={cn("flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all",
                showDbHistory ? "bg-emerald-400/15 text-emerald-400 border border-emerald-400/20" : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              <Database className="h-3 w-3" /> Banco
              {dbHistory.length > 0 && (
                <span className="text-[8px] bg-emerald-400/20 px-1 rounded">{dbHistory.length}</span>
              )}
            </button>
          </div>

          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden">
            <ScrollArea className="h-[180px]">
              {showDbHistory ? (
                <>
                  {/* Category filter */}
                  <div className="sticky top-0 z-10 flex gap-1 p-2 bg-card/80 backdrop-blur-md border-b border-border/10">
                    {[{ id: "all", label: "Todos" }, ...AI_TOOLS.map(t => ({ id: t.id, label: t.emoji }))].map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setDbFilterCategory(cat.id)}
                        className={cn("px-2 py-1 rounded-lg text-[9px] font-bold transition-all",
                          dbFilterCategory === cat.id ? "bg-emerald-400/15 text-emerald-400 border border-emerald-400/20" : "text-muted-foreground/50 hover:text-muted-foreground"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  {dbHistoryLoading ? (
                    <div className="flex items-center justify-center py-14">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
                    </div>
                  ) : dbHistory.filter(g => dbFilterCategory === "all" || g.category === dbFilterCategory).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                      <Database className="h-8 w-8 text-muted-foreground/15 mb-3" />
                      <p className="text-xs text-muted-foreground/50">Nenhuma geração encontrada</p>
                      <p className="text-[10px] text-muted-foreground/40 mt-1">Suas gerações serão salvas aqui</p>
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {dbHistory
                        .filter(g => dbFilterCategory === "all" || g.category === dbFilterCategory)
                        .map(gen => {
                          const tool = AI_TOOLS.find(t => t.id === gen.category);
                          return (
                            <div
                              key={gen.id}
                              className="group flex items-start gap-2 px-3 py-2.5 rounded-xl hover:bg-emerald-400/5 border border-transparent hover:border-emerald-400/15 transition-all"
                            >
                              <span className="text-sm shrink-0 mt-0.5">{tool?.emoji || "🤖"}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-foreground/70 line-clamp-1 font-medium">{gen.user_input || "Sem input"}</p>
                                <p className="text-[10px] text-muted-foreground/50 line-clamp-1 mt-0.5">
                                  {gen.result_image_url ? "🖼️ Imagem gerada" : (gen.result_text?.slice(0, 60) || "...")}
                                </p>
                                <p className="text-[9px] text-muted-foreground/40 mt-1">
                                  {tool?.label} • {gen.credits_used}cr • {new Date(gen.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => { setPrompt(gen.user_input); if (tool) setSelectedTool(tool); setShowDbHistory(false); toast({ title: "♻️ Prompt restaurado!" }); }}
                                  className="p-1 rounded hover:bg-emerald-400/10"
                                  title="Reutilizar"
                                >
                                  <RotateCw className="h-3 w-3 text-emerald-400" />
                                </button>
                                <button
                                  onClick={() => handleCopy(gen.result_text || gen.enhanced_prompt || gen.user_input, gen.id)}
                                  className="p-1 rounded hover:bg-primary/10"
                                  title="Copiar"
                                >
                                  {copied === gen.id ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3 text-muted-foreground/50" />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </>
              ) : showSaved ? (
                savedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                    <Bookmark className="h-8 w-8 text-muted-foreground/15 mb-3" />
                    <p className="text-xs text-muted-foreground/50">Nenhuma geração salva</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-1">Clique ⭐ em qualquer resultado</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {savedMessages.map(msg => (
                      <div
                        key={msg.id}
                        className="group flex items-start gap-2 px-3 py-2.5 rounded-xl hover:bg-amber-400/5 border border-transparent hover:border-amber-400/15 cursor-pointer transition-all"
                        onClick={() => {
                          handleCopy(msg.content, msg.id);
                        }}
                      >
                        <BookmarkCheck className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-foreground/70 line-clamp-2">{msg.content.slice(0, 100)}...</p>
                          <p className="text-[9px] text-muted-foreground/40 mt-1">
                            {AI_TOOLS.find(t => t.id === msg.toolId)?.emoji} {AI_TOOLS.find(t => t.id === msg.toolId)?.label}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleSave(msg); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10"
                        >
                          <X className="h-3 w-3 text-destructive/50" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                filteredSessions.length === 0 ? (
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
                          activeSessionId === session.id ? "bg-primary/10 border border-primary/20 shadow-sm" : "hover:bg-muted/30 border border-transparent"
                        )}
                        onClick={() => { setActiveSessionId(session.id); setShowSaved(false); setShowDbHistory(false); }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                          className="shrink-0 p-1 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all"
                          title="Excluir chat"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <div className={cn("h-6 w-6 rounded-lg flex items-center justify-center shrink-0", activeSessionId === session.id ? "bg-primary/20" : "bg-muted/20")}>
                          <MessageSquare className="h-3 w-3 text-muted-foreground/60" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground/80 truncate">{session.title}</p>
                          <p className="text-[10px] text-muted-foreground/55">
                            {session.messages.length} msg • {new Date(session.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </ScrollArea>
          </div>

          {!activeSessionId && !showSaved && (
            <div className="rounded-2xl border border-primary/10 p-4 bg-gradient-to-b from-card/50 to-card/30 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-primary/70" />
                <p className="text-[10px] font-bold text-foreground/60 uppercase tracking-[0.2em]">Sugestões Rápidas</p>
              </div>
              <div className="space-y-1.5">
                {selectedTool.prompts.map((p, i) => (
                  <button key={i} onClick={() => setPrompt(p)} className="w-full text-left text-[11px] px-3 py-2.5 rounded-xl border border-border/15 text-muted-foreground/70 hover:bg-primary/5 hover:border-primary/20 hover:text-foreground/90 transition-all duration-300 group">
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
          <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px"
          }} />

          {/* Chat Header */}
          <div className="relative flex items-center justify-between px-5 py-3.5 border-b border-border/10 bg-card/40 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-2.5 w-2.5 rounded-full transition-all duration-700",
                loading || actionLoading
                  ? "bg-yellow-400 animate-pulse shadow-[0_0_12px_rgba(250,204,21,0.6)]"
                  : messages.length > 0 ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-muted-foreground/20"
              )} />
              <div>
                <p className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                  {activeSession ? activeSession.title.slice(0, 30) : selectedTool.label}
                </p>
                {!loading && messages.length > 0 && (
                  <p className="text-[10px] text-muted-foreground/55">{messages.length} mensagens</p>
                )}
              </div>
              {actionLoading && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 border border-primary/15 animate-fade-in ml-2">
                  <div className="relative h-3.5 w-3.5">
                    <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                  </div>
                  <span className="text-[10px] font-semibold text-primary/80 tracking-wide">
                    {actionLoading === "improve" ? "Melhorando..." : actionLoading === "variations" ? "Gerando 3 variações..." : "Gerando variação..."}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0 relative z-10">
            <div className="p-5 space-y-5">
              {messages.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
                  <div className="relative">
                    <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-primary/10 to-[#C44AFF]/10 blur-2xl animate-pulse" />
                    <div className={cn("relative h-24 w-24 rounded-3xl flex items-center justify-center border border-border/15", selectedTool.bgAccent)}>
                      <selectedTool.icon className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground/80 mb-1">Escreva pouco, receba muito</p>
                    <p className="text-xs text-muted-foreground/60 max-w-[320px] leading-relaxed">
                      Digite uma ideia simples e o Gerador IA entrega resultados de agência premium automaticamente
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-muted-foreground/45">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/10 border border-border/10">
                      <Wand2 className="h-3 w-3" /> Melhorar prompt
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/10 border border-border/10">
                      <RefreshCw className="h-3 w-3" /> 3 variações
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/10 border border-border/10">
                      <RotateCw className="h-3 w-3" /> Reutilizar
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/10 border border-border/10">
                      <Bookmark className="h-3 w-3" /> Favoritos
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/45">
                    <Orbit className="h-3 w-3" />
                    <span>Powered by Drika Engine v4.0</span>
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
                      {msg.role === "user" && msg.attachments && msg.attachments.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                          {msg.attachments.map(att => (
                            <div key={att.id} className="relative rounded-xl overflow-hidden border border-border/20 shadow-md">
                              <img src={att.preview} alt={att.name} className="max-w-[200px] max-h-[150px] object-cover" />
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.enhancedPrompt && (
                        <details className="mb-3 rounded-xl bg-primary/5 border border-primary/15 overflow-hidden">
                          <summary className="flex items-center gap-1.5 p-3 cursor-pointer select-none hover:bg-primary/5 transition-colors">
                            <Stars className="h-3 w-3 text-primary" />
                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Prompt Otimizado</span>
                            <span className="text-[9px] text-muted-foreground/50 ml-auto">{msg.enhancedPrompt.split(" ").length} palavras • clique para expandir</span>
                          </summary>
                          <div className="px-3 pb-3">
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{msg.enhancedPrompt}</p>
                            <button
                              onClick={() => handleCopy(msg.enhancedPrompt!, msg.id + "-prompt")}
                              className="mt-1.5 flex items-center gap-1 text-[9px] text-primary/60 hover:text-primary transition-colors"
                            >
                              {copied === msg.id + "-prompt" ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                              {copied === msg.id + "-prompt" ? "Copiado" : "Copiar prompt"}
                            </button>
                          </div>
                        </details>
                      )}

                      {msg.imageUrl && (
                        <div className="mb-3 space-y-2">
                          <div className="relative rounded-xl overflow-hidden border border-border/20 shadow-xl group/img max-w-[320px] cursor-pointer" onClick={() => setLightboxUrl(msg.imageUrl!)}>
                            <img src={msg.imageUrl} alt="IA Generated" className="w-full h-auto" />
                            <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-xl pointer-events-none" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-300" />
                            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 opacity-0 group-hover/img:opacity-100 transition-opacity duration-300">
                              <Button
                                variant="glass"
                                size="sm"
                                className="text-[11px] h-8 text-white border-white/20 hover:bg-white/20"
                                onClick={() => handleDownloadImage(msg.imageUrl!)}
                              >
                                <Download className="h-3.5 w-3.5 mr-1" />
                                Baixar
                              </Button>
                              {msg.enhancedPrompt && activeSessionId && (
                                <Button
                                  variant="glass"
                                  size="sm"
                                  className="text-[11px] h-8 text-white border-white/20 hover:bg-white/20"
                                  onClick={() => handleImageVariation(msg.enhancedPrompt!, activeSessionId!)}
                                  disabled={!!actionLoading}
                                >
                                  {actionLoading === "image_variation" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5 mr-1" />}
                                  Nova Variação
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[10px] h-7 border-border/20 hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleDownloadImage(msg.imageUrl!)}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Baixar Imagem
                            </Button>
                            {msg.enhancedPrompt && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-[10px] h-7 border-border/20 hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6]"
                                onClick={() => handleCopy(msg.enhancedPrompt!, msg.id + "-prompt-btn")}
                              >
                                {copied === msg.id + "-prompt-btn" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                Copiar Prompt
                              </Button>
                            )}
                            {msg.enhancedPrompt && activeSessionId && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-[10px] h-7 border-[#F59E0B]/20 bg-[#F59E0B]/5 hover:bg-[#F59E0B]/15 text-[#F59E0B] hover:text-[#F59E0B]"
                                onClick={() => handleImageVariation(msg.enhancedPrompt!, activeSessionId!)}
                                disabled={!!actionLoading}
                              >
                                {actionLoading === "image_variation" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                                Gerar Nova Variação (3cr)
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                      {msg.content && (
                        msg.imageUrl && msg.content.length > 200 ? (
                          <details className="rounded-xl bg-muted/10 border border-border/10 overflow-hidden">
                            <summary className="px-3 py-2 cursor-pointer select-none text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors">
                              📝 Ver detalhes da geração
                            </summary>
                            <div className="px-3 pb-3 whitespace-pre-wrap leading-relaxed text-[12px]">{msg.content}</div>
                          </details>
                        ) : (
                          <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                        )
                      )}

                      {/* ── Action buttons (premium feel) ── */}
                      {msg.role === "assistant" && msg.content && !loading && !actionLoading && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-border/15">
                          <button onClick={() => handleCopy(msg.content, msg.id)} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-primary transition-all px-3 py-2 rounded-xl border border-border/20 hover:border-primary/30 hover:bg-primary/10 bg-card/40 backdrop-blur-sm">
                            {copied === msg.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied === msg.id ? "Copiado" : "Copiar"}
                          </button>

                          <button
                            onClick={() => handleReuse(msg)}
                            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-emerald-400 transition-all px-3 py-2 rounded-xl border border-border/20 hover:border-emerald-400/30 hover:bg-emerald-400/10 bg-card/40 backdrop-blur-sm"
                            title="Reutilizar este prompt"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                            Reutilizar
                          </button>

                          <button
                            onClick={() => handleToggleSave(msg)}
                            className={cn("flex items-center gap-1.5 text-[11px] font-medium transition-all px-3 py-2 rounded-xl border backdrop-blur-sm",
                              savedMessages.some(m => m.id === msg.id)
                                ? "text-amber-400 bg-amber-400/10 border-amber-400/30"
                                : "text-muted-foreground hover:text-amber-400 border-border/20 hover:border-amber-400/30 hover:bg-amber-400/10 bg-card/40"
                            )}
                          >
                            {savedMessages.some(m => m.id === msg.id) ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                            {savedMessages.some(m => m.id === msg.id) ? "Salvo" : "Salvar"}
                          </button>

                          {/* ★ Generate 3 Variations (prominent) */}
                          {!msg.imageUrl && activeSessionId && (
                            <button
                              onClick={() => handleGenerateVariations(msg.content, activeSessionId!)}
                              className="flex items-center gap-1.5 text-[10px] font-bold text-[#8B5CF6] transition-all px-3 py-1.5 rounded-lg bg-[#8B5CF6]/8 border border-[#8B5CF6]/20 hover:bg-[#8B5CF6]/15 hover:scale-[1.02] ml-auto"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Gerar 3 Variações
                              <span className="text-[8px] px-1 py-0.5 rounded bg-[#8B5CF6]/15 border border-[#8B5CF6]/20">2cr</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Loading animation */}
                      {msg.role === "assistant" && !msg.content && !msg.imageUrl && loading && (
                        <div className="w-[300px] rounded-2xl border border-border/20 bg-card/80 backdrop-blur-sm p-5 shadow-xl animate-fade-in">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="relative h-10 w-10 shrink-0">
                              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/30 to-[#C44AFF]/30 animate-pulse" />
                              <div className="absolute inset-[2px] rounded-[10px] bg-card flex items-center justify-center">
                                {selectedTool.id === "image" ? <Image className="h-4 w-4 text-primary" /> : <Brain className="h-4 w-4 text-primary" />}
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground/80">
                                {selectedTool.id === "image" ? "Gerando imagem..." : "Processando..."}
                              </p>
                              {selectedTool.id === "image" && (
                                <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground/50">
                                  <p>① Refinando prompt com GPT-4o...</p>
                                  <p>② Gerando imagem com SDXL Lightning...</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {selectedTool.id === "image" ? (
                            <div className="h-40 w-full rounded-xl bg-muted/10 border border-border/10 flex items-center justify-center relative overflow-hidden">
                              <Image className="h-10 w-10 text-muted-foreground/15 animate-pulse" />
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/10 overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-primary/40 to-[#C44AFF]/40" style={{ animation: "shimmer 2s linear infinite", width: "200%" }} />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {[90, 70, 50].map((w, i) => (
                                <div key={i} className="h-2 rounded-full overflow-hidden" style={{ width: `${w}%` }}>
                                  <div className="h-full w-[200%] bg-gradient-to-r from-muted/30 via-muted/10 to-muted/30" style={{ animation: "shimmer 2s linear infinite", animationDelay: `${i * 300}ms` }} />
                                </div>
                              ))}
                            </div>
                          )}

                          <button
                            onClick={handleCancel}
                            className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium text-destructive/70 hover:text-destructive bg-destructive/5 hover:bg-destructive/10 border border-destructive/10 hover:border-destructive/20 transition-all"
                          >
                            <Square className="h-3 w-3 fill-current" />
                            Cancelar
                          </button>
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
            <div className="mb-2 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-0 p-1 rounded-xl bg-card/40 border border-border/20 backdrop-blur-md lg:hidden">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-primary/15 text-primary border border-primary/25 shadow-sm">
                  <Zap className="h-3 w-3" />
                  Drika Engine
                </div>
              </div>
              <button onClick={() => setShowContext(!showContext)} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-primary/80 transition-colors font-medium">
                <ChevronDown className={cn("h-3 w-3 transition-transform duration-300", showContext && "rotate-180")} />
                Contexto (opcional)
              </button>

              {/* Credit cost indicator */}
              <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                <Gauge className="h-3 w-3" />
                <span>Esta geração: <strong className="text-foreground/70">{CREDIT_COSTS[selectedTool.id] || 1} crédito(s)</strong></span>
              </div>
            </div>
            {showContext && (
              <Textarea
                placeholder="Ex: Minha loja vende contas de jogos..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="mb-2 min-h-[50px] bg-muted/10 border-border/15 text-xs resize-none"
              />
            )}

            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map(att => (
                  <div key={att.id} className="relative group/att rounded-xl overflow-hidden border border-primary/20 shadow-md">
                    <img src={att.preview} alt={att.name} className="h-16 w-16 object-cover" />
                    <button onClick={() => removeAttachment(att.id)} className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity">
                      <X className="h-3 w-3 text-white" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-[8px] text-white text-center py-0.5 truncate px-1">{att.name}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="relative group/input">
              <div className={cn("absolute -inset-px rounded-xl transition-opacity duration-500 opacity-0 group-focus-within/input:opacity-100", `bg-gradient-to-r ${selectedTool.gradient} blur-sm`)} />
              <div className="relative flex items-end gap-2 rounded-xl border border-primary/10 bg-card/80 p-2 backdrop-blur-sm">
                <Button variant="ghost" size="icon" type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || !!actionLoading} className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-all" title="Enviar imagem">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />

                <Textarea
                  placeholder={
                    attachments.length > 0 ? "Descreva o que deseja saber sobre a imagem..."
                      : selectedTool.id === "image" ? "Descreva a imagem que deseja gerar..."
                      : selectedTool.id === "prompt_enhancer" ? "Digite uma ideia simples para transformar em prompt profissional..."
                      : "Escreva seu prompt para o Gerador IA..."
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                  className="min-h-[44px] max-h-[120px] bg-transparent border-0 text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0 py-2.5 placeholder:text-muted-foreground/40"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={handleImprovePrompt}
                  disabled={loading || !!actionLoading || !prompt.trim()}
                  className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground/60 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-all"
                  title="Melhorar prompt com IA (1cr)"
                >
                  {actionLoading === "improve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                </Button>

                {loading ? (
                  <Button size="icon" onClick={handleCancel}
                    className="h-10 w-10 rounded-xl shrink-0 shadow-lg transition-all duration-300 bg-destructive hover:bg-destructive/80 hover:scale-110">
                    <Square className="h-4 w-4 text-white fill-white" />
                  </Button>
                ) : (
                  <Button size="icon" onClick={handleGenerate} disabled={!!actionLoading || (!prompt.trim() && attachments.length === 0)}
                    className={cn("h-10 w-10 rounded-xl shrink-0 shadow-lg transition-all duration-300", "bg-gradient-to-r", selectedTool.gradient, "hover:scale-110 hover:shadow-xl disabled:opacity-30 disabled:hover:scale-100")}>
                    <Send className="h-4 w-4 text-white" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/40 mt-2 text-center tracking-wide">
              ✨ Melhorar (varinha) • 📎 Imagens • 🔄 3 Variações • ⭐ Salvar • ♻️ Reutilizar • Enter para enviar
            </p>
          </div>
        </div>
      </div>

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

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
