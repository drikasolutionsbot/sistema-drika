import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Input } from "./input";
import { Search, Smile } from "lucide-react";

const DEFAULT_CATEGORIES = [
  {
    name: "Sugestões do Sistema",
    emojis: ["🎫", "🛒", "🏦", "🤝", "⚡", "💬", "🔧", "📦", "💳", "🌐", "🎮", "📞"]
  },
  {
    name: "Símbolos e Emoções",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "✅", "❌", "❓", "❕", "💯", "🔥", "✨", "🌟", "💫", "💥", "💢", "💦", "💨", "💤"]
  },
  {
    name: "Natureza e Animais",
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐽", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🦗", "🕷", "🕸", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍", "🦧", "🐘", "🦛", "🦏", "🐪", "🐫", "🦒", "🦘", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🦮", "🐕‍🦺", "🐈", "🐓", "🦃", "🦚", "🦜", "🦢", "🦩", "🕊", "🐇", "🦝", "🦨", "🦡", "🦦", "🦥", "🐁", "🐀", "🐿", "🦔", "🐾", "🐉", "🐲", "🌵", "🎄", "🌲", "🌳", "🌴", "🌱", "🌿", "☘️", "🍀", "🎍", "🎋", "🍃", "🍂", "🍁", "🍄", "🌾", "💐", "🌷", "🌹", "🥀", "🌺", "🌸", "🌼", "🌻", "🌞", "🌝", "🌛", "🌜", "🌚", "🌕", "🌖", "🌗", "🌘", "🌑", "🌒", "🌓", "🌔", "🌙", "🌎", "🌍", "🌏", "🪐", "💫", "⭐️", "🌟", "✨", "⚡️", "☄️", "💥", "🔥", "🌪", "🌈", "☀️", "🌤", "⛅️", "🌥", "☁️", "🌦", "🌧", "⛈", "🌩", "🌨", "❄️", "☃️", "⛄️", "🌬", "💨", "💧", "💦", "☔️", "☂️", "🌊", "🌫"]
  },
  {
    name: "Comida e Bebida",
    emojis: ["🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶", "🌽", "🥕", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🦴", "🌭", "🍔", "🍟", "🍕", "🥪", "🥙", "🧆", "🌮", "🌯", "🥗", "🥘", "🥫", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘", "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "🍼", "☕️", "🍵", "🧃", "🥤", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🧉", "🍾", "🧊", "🥄", "🍴", "🍽", "🥣", "🥡", "🥢", "🧂"]
  }
];

const renderEmoji = (emoji: string, className = "w-6 h-6") => {
  if (!emoji) return null;
  const match = emoji.match(/<a?:.+?:(\d+)>/);
  if (match) {
    const isAnimated = emoji.startsWith("<a:");
    return (
      <img 
        src={`https://cdn.discordapp.com/emojis/${match[1]}.${isAnimated ? 'gif' : 'png'}`} 
        className={`${className} object-contain inline-block`} 
        alt="emoji" 
      />
    );
  }
  return <span className={`${className} flex items-center justify-center leading-none text-[1.4em]`}>{emoji}</span>;
};

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  customEmojis?: { id: string; name: string; format: string; animated: boolean }[];
  trigger?: React.ReactNode;
  guildName?: string;
  debugGuildId?: string | null;
}

export function EmojiPicker({ value, onChange, customEmojis = [], trigger, guildName, debugGuildId }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
    setSearch("");
  };

  const filteredCategories = DEFAULT_CATEGORIES.map(cat => ({
    ...cat,
    emojis: cat.emojis.filter(e => e.includes(search)) // Very naive search for standard emojis
  })).filter(cat => cat.emojis.length > 0);

  const filteredCustom = customEmojis.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        {trigger || (
          <button
            type="button"
            className="flex items-center justify-center h-10 w-12 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            {value ? renderEmoji(value, "w-6 h-6") : <Smile className="w-5 h-5 text-muted-foreground" />}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 border-border bg-[#2B2D31] shadow-xl" align="start" sideOffset={8}>
        <div className="p-3 pb-2 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar emoji..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 bg-[#1E1F22] border-none focus-visible:ring-1 focus-visible:ring-primary/50 text-sm text-white placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div 
          className="h-[300px] overflow-y-auto overflow-x-hidden" 
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
          onWheelCapture={(e) => e.stopPropagation()}
          onTouchMoveCapture={(e) => e.stopPropagation()}
        >
          <div className="p-3 space-y-5">
            {/* Custom Emojis Section */}
            {filteredCustom.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-[#B5BAC1] uppercase tracking-wider ml-1 flex items-center gap-2">
                  <span>🏆</span> Emojis de {guildName || "seu servidor"}
                </h4>
                <div className="grid grid-cols-7 gap-1">
                  {filteredCustom.map(emoji => (
                    <button
                      key={emoji.format}
                      type="button"
                      onClick={() => handleSelect(emoji.format)}
                      title={emoji.name}
                      className="aspect-square flex items-center justify-center rounded hover:bg-white/10 transition-colors focus:outline-none focus:bg-white/20"
                    >
                      {renderEmoji(emoji.format, "w-7 h-7")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Standard Emojis Sections */}
            {filteredCategories.map(category => (
              <div key={category.name} className="space-y-2">
                <h4 className="text-xs font-semibold text-[#B5BAC1] uppercase tracking-wider ml-1">
                  {category.name}
                </h4>
                <div className="grid grid-cols-7 gap-1">
                  {category.emojis.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSelect(emoji)}
                      className="aspect-square flex items-center justify-center rounded hover:bg-white/10 transition-colors focus:outline-none focus:bg-white/20 text-2xl leading-none"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {filteredCustom.length === 0 && filteredCategories.length === 0 && (
              <div className="text-center py-8 text-sm text-[#B5BAC1]">
                Nenhum emoji encontrado.
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
