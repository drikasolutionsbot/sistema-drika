import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Search, SmilePlus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
  available?: boolean;
  blocked?: boolean;
  url: string;
  formatted: string;
}

// ─── Unicode categories ───────────────────────────────────────────────────────

const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Frequentes",
    icon: "⏱",
    emojis: [
      "📩", "🎫", "✅", "🛒", "🔒", "🔓", "⭐", "🎁", "💎", "🏆",
      "🚀", "⚡", "💬", "🔔", "❤️", "👍", "🎮", "🎯", "💡", "🔑",
      "🛡️", "⚙️", "📌", "✨", "💪", "🤝", "💥", "🌟", "🎊", "📢",
      "🔥", "💰", "📦", "👑", "🎉", "❌", "🔗", "📋", "🏷️", "🧾",
    ],
  },
  {
    label: "Rostos",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊",
      "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋",
      "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🫡",
      "😎", "🤓", "🧐", "😏", "😒", "🙄", "😬", "😌", "😔", "😢",
      "😭", "😠", "🤬", "🤯", "😱", "🤡", "💀", "☠️", "👻", "🤖",
    ],
  },
  {
    label: "Gestos",
    icon: "👋",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "👌", "🤌", "✌️",
      "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️",
      "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "🤝",
      "🙏", "💪", "🦾", "🤲", "👐", "🫴", "🫳", "🫵",
    ],
  },
  {
    label: "Objetos",
    icon: "🎮",
    emojis: [
      "📱", "💻", "🖥️", "🕹️", "🎮", "🔌", "💡", "🔦", "💸", "💵",
      "🪙", "💰", "💳", "💎", "⚖️", "🧰", "🪛", "🔧", "🔨", "⚙️",
      "🎁", "🎈", "🎀", "🪄", "🔮", "📦", "🏷️", "🛒", "🔑", "🔐",
      "🔒", "🔓", "📝", "📋", "📌", "📎", "✏️", "📢", "🔔", "🛎️",
    ],
  },
  {
    label: "Símbolos",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "✅", "❌", "⭕", "🛑", "⛔", "💯", "❗", "❓", "‼️", "⁉️",
      "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🔺", "🔻",
      "▶️", "⏸️", "⏹️", "⏭️", "🔁", "🔀", "🔃", "📶", "🔝", "🆕",
    ],
  },
];

// ─── Module-level cache (shared across all instances) ────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  emojis: DiscordEmoji[];
  loading: boolean;
  fetchedAt: number;
  promise?: Promise<void>;
};

const emojiCache: Record<string, CacheEntry> = {};

// ─── Helper: render current emoji in button ───────────────────────────────────

