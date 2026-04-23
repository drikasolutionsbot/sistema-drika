import { useState, useCallback, useEffect } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Crop as CropIcon, Bot } from "lucide-react";

interface BannerCropModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  botName: string;
  botAvatarUrl?: string | null;
  onConfirm: (croppedFile: File) => Promise<void> | void;
}

// Discord banner ratio is 5:2 (e.g. 600x240). We'll target 1500x600 for HD.
const TARGET_W = 1500;
const TARGET_H = 600;
const ASPECT = TARGET_W / TARGET_H;

async function getCroppedFile(
  imageSrc: string,
  cropPx: Area,
  originalName: string,
  mime: string
): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_W;
  canvas.height = TARGET_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");

  ctx.drawImage(
    image,
    cropPx.x,
    cropPx.y,
    cropPx.width,
    cropPx.height,
    0,
    0,
    TARGET_W,
    TARGET_H
  );

  const outMime = mime === "image/png" ? "image/png" : "image/jpeg";
  const quality = outMime === "image/jpeg" ? 0.92 : undefined;

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem."))),
      outMime,
      quality
    );
  });

  const ext = outMime === "image/png" ? "png" : "jpg";
  const baseName = originalName.replace(/\.[^.]+$/, "") || "capa";
  return new File([blob], `${baseName}-cropped.${ext}`, { type: outMime });
}

const BannerCropModal = ({ open, onOpenChange, file, botName, botAvatarUrl, onConfirm }: BannerCropModalProps) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Carrega o arquivo como dataURL ao abrir
  useEffect(() => {
    if (!open || !file) {
      setImageSrc(null);
      setPreviewUrl(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  }, [open, file]);

  // Atualiza preview enquanto o usuário arrasta
  useEffect(() => {
    let cancelled = false;
    let lastUrl: string | null = null;
    const update = async () => {
      if (!imageSrc || !croppedAreaPixels || !file) return;
      try {
        const f = await getCroppedFile(imageSrc, croppedAreaPixels, file.name, file.type);
        if (cancelled) return;
        const url = URL.createObjectURL(f);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        lastUrl = url;
      } catch {
        /* ignore preview errors */
      }
    };
    update();
    return () => {
      cancelled = true;
      if (lastUrl) URL.revokeObjectURL(lastUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc, croppedAreaPixels]);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels || !file) return;
    setSubmitting(true);
    try {
      const out = await getCroppedFile(imageSrc, croppedAreaPixels, file.name, file.type);
      await onConfirm(out);
      onOpenChange(false);
    } catch (e) {
      console.error("[banner-crop] erro ao confirmar:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5 text-primary" />
            Ajustar capa do bot
          </DialogTitle>
          <DialogDescription>
            Arraste para reposicionar e use o zoom para enquadrar. Proporção 5:2 (igual ao Discord).
          </DialogDescription>
        </DialogHeader>

        {/* Crop area */}
        <div className="relative w-full aspect-[5/2] rounded-xl overflow-hidden bg-muted/40 border border-border">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={ASPECT}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="horizontal-cover"
              showGrid
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground w-12">Zoom</span>
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.05}
            onValueChange={(v) => setZoom(v[0])}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-10 text-right">{zoom.toFixed(2)}x</span>
        </div>

        {/* Discord-like preview */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Preview (perfil no Discord)</p>
          <div className="rounded-xl overflow-hidden border border-border bg-card max-w-sm">
            {/* Banner */}
            <div className="relative w-full aspect-[5/2] bg-muted">
              {previewUrl && (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              )}
            </div>
            {/* Avatar + nome */}
            <div className="relative px-4 pb-4 pt-0">
              <div className="-mt-8 mb-2 inline-block">
                <div className="relative">
                  {botAvatarUrl ? (
                    <img
                      src={botAvatarUrl}
                      alt="Avatar"
                      className="h-16 w-16 rounded-full object-cover border-4 border-card"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-muted border-4 border-card flex items-center justify-center">
                      <Bot className="h-7 w-7 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-[3px] border-card" />
                </div>
              </div>
              <p className="font-semibold text-foreground text-sm truncate">{botName}</p>
              <p className="text-xs text-muted-foreground">BOT</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || !croppedAreaPixels} className="gap-2">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <CropIcon className="h-4 w-4" />
                Aplicar capa
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BannerCropModal;
