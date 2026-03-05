import { Plus } from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ImageUploadField from "./ImageUploadField";
import type { EmbedData, EmbedField } from "./types";

interface EmbedFormProps {
  embed: EmbedData;
  onChange: (embed: EmbedData) => void;
}

const EmbedForm = ({ embed, onChange }: EmbedFormProps) => {
  const update = <K extends keyof EmbedData>(key: K, value: EmbedData[K]) => {
    onChange({ ...embed, [key]: value });
  };

  const addField = () => {
    update("fields", [
      ...embed.fields,
      { id: crypto.randomUUID(), name: "", value: "", inline: false },
    ]);
  };

  const updateField = (id: string, patch: Partial<EmbedField>) => {
    update("fields", embed.fields.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  const removeField = (id: string) => {
    update("fields", embed.fields.filter(f => f.id !== id));
  };

  return (
    <div className="space-y-1">
      <Accordion type="multiple" defaultValue={["general", "body"]} className="space-y-2">
        {/* Color */}
        <div className="flex items-center gap-3 px-1 py-2">
          <label className="text-sm font-medium text-muted-foreground">Cor da barra</label>
          <input
            type="color"
            value={embed.color}
            onChange={e => update("color", e.target.value)}
            className="h-8 w-8 rounded border border-border cursor-pointer bg-transparent"
          />
          <Input
            value={embed.color}
            onChange={e => update("color", e.target.value)}
            className="w-28 font-mono text-xs bg-background border-border"
          />
        </div>

        {/* Author */}
        <AccordionItem value="author" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-medium py-3">Autor</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nome</label>
              <Input value={embed.author_name} onChange={e => update("author_name", e.target.value)} placeholder="Nome do autor" className="bg-background border-border text-sm" />
            </div>
            <ImageUploadField label="Ícone do Autor" value={embed.author_icon_url} onChange={v => update("author_icon_url", v)} folder="embeds/author" />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">URL</label>
              <Input value={embed.author_url} onChange={e => update("author_url", e.target.value)} placeholder="https://..." className="bg-background border-border text-sm" />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Body */}
        <AccordionItem value="body" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-medium py-3">Corpo</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Título</label>
              <Input value={embed.title} onChange={e => update("title", e.target.value)} placeholder="Título do embed" className="bg-background border-border text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">URL do Título</label>
              <Input value={embed.url} onChange={e => update("url", e.target.value)} placeholder="https://..." className="bg-background border-border text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Descrição</label>
              <Textarea
                value={embed.description}
                onChange={e => update("description", e.target.value)}
                placeholder="Descrição do embed (suporta markdown básico)"
                rows={4}
                className="bg-background border-border text-sm resize-none"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Images */}
        <AccordionItem value="images" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-medium py-3">Imagens</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <ImageUploadField label="Imagem" value={embed.image_url} onChange={v => update("image_url", v)} folder="embeds/images" />
            <ImageUploadField label="Thumbnail" value={embed.thumbnail_url} onChange={v => update("thumbnail_url", v)} folder="embeds/thumbnails" />
          </AccordionContent>
        </AccordionItem>

        {/* Fields */}
        <AccordionItem value="fields" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-medium py-3">
            Campos ({embed.fields.length}/25)
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            {embed.fields.map((field, idx) => (
              <div key={field.id} className="rounded-lg border border-border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Campo {idx + 1}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeField(field.id)}>
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                </div>
                <Input value={field.name} onChange={e => updateField(field.id, { name: e.target.value })} placeholder="Nome do campo" className="bg-sidebar border-border text-sm" />
                <Textarea value={field.value} onChange={e => updateField(field.id, { value: e.target.value })} placeholder="Valor do campo" rows={2} className="bg-sidebar border-border text-sm resize-none" />
                <div className="flex items-center gap-2">
                  <Switch checked={field.inline} onCheckedChange={v => updateField(field.id, { inline: v })} />
                  <label className="text-xs text-muted-foreground">Inline</label>
                </div>
              </div>
            ))}
            {embed.fields.length < 25 && (
              <Button variant="outline" size="sm" className="w-full" onClick={addField}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar Campo
              </Button>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Footer */}
        <AccordionItem value="footer" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-medium py-3">Rodapé</AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Texto do Rodapé</label>
              <Input value={embed.footer_text} onChange={e => update("footer_text", e.target.value)} placeholder="Texto do rodapé" className="bg-background border-border text-sm" />
            </div>
            <ImageUploadField label="Ícone do Rodapé" value={embed.footer_icon_url} onChange={v => update("footer_icon_url", v)} folder="embeds/footer" />
            <div className="flex items-center gap-2">
              <Switch checked={embed.timestamp} onCheckedChange={v => update("timestamp", v)} />
              <label className="text-xs text-muted-foreground">Incluir timestamp</label>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default EmbedForm;
