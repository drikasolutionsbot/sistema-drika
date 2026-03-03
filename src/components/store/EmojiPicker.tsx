import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, SmilePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
  url: string;
  formatted: string;
}

interface EmojiPickerProps {
  value: string | null;
  onChange: (emoji: string) => void;
}

const EMOJI_CATEGORIES: { label: string; icon: string; emojis: string[] }[] = [
  {
    label: "Frequentes",
    icon: "⏱",
    emojis: [
      "😀", "😊", "😎", "🔥", "⭐", "✅", "❌", "💰", "🎉", "🎁",
      "🛒", "📦", "💎", "🏆", "🚀", "⚡", "💬", "🔔", "❤️", "👍",
      "👎", "🎮", "🎯", "💡", "🔑", "🛡️", "⚙️", "📌", "🔒", "🔓",
      "✨", "💪", "👏", "🤝", "💥", "🌟", "🎊", "🥇", "🔗", "📢",
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
      "🧐", "😕", "🫤", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺",
      "🥹", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖",
      "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬",
      "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽",
      "👾", "🤖", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾",
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
      "🎯", "🎲", "🧩", "🪅", "🪆", "🖼️", "🧵", "🪡", "🧶", "🪢",
    ],
  },
  {
    label: "Símbolos",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "☮️",
      "✝️", "☪️", "🕉️", "☸️", "✡️", "🔯", "🕎", "☯️", "☦️", "🛐",
      "⛎", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐",
      "♑", "♒", "♓", "🆔", "⚛️", "🉑", "☢️", "☣️", "📴", "📳",
      "🈶", "🈚", "🈸", "🈺", "🈷️", "✴️", "🆚", "💮", "🉐", "㊙️",
      "㊗️", "🈴", "🈵", "🈹", "🈲", "🅰️", "🅱️", "🆎", "🆑", "🅾️",
      "🆘", "⭕", "🛑", "⛔", "📛", "🚫", "💯", "💢", "♨️", "🚷",
      "🚯", "🚳", "🚱", "🔞", "📵", "🚭", "❗", "❕", "❓", "❔",
      "‼️", "⁉️", "🔅", "🔆", "〽️", "⚠️", "🚸", "🔱", "⚜️", "🔰",
      "♻️", "✅", "🈯", "💹", "❇️", "✳️", "❌", "🌐", "💠", "Ⓜ️",
      "🌀", "💤", "🏧", "🚾", "♿", "🅿️", "🛗", "🈳", "🈂️", "🛂",
      "🛃", "🛄", "🛅", "⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️",
      "↖️", "↕️", "↔️", "↩️", "↪️", "⤴️", "⤵️", "🔃", "🔄", "🔙",
      "🔚", "🔛", "🔜", "🔝", "🔀", "🔁", "🔂", "▶️", "⏩", "⏭️",
      "⏯️", "◀️", "⏪", "⏮️", "🔼", "⏫", "🔽", "⏬", "⏸️", "⏹️",
      "⏺️", "⏏️", "🎦", "🔅", "🔆", "📶", "🛜", "📳", "📴",
      "🔟", "🔢", "⏏️", "#️⃣", "*️⃣", "0️⃣", "1️⃣", "2️⃣", "3️⃣",
      "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟",
      "🔠", "🔡", "🔣", "🔤", "🆗", "🆕", "🆙", "🆒", "🆓", "🆖",
      "ℹ️", "🔤", "🔡", "🔠", "🔣", "🎵", "🎶", "〰️", "➰", "✔️",
      "☑️", "🔘", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪",
      "🟤", "🔺", "🔻", "🔸", "🔹", "🔶", "🔷", "💠", "🔳", "🔲",
      "⬛", "⬜", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫",
    ],
  },
  {
    label: "Natureza",
    icon: "🌿",
    emojis: [
      "🌵", "🎄", "🌲", "🌳", "🌴", "🪵", "🌱", "🌿", "☘️", "🍀",
      "🎍", "🪴", "🎋", "🍃", "🍂", "🍁", "🪺", "🪹", "🍄", "🌾",
      "💐", "🌷", "🌹", "🥀", "🪻", "🌺", "🌸", "🌼", "🌻", "🌞",
      "🌝", "🌛", "🌜", "🌚", "🌕", "🌖", "🌗", "🌘", "🌑", "🌒",
      "🌓", "🌔", "🌙", "🌎", "🌍", "🌏", "🪐", "💫", "⭐", "🌟",
      "✨", "⚡", "☄️", "💥", "🔥", "🌪️", "🌈", "☀️", "🌤️", "⛅",
      "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "🌨️", "❄️", "☃️", "⛄",
      "🌬️", "💨", "💧", "💦", "🫧", "☔", "☂️", "🌊", "🌫️",
    ],
  },
  {
    label: "Comida",
    icon: "🍕",
    emojis: [
      "🍇", "🍈", "🍉", "🍊", "🍋", "🍌", "🍍", "🥭", "🍎", "🍏",
      "🍐", "🍑", "🍒", "🍓", "🫐", "🥝", "🍅", "🫒", "🥥", "🥑",
      "🍆", "🥔", "🥕", "🌽", "🌶️", "🫑", "🥒", "🥬", "🥦", "🧄",
      "🧅", "🥜", "🫘", "🌰", "🫚", "🫛", "🍞", "🥐", "🥖", "🫓",
      "🥨", "🥯", "🥞", "🧇", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔",
      "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🫔", "🥙", "🧆", "🥚",
      "🍳", "🥘", "🍲", "🫕", "🥣", "🥗", "🍿", "🧈", "🧂", "🥫",
      "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣",
      "🍤", "🍥", "🥮", "🍡", "🥟", "🥠", "🥡", "🦀", "🦞", "🦐",
      "🦑", "🦪", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🧁",
      "🥧", "🍫", "🍬", "🍭", "🍮", "🍯", "🍼", "🥛", "☕", "🫖",
      "🍵", "🍶", "🍾", "🍷", "🍸", "🍹", "🍺", "🍻", "🥂", "🥃",
      "🫗", "🥤", "🧋", "🧃", "🧉", "🧊",
    ],
  },
];

