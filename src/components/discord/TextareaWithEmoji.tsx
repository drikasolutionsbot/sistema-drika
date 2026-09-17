import { useRef, useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Lock, Search, SmilePlus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
  available?: boolean;
  blocked?: boolean;
  url: string;
  formatted: string;
}

const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Frequentes",
    icon: "⏱",
    emojis: [
      "📩", "🎫", "✅", "🛒", "🔒", "🔓", "⭐", "🎁", "💎", "🏆",
      "🚀", "⚡", "💬", "🔔", "❤️", "👍", "🎮", "🎯", "💡", "🔑",
      "🛡️", "⚙️", "📌", "✨", "💪", "🤝", "💥", "🌟", "🎊", "📢",
      "🔥", "💰", "📦", "👑", "🎉", "❌", "🔗", "📋", "🏷️", "🧾",
      "✉️", "📬", "🛎️", "🆘", "❓", "💳", "🪙", "🎟️", "📝", "🔐",
      "→", "➡️", "▶️", "🔹", "🔸", "▫️", "▪️", "•", "◆", "◇",
    ],
  },
  {
    label: "Rostos",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊",
      "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋",
      "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🫡",
      "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
      "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮",
      "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓",
    ],
  },
  {
    label: "Gestos",
    icon: "👋",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌",
      "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉",
      "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛",
      "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "💪", "🦾",
    ],
  },
  {
    label: "Objetos",
    icon: "🎮",
    emojis: [
      "⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🕹️", "🎮", "🔌",
      "💡", "🔦", "🕯️", "🧯", "🛢️", "💸", "💵", "💴", "💶", "💷",
      "🪙", "💰", "💳", "💎", "⚖️", "🪜", "🧰", "🪛", "🔧", "🔨",
      "⚒️", "🛠️", "⛏️", "🪚", "🔩", "⚙️", "🗜️", "⚗️", "🧪", "🧫",
      "🧬", "🔬", "🔭", "📡", "🛰️", "🎁", "🎈", "🎀", "🪄", "🔮",
    ],
  },
  {
    label: "Símbolos",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️",
      "✅", "❌", "⭕", "🛑", "⛔", "💯", "❗", "❓", "‼️", "⁉️",
      "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🔺", "🔻",
    ],
  },
];

const CUSTOM_EMOJI_CACHE_TTL_MS = 5 * 60 * 1000;

type EmojiCacheEntry = {
  emojis: DiscordEmoji[];
  loading: boolean;
  fetchedAt: number;
  promise?: Promise<void>;
};

const emojiCacheTA: Record<string, EmojiCacheEntry> = {};

interface TextareaWithEmojiProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

