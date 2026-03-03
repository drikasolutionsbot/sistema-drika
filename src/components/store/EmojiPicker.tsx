import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, SmilePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export const EmojiPicker = ({ value, onChange }: EmojiPickerProps) => {
  const { tenantId } = useTenant();
  const [open, setOpen] = useState(false);
  const [emojis, setEmojis] = useState<DiscordEmoji[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [fetched, setFetched] = useState(false);

  const fetchEmojis = async () => {
    if (!tenantId || fetched) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-guild-emojis", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      if (Array.isArray(data)) {
        setEmojis(data);
      }
      setFetched(true);
    } catch (e) {
      console.error("Failed to fetch emojis:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && !fetched) {
      fetchEmojis();
    }
  }, [open]);

  const filtered = emojis.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  // Check if current value is a custom discord emoji
  const currentCustomEmoji = emojis.find((e) => e.formatted === value);

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
      <PopoverContent className="w-72 p-0" align="start">
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

        <ScrollArea className="h-52">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-6 gap-1 p-2">
              {filtered.map((emoji) => (
                <button
                  key={emoji.id}
                  onClick={() => {
                    onChange(emoji.formatted);
                    setOpen(false);
                  }}
                  className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                  title={`:${emoji.name}:`}
                >
                  <img
                    src={emoji.url}
                    alt={emoji.name}
                    className="h-6 w-6 object-contain"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-muted-foreground">
              {emojis.length === 0
                ? "Nenhum emoji personalizado encontrado"
                : "Nenhum resultado"}
            </div>
          )}
        </ScrollArea>

        {/* Manual input */}
        <div className="border-t border-border p-2">
          <Input
            placeholder="Ou digite um emoji padrão: 😀"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onChange(e.target.value);
                setOpen(false);
              }
            }}
            className="h-8 text-xs bg-muted border-border"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};
