import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Palette, Type, FileText, Image, Info } from "lucide-react";
import { GiveawayEmbedConfig as EmbedConfig } from "./GiveawayEmbedPreview";

interface GiveawayEmbedConfigProps {
  config: EmbedConfig;
  onChange: (config: EmbedConfig) => void;
}

export default function GiveawayEmbedConfigForm({ config, onChange }: GiveawayEmbedConfigProps) {
  const update = (key: keyof EmbedConfig, value: string) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Palette className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-foreground">Personalizar Embed</h3>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Info className="h-3.5 w-3.5" /> Variáveis disponíveis
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {["{title}", "{prize}", "{description}", "{winners_count}", "{ends_at}"].map((v) => (
            <Badge key={v} variant="secondary" className="text-xs font-mono">{v}</Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs">
            <Palette className="h-3 w-3" /> Cor lateral
          </Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={config.color}
              onChange={(e) => update("color", e.target.value)}
              className="w-12 h-10 p-1 cursor-pointer"
            />
            <Input
              value={config.color}
              onChange={(e) => update("color", e.target.value)}
              placeholder="#FEE75C"
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs">
            <Type className="h-3 w-3" /> Título do embed
          </Label>
          <Input
            value={config.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="🎉 SORTEIO: {title}"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-xs">
          <FileText className="h-3 w-3" /> Descrição do embed
        </Label>
        <Textarea
          value={config.description}
          onChange={(e) => update("description", e.target.value)}
          rows={4}
          placeholder="**Prêmio:** {prize}&#10;&#10;{description}&#10;&#10;⏰ **Encerra:** {ends_at}&#10;👥 **Vencedores:** {winners_count}"
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5 text-xs">
          <Type className="h-3 w-3" /> Rodapé
        </Label>
        <Input
          value={config.footer}
          onChange={(e) => update("footer", e.target.value)}
          placeholder="Reaja com 🎉 para participar!"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs">
            <Image className="h-3 w-3" /> URL da thumbnail
          </Label>
          <Input
            value={config.thumbnail_url}
            onChange={(e) => update("thumbnail_url", e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-xs">
            <Image className="h-3 w-3" /> URL da imagem
          </Label>
          <Input
            value={config.image_url}
            onChange={(e) => update("image_url", e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>
    </div>
  );
}