const TextareaWithEmoji = ({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
}: TextareaWithEmojiProps) => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const tenantName = tenant?.name;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("servidor");
  const [customEmojis, setCustomEmojis] = useState<DiscordEmoji[]>(() =>
    tenantId && emojiCacheTA[tenantId] ? emojiCacheTA[tenantId].emojis : []
  );
  const [loadingCustom, setLoadingCustom] = useState(false);
  const cursorPosRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open || !tenantId) return;

    const cached = emojiCacheTA[tenantId];
    if (cached && !cached.loading) {
      setCustomEmojis(cached.emojis);
      const fresh = Date.now() - cached.fetchedAt < CUSTOM_EMOJI_CACHE_TTL_MS;
      if (fresh && cached.emojis.length > 0) return;
    }

    if (cached?.loading && cached.promise) {
      setLoadingCustom(true);
      cached.promise.then(() => {
        setCustomEmojis(emojiCacheTA[tenantId]?.emojis ?? []);
        setLoadingCustom(false);
      });
      return;
    }

    setLoadingCustom(true);
    emojiCacheTA[tenantId] = {
      emojis: cached?.emojis ?? [],
      loading: true,
      fetchedAt: cached?.fetchedAt ?? 0,
    };

    const fetchPromise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("discord-guild-emojis", {
          body: { tenant_id: tenantId },
        });
        if (error) throw error;
        const fetchedEmojis = Array.isArray(data) ? data : [];
        emojiCacheTA[tenantId] = { emojis: fetchedEmojis, loading: false, fetchedAt: Date.now() };
        setCustomEmojis(fetchedEmojis);
      } catch (e) {
        console.error("Failed to fetch emojis:", e);
        emojiCacheTA[tenantId] = { emojis: cached?.emojis ?? [], loading: false, fetchedAt: 0 };
        setCustomEmojis(cached?.emojis ?? []);
      } finally {
        setLoadingCustom(false);
      }
    })();

    emojiCacheTA[tenantId].promise = fetchPromise;
  }, [open, tenantId]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && textareaRef.current) {
      cursorPosRef.current = textareaRef.current.selectionStart ?? value.length;
    }
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  };

  const insertEmoji = (emojiStr: string) => {
    const pos = cursorPosRef.current ?? value.length;
    const before = value.slice(0, pos);
    const after = value.slice(pos);
    const newValue = `${before}${emojiStr}${after}`;
    onChange(newValue);
    setOpen(false);
    setSearch("");

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const newPos = pos + emojiStr.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
        cursorPosRef.current = newPos;
      }
    });
  };

  const searchLower = search.toLowerCase();
  const filteredCustom = customEmojis.filter((e) => e.name.toLowerCase().includes(searchLower));
  const getFilteredCategory = (emojis: string[]) => {
    if (!search) return emojis;
    return emojis.filter((e) => e.includes(search));
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={className}
        onBlur={(e) => {
          cursorPosRef.current = e.target.selectionStart ?? value.length;
        }}
      />
      <div className="absolute bottom-2 right-2">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              className="h-7 w-7 rounded-md bg-muted/80 hover:bg-muted border border-border/50 backdrop-blur-sm"
              title="Inserir emoji"
            >
              <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end" side="top">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar emojis..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-muted border-border"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-0.5 px-2 py-1.5 border-b border-border overflow-x-auto">
              <button
                onClick={() => setActiveTab("servidor")}
                className={`h-7 w-7 flex items-center justify-center rounded text-sm shrink-0 transition-colors ${activeTab === "servidor" ? "bg-primary/20" : "hover:bg-muted"}`}
                title={tenantName || "Servidor"}
                type="button"
              >
                🏠
              </button>
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => setActiveTab(cat.label.toLowerCase())}
                  className={`h-7 w-7 flex items-center justify-center rounded text-sm shrink-0 transition-colors ${activeTab === cat.label.toLowerCase() ? "bg-primary/20" : "hover:bg-muted"}`}
                  title={cat.label}
                  type="button"
                >
                  {cat.icon}
                </button>
              ))}
            </div>

            <ScrollArea className="h-56">
              <div className="p-2">
                {activeTab === "servidor" && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                      🏠 {tenantName || "Servidor"}
                    </p>
                    {loadingCustom ? (
                      <div className="flex items-center gap-2 justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Carregando...</span>
                      </div>
                    ) : filteredCustom.length > 0 ? (
                      <div className="grid grid-cols-8 gap-0.5">
                        {filteredCustom.map((emoji) => (
                          <button
                            key={emoji.id}
                            type="button"
                            onClick={() => insertEmoji(emoji.formatted)}
                            className={`relative h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors ${emoji.blocked ? "opacity-70" : ""}`}
                            title={`:${emoji.name}: ${emoji.blocked ? "(bloqueado)" : ""}`}
                          >
                            <img
                              src={emoji.url}
                              alt={emoji.name}
                              className="h-5 w-5 object-contain"
                              loading="lazy"
                            />
                            {emoji.blocked && (
                              <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-muted p-0.5">
                                <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center py-4 text-xs text-muted-foreground">
                        Nenhum emoji personalizado neste servidor
                      </p>
                    )}
                  </div>
                )}

                {EMOJI_CATEGORIES.map((cat) => {
                  if (activeTab !== cat.label.toLowerCase()) return null;
                  const filtered = getFilteredCategory(cat.emojis);
                  return (
                    <div key={cat.label}>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                        {cat.icon} {cat.label}
                      </p>
                      {filtered.length > 0 ? (
                        <div className="grid grid-cols-8 gap-0.5">
                          {filtered.map((emoji, i) => (
                            <button
                              key={`${emoji}-${i}`}
                              type="button"
                              onClick={() => insertEmoji(emoji)}
                              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-lg"
                              title={emoji}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center py-4 text-xs text-muted-foreground">
                          Nenhum emoji encontrado
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="border-t border-border p-2">
              <Input
                placeholder="Ou cole um emoji: 😀"
                value=""
                onChange={(e) => {
                  if (e.target.value) insertEmoji(e.target.value);
                }}
                className="h-8 text-xs bg-muted border-border"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default TextareaWithEmoji;
