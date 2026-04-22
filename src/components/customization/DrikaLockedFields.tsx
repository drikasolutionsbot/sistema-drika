import { Shield, ImageIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface DrikaLockedFieldsProps {
  title: string;
  description: string;
  rows?: number;
  /** URL da capa oficial Drika (image_url). Opcional — quando fornecida, mostra preview travado. */
  coverImageUrl?: string;
}

/**
 * Bloco padrão para exibir Título + Descrição + Capa (imagem grande) travados no template Drika.
 * Cliente vê os valores fixos mas não pode editar.
 * O cliente continua livre para personalizar: cor lateral, footer, thumbnail, botões, nome e avatar do bot.
 */
const DrikaLockedFields = ({ title, description, rows = 4, coverImageUrl }: DrikaLockedFieldsProps) => {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">
          Capa, Título & Descrição (template Drika)
        </span>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Título</Label>
        <Input value={title} disabled readOnly className="mt-1 opacity-70 cursor-not-allowed" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Descrição</Label>
        <Textarea
          value={description}
          disabled
          readOnly
          rows={rows}
          className="mt-1 opacity-70 cursor-not-allowed resize-none"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ImageIcon className="h-3 w-3" /> Capa (imagem grande)
        </Label>
        <div className="mt-1 rounded border border-dashed border-primary/30 bg-background/50 p-2 flex items-center gap-2 opacity-70">
          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt="Capa Drika"
              className="h-12 w-20 rounded object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="h-12 w-20 rounded bg-primary/10 flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-primary/60" />
            </div>
          )}
          <span className="text-xs text-muted-foreground">Imagem oficial Drika (fixa)</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        🔒 Capa, título e descrição são fixos no padrão Drika. Você pode personalizar livremente: cor lateral, thumbnail, footer, botões, nome e avatar do bot.
      </p>
    </div>
  );
};

export default DrikaLockedFields;