// Global cache
const emojiCache: Record<string, { emojis: DiscordEmoji[]; loading: boolean; promise?: Promise<void> }> = {};

export const EmojiPicker = ({ value, onChange }: EmojiPickerProps) => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const tenantName = tenant?.name;
  const [open, setOpen] = useState(false);
  const [customEmojis, setCustomEmojis] = useState<DiscordEmoji[]>(() =>
    tenantId && emojiCache[tenantId] ? emojiCache[tenantId].emojis : []
  );
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("frequentes");

  useEffect(() => {
    if (!open || !tenantId) return;

    if (emojiCache[tenantId] && !emojiCache[tenantId].loading) {
      setCustomEmojis(emojiCache[tenantId].emojis);
      return;
    }

    if (emojiCache[tenantId]?.loading && emojiCache[tenantId]?.promise) {
      setLoadingCustom(true);
      emojiCache[tenantId].promise!.then(() => {
        setCustomEmojis(emojiCache[tenantId].emojis);
        setLoadingCustom(false);
      });
      return;
    }

    setLoadingCustom(true);
    emojiCache[tenantId] = { emojis: [], loading: true };

    const fetchPromise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("discord-guild-emojis", {
          body: { tenant_id: tenantId },
        });
        if (error) throw error;
        if (Array.isArray(data)) {
          emojiCache[tenantId].emojis = data;
          setCustomEmojis(data);
        }
      } catch (e) {
        console.error("Failed to fetch emojis:", e);
      }
      emojiCache[tenantId].loading = false;
      setLoadingCustom(false);
    })();

    emojiCache[tenantId].promise = fetchPromise;
  }, [open, tenantId]);

  const currentCustomEmoji = customEmojis.find((e) => e.formatted === value);

  const selectEmoji = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };

  const hasCustomEmojis = customEmojis.length > 0 || loadingCustom;

  // Filter logic
  const searchLower = search.toLowerCase();
  const filteredCustom = customEmojis.filter((e) => e.name.toLowerCase().includes(searchLower));

  const getFilteredCategory = (emojis: string[]) => {
    if (!search) return emojis;
    return emojis.filter((e) => e.includes(search));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full bg-muted border-border justify-start gap-2 text-sm font-normal"
        >
          {currentCustomEmoji ? (
            <img src={currentCustomEmoji.url} alt={currentCustomEmoji.name} className="h-5 w-5" />
          ) : value ? (
            <span className="text-lg">{value}</span>
          ) : (
            <SmilePlus className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-muted-foreground truncate">
            {currentCustomEmoji ? `:${currentCustomEmoji.name}:` : value || "Selecionar emoji"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
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
          {hasCustomEmojis && (
            <button
              onClick={() => setActiveTab("servidor")}
              className={`h-7 w-7 flex items-center justify-center rounded text-sm shrink-0 transition-colors ${activeTab === "servidor" ? "bg-primary/20" : "hover:bg-muted"}`}
              title={tenantName || "Servidor"}
            >
              🏠
            </button>
          )}
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setActiveTab(cat.label.toLowerCase())}
              className={`h-7 w-7 flex items-center justify-center rounded text-sm shrink-0 transition-colors ${activeTab === cat.label.toLowerCase() ? "bg-primary/20" : "hover:bg-muted"}`}
              title={cat.label}
            >
              {cat.icon}
            </button>
          ))}
        </div>

        <ScrollArea className="h-56">
          <div className="p-2">
            {/* Server tab */}
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
                        onClick={() => selectEmoji(emoji.formatted)}
                        className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                        title={`:${emoji.name}:`}
                      >
                        <img
                          src={emoji.url}
                          alt={emoji.name}
                          className="h-5 w-5 object-contain"
                          loading="lazy"
                        />
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

            {/* Unicode category tabs */}
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
                          onClick={() => selectEmoji(emoji)}
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

        {/* Manual input */}
        <div className="border-t border-border p-2">
          <Input
            placeholder="Ou cole um emoji: 😀"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                selectEmoji(e.target.value);
              }
            }}
            className="h-8 text-xs bg-muted border-border"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};