function renderEmojiPreview(value: string) {
  const customMatch = value.match(/^<a?:(\w+):(\d+)>/);
  if (customMatch) {
    const animated = value.startsWith("<a:");
    return (
      <img
        src={`https://cdn.discordapp.com/emojis/${customMatch[2]}.${animated ? "gif" : "png"}`}
        alt={customMatch[1]}
        className="h-5 w-5 object-contain"
      />
    );
  }
  return <span className="text-base leading-none">{value}</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface EmojiPickerButtonProps {
  /** Unicode emoji or Discord custom format `<:name:id>` / `<a:name:id>` */
  value: string;
  onChange: (emoji: string) => void;
  /** Extra className for the trigger button */
  className?: string;
  /** Button size variant */
  size?: "sm" | "default";
}

/**
 * Standalone emoji picker button.
 * Renders a small button that shows the current emoji (or SmilePlus icon).
 * Opens a popover with:
 *   - Custom emojis from the client's Discord server
 *   - Unicode emoji categories
 *   - Search
 *   - Manual paste input
 *
 * Usage: place next to any <Input> that accepts a single emoji.
 */
const EmojiPickerButton = ({ value, onChange, className, size = "default" }: EmojiPickerButtonProps) => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const tenantName = tenant?.name;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("servidor");
  const [customEmojis, setCustomEmojis] = useState<DiscordEmoji[]>(() =>
    tenantId && emojiCache[tenantId] ? emojiCache[tenantId].emojis : []
  );
  const [loadingCustom, setLoadingCustom] = useState(false);

  useEffect(() => {
    if (!open || !tenantId) return;

    const cached = emojiCache[tenantId];
    if (cached && !cached.loading) {
      setCustomEmojis(cached.emojis);
      if (Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.emojis.length > 0) return;
    }

    if (cached?.loading && cached.promise) {
      setLoadingCustom(true);
      cached.promise.then(() => {
        setCustomEmojis(emojiCache[tenantId]?.emojis ?? []);
        setLoadingCustom(false);
      });
      return;
    }

    setLoadingCustom(true);
    emojiCache[tenantId] = { emojis: cached?.emojis ?? [], loading: true, fetchedAt: cached?.fetchedAt ?? 0 };

    const fetchPromise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("discord-guild-emojis", {
          body: { tenant_id: tenantId },
        });
        if (error) throw error;
        const fetched = Array.isArray(data) ? data : [];
        emojiCache[tenantId] = { emojis: fetched, loading: false, fetchedAt: Date.now() };
        setCustomEmojis(fetched);
      } catch {
        emojiCache[tenantId] = { emojis: cached?.emojis ?? [], loading: false, fetchedAt: 0 };
        setCustomEmojis(cached?.emojis ?? []);
      } finally {
        setLoadingCustom(false);
      }
    })();

    emojiCache[tenantId].promise = fetchPromise;
  }, [open, tenantId]);

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
    setSearch("");
  };

  const handleCustomSelect = (emoji: DiscordEmoji) => {
    onChange(emoji.formatted);
    setOpen(false);
    setSearch("");
  };

  const searchLower = search.toLowerCase();
  const filteredCustom = customEmojis.filter((e) => e.name.toLowerCase().includes(searchLower));
  const getFilteredUnicode = (emojis: string[]) =>
    search ? emojis.filter((e) => e.includes(search)) : emojis;

  const btnSize = size === "sm" ? "h-8 w-8" : "h-9 w-9";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={`${btnSize} shrink-0 ${className ?? ""}`}
          title="Escolher emoji do servidor"
        >
          {value ? renderEmojiPreview(value) : <SmilePlus className="h-4 w-4 text-muted-foreground" />}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        {/* Search */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Pesquisar emojis..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-muted border-border"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-0.5 px-2 py-1.5 border-b border-border overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("servidor")}
            className={`h-7 w-7 flex items-center justify-center rounded text-sm shrink-0 transition-colors ${
              activeTab === "servidor" ? "bg-primary/20" : "hover:bg-muted"
            }`}
            title={tenantName || "Servidor"}
          >
            🏠
          </button>
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => setActiveTab(cat.label.toLowerCase())}
              className={`h-7 w-7 flex items-center justify-center rounded text-sm shrink-0 transition-colors ${
                activeTab === cat.label.toLowerCase() ? "bg-primary/20" : "hover:bg-muted"
              }`}
              title={cat.label}
            >
              {cat.icon}
            </button>
          ))}
        </div>

        <ScrollArea className="h-52">
          <div className="p-2">
            {/* Server custom emojis */}
            {activeTab === "servidor" && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                  🏠 {tenantName || "Servidor"}
                </p>
                {loadingCustom ? (
                  <div className="flex items-center gap-2 justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Carregando emojis do servidor...</span>
                  </div>
                ) : filteredCustom.length > 0 ? (
                  <div className="grid grid-cols-8 gap-0.5">
                    {filteredCustom.map((emoji) => (
                      <button
                        key={emoji.id}
                        type="button"
                        onClick={() => handleCustomSelect(emoji)}
                        className={`relative h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors ${
                          emoji.blocked ? "opacity-60" : ""
                        }`}
                        title={`:${emoji.name}:${emoji.blocked ? " (bloqueado)" : ""}`}
                      >
                        <img src={emoji.url} alt={emoji.name} className="h-5 w-5 object-contain" loading="lazy" />
                        {emoji.blocked && (
                          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-muted p-0.5">
                            <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-xs text-muted-foreground">
                    Nenhum emoji personalizado neste servidor
                  </p>
                )}
              </div>
            )}

            {/* Unicode categories */}
            {EMOJI_CATEGORIES.map((cat) => {
              if (activeTab !== cat.label.toLowerCase()) return null;
              const emojis = getFilteredUnicode(cat.emojis);
              return (
                <div key={cat.label}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                    {cat.icon} {cat.label}
                  </p>
                  {emojis.length > 0 ? (
                    <div className="grid grid-cols-8 gap-0.5">
                      {emojis.map((emoji, i) => (
                        <button
                          key={`${emoji}-${i}`}
                          type="button"
                          onClick={() => handleSelect(emoji)}
                          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-lg"
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-6 text-xs text-muted-foreground">Nenhum encontrado</p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Manual paste */}
        <div className="border-t border-border p-2">
          <Input
            placeholder="Ou cole um emoji: 😀"
            value=""
            onChange={(e) => {
              if (e.target.value) handleSelect(e.target.value);
            }}
            className="h-8 text-xs bg-muted border-border"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPickerButton;
