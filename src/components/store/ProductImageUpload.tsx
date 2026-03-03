import { useState, useRef, useCallback } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ProductImageUploadProps {
  label: string;
  hint: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
  tenantId: string;
  productId: string;
  aspect?: "square" | "banner";
}

export const ProductImageUpload = ({
  label,
  hint,
  currentUrl,
  onUploaded,
  onRemoved,
  tenantId,
  productId,
  aspect = "square",
}: ProductImageUploadProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Formato inválido", description: "Selecione PNG, JPG ou GIF", variant: "destructive" });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Arquivo muito grande", description: "Máximo 10MB", variant: "destructive" });
        return;
      }

      setUploading(true);
      try {
        const ext = file.name.split(".").pop() || "png";
        const path = `${tenantId}/products/${productId}/${aspect}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("tenant-assets")
          .upload(path, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("tenant-assets")
          .getPublicUrl(path);

        onUploaded(publicData.publicUrl);
        setDialogOpen(false);
        toast({ title: "Imagem enviada! ✅" });
      } catch (err: any) {
        toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    },
    [tenantId, productId, aspect, onUploaded]
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-foreground">{label}</p>

      {currentUrl ? (
        <div className="relative group">
          <img
            src={currentUrl}
            alt={label}
            className={`rounded-xl border border-border object-cover ${
              aspect === "banner" ? "w-full h-32" : "w-20 h-20"
            }`}
          />
          <button
            onClick={onRemoved}
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setDialogOpen(true)}
          className={`flex items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 hover:bg-muted/50 transition-colors ${
            aspect === "banner" ? "w-full h-32" : "w-20 h-20"
          }`}
        >
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        </button>
      )}

      {/* Upload dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border p-0 gap-0">
          <DialogHeader className="p-5 pb-0">
            <DialogTitle className="text-lg font-bold">Imagem Cropper</DialogTitle>
          </DialogHeader>

          <div className="p-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Upload className="h-5 w-5 text-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Arraste uma imagem aqui ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">{hint}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Enviando..." : "Escolher Arquivo"}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={handleInputChange}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
