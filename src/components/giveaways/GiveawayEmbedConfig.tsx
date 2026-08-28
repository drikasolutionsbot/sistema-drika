import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Palette, Type, FileText, Image as ImageIcon, Info, Upload, X, Link, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GiveawayEmbedConfig as EmbedConfig } from "./GiveawayEmbedPreview";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/hooks/use-toast";

interface GiveawayEmbedConfigProps {
  config: EmbedConfig;
  onChange: (config: EmbedConfig) => void;
}

export function ImageUploadField({
  label,
  value,
  onChangeUrl,
  fieldKey,
}: {
  label: string;
  value: string;
  onChangeUrl: (url: string) => void;
  fieldKey: string;
}) {
  const { tenantId } = useTenant();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  /** Compress raster images (not GIF) to WebP at max 1200px */
  const compressImage = useCallback((file: File): Promise<File> => {
    return new Promise((resolve) => {
      // GIFs can't be meaningfully compressed via canvas (loses animation)
      if (file.type === "image/gif") { resolve(file); return; }

      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width >= height) { height = Math.round((height / width) * MAX); width = MAX; }
          else { width = Math.round((width / height) * MAX); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
            resolve(compressed);
          },
          "image/webp",
          0.82
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Formato inválido", description: "Selecione PNG, JPG, GIF ou WebP", variant: "destructive" });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: "Arquivo muito grande", description: "Máximo 2MB (use URL externa para arquivos maiores)", variant: "destructive" });
        return;
      }
      setUploading(true);
      try {
        // Compress before upload (skips GIFs)
        const toUpload = await compressImage(file);
        const ext = toUpload.name.split(".").pop() || "webp";
        const path = `${tenantId}/giveaways/${fieldKey}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("tenant-assets").upload(path, toUpload, { upsert: true });
        if (error) throw error;

        // Delete old file if it exists
        if (value && value.includes("/tenant-assets/")) {
          const oldPath = value.split("/tenant-assets/")[1]?.split("?")[0];
          if (oldPath) {
            await supabase.storage.from("tenant-assets").remove([oldPath]).catch(console.error);
          }
        }

        const { data: publicData } = supabase.storage.from("tenant-assets").getPublicUrl(path);
        onChangeUrl(publicData.publicUrl);
        toast({ title: "Imagem enviada! ✅" });
      } catch (err: any) {
        toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    },
    [tenantId, fieldKey, onChangeUrl, compressImage]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5 text-xs">
        <ImageIcon className="h-3 w-3" /> {label}
      </Label>

      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt={label}
            className="rounded-lg border border-border object-cover w-full h-24"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <button
            type="button"
            onClick={() => onChangeUrl("")}
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="w-full h-8">
            <TabsTrigger value="upload" className="flex-1 text-xs gap-1 h-7">
              <Upload className="h-3 w-3" /> Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="flex-1 text-xs gap-1 h-7">
              <Link className="h-3 w-3" /> URL
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="mt-2">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && inputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground" />
              )}
              <p className="text-xs text-muted-foreground text-center">
                {uploading ? "Enviando..." : "Arraste ou clique para enviar"}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          </TabsContent>
          <TabsContent value="url" className="mt-2">
            <Input
              value={value}
              onChange={(e) => onChangeUrl(e.target.value)}
              placeholder="https://exemplo.com/imagem.png"
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
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
        <div className="relative">
          <Textarea
            value={config.description}
            onChange={(e) => update("description", e.target.value)}
            rows={6}
            className="font-mono text-xs leading-relaxed resize-y"
            placeholder={`**Prêmio:** {prize}\n\n{description}\n\n⏰ **Encerra:** {ends_at}\n👥 **Vencedores:** {winners_count}`}
          />
          <div className="absolute bottom-2 right-2 flex gap-1">
            {["**bold**", "*italic*", "__underline__"].map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => {
                  const textarea = document.querySelector('textarea[class*="font-mono"]') as HTMLTextAreaElement;
                  if (!textarea) return;
                  const start = textarea.selectionStart;
                  const end = textarea.selectionEnd;
                  const selected = config.description.substring(start, end);
                  const wrapper = fmt.replace(/[a-z]+/, selected || "texto");
                  const newVal = config.description.substring(0, start) + wrapper + config.description.substring(end);
                  update("description", newVal);
                }}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                {fmt === "**bold**" ? "B" : fmt === "*italic*" ? "I" : "U"}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Use markdown: **negrito**, *itálico*, __sublinhado__. Cada linha vira uma nova linha no embed.
        </p>
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
        <ImageUploadField
          label="Thumbnail (miniatura no canto do embed)"
          value={config.thumbnail_url}
          onChangeUrl={(url) => update("thumbnail_url", url)}
          fieldKey="thumbnail"
        />
        <ImageUploadField
          label="Imagem / GIF principal (aparece grande no embed)"
          value={config.image_url}
          onChangeUrl={(url) => update("image_url", url)}
          fieldKey="image"
        />
      </div>
    </div>
  );
}
