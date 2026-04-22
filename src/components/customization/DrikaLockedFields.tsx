import { Shield } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface DrikaLockedFieldsProps {
  title: string;
  description: string;
  rows?: number;
}

/**
 * Bloco padrão para exibir Título + Descrição travados no template Drika.
 * Cliente vê os valores fixos mas não pode editar.
 */
const DrikaLockedFields = ({ title, description, rows = 4 }: DrikaLockedFieldsProps) => {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">
          Capa & Descrição (template Drika)
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
      <p className="text-[11px] text-muted-foreground italic">
        🔒 Capa e descrição são fixas no padrão Drika (limitação do Discord). Você pode personalizar cor lateral, botões, imagens, footer, nome e avatar do bot livremente.
      </p>
    </div>
  );
};

export default DrikaLockedFields;
