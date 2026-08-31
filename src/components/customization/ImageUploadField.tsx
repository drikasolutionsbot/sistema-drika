import { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  maxSizeKB?: number;
}

const ImageUploadField = ({ label, value, onChange, folder = "embeds", maxSizeKB }: ImageUploadFieldProps) => {
  const { tenantId } = useTenant();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const processFile = async (file: File) => {
    if (!tenantId) return;
    
    if (maxSizeKB && file.size > maxSizeKB * 1024) {
      toast.error(`A imagem deve ter no máximo ${maxSizeKB}KB para evitar erros na renderização do QR Code.`);
      return;
    }
    
    setUploading(true);
    try {
      let fileToUpload = file;
      let ext = file.name.split(".").pop() || "png";
      
      // Compress if it's a standard image (not a QR code with maxSizeKB)
      if (!maxSizeKB && file.type.startsWith("image/")) {
        try {
          const options = {
            maxSizeMB: 0.2, // ~200KB
            maxWidthOrHeight: folder === "avatars" ? 512 : 1200,
            useWebWorker: true,
            fileType: "image/webp"
          };
          fileToUpload = await imageCompression(file, options);
          ext = "webp";
        } catch (err) {
          console.error("Compression error", err);
        }
      }

      const path = `${tenantId}/${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("tenant-assets")
        .upload(path, fileToUpload, { upsert: true });
      if (error) throw error;
      
      // Delete old file if it exists and is hosted on our Supabase bucket
      if (value && value.includes("/tenant-assets/")) {
        const oldPath = value.split("/tenant-assets/")[1]?.split("?")[0];
        if (oldPath) {
          await supabase.storage.from("tenant-assets").remove([oldPath]).catch(console.error);
        }
      }

      const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
      
      const cdnUrl = import.meta.env.VITE_CDN_URL;
      const finalUrl = cdnUrl 
        ? data.publicUrl.replace(import.meta.env.VITE_SUPABASE_URL, cdnUrl)
        : data.publicUrl;

      onChange(finalUrl);
      toast.success("Imagem enviada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Tente novamente"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const file = Array.from(e.clipboardData.items)
      .find(item => item.type.startsWith("image/"))
      ?.getAsFile();
    
    if (file) {
      e.preventDefault();
      await processFile(file);
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder="https://... ou faça upload (ou cole a imagem aqui)"
          className="bg-background border-border text-sm flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        </Button>
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9 text-muted-foreground"
            onClick={() => onChange("")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {value && (
        <img
          src={value}
          alt="Preview"
          className="h-12 w-12 rounded border border-border object-cover mt-1"
          onError={e => (e.currentTarget.style.display = "none")}
        />
      )}
      <input ref={inputRef} type="file" accept="image/*,.gif" className="hidden" onChange={handleUpload} />
    </div>
  );
};

export default ImageUploadField;
