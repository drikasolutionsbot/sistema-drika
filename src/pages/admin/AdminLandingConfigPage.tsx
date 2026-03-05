import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, TrendingUp, Package, Video, Save, Upload, Link, Loader2 } from "lucide-react";
import { logAudit } from "@/lib/auditLog";

const AdminLandingConfigPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [form, setForm] = useState({
    stat_servers: 120,
    stat_servers_label: "Servidores ativos",
    stat_sales: 500,
    stat_sales_label: "Vendas processadas",
    stat_products: 1200,
    stat_products_label: "Produtos entregues",
    video_url: "",
    video_type: "url" as "url" | "file",
  });

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("landing_config")
        .select("*")
        .limit(1)
        .single();
      if (data) {
        setConfigId(data.id);
        setForm({
          stat_servers: data.stat_servers,
          stat_servers_label: data.stat_servers_label,
          stat_sales: data.stat_sales,
          stat_sales_label: data.stat_sales_label,
          stat_products: data.stat_products,
          stat_products_label: data.stat_products_label,
          video_url: data.video_url || "",
          video_type: (data.video_type as "url" | "file") || "url",
        });
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    if (!configId) return;
    setSaving(true);
    const { error } = await supabase
      .from("landing_config")
      .update({
        stat_servers: form.stat_servers,
        stat_servers_label: form.stat_servers_label,
        stat_sales: form.stat_sales,
        stat_sales_label: form.stat_sales_label,
        stat_products: form.stat_products,
        stat_products_label: form.stat_products_label,
        video_url: form.video_url || null,
        video_type: form.video_type,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", configId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar configurações");
      console.error(error);
    } else {
      await logAudit("config_updated", "config", configId, "Landing Page", { fields: Object.keys(form) });
      toast.success("Configurações da landing page salvas!");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `landing/video_${Date.now()}.${ext}`;
    
    const { error } = await supabase.storage
      .from("tenant-assets")
      .upload(path, file, { upsert: true });
    
    if (error) {
      toast.error("Erro ao fazer upload do vídeo");
      console.error(error);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("tenant-assets")
      .getPublicUrl(path);
    
    const newUrl = urlData.publicUrl;
    setForm((prev) => ({ ...prev, video_url: newUrl, video_type: "file" }));
    
    // Auto-save video URL to DB after upload
    if (configId) {
      const { error: updateError } = await supabase
        .from("landing_config")
        .update({
          video_url: newUrl,
          video_type: "file",
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", configId);
      
      if (updateError) {
        toast.error("Vídeo enviado, mas erro ao salvar no banco");
        console.error(updateError);
      } else {
        toast.success("Vídeo enviado e salvo com sucesso!");
      }
    }
    
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Landing Page</h1>
        <p className="text-muted-foreground">Configure os dados exibidos na página inicial</p>
      </div>

      {/* Social Proof Stats */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Prova Social — Estatísticas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stat 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Número</Label>
                <Input
                  type="number"
                  value={form.stat_servers}
                  onChange={(e) => setForm((p) => ({ ...p, stat_servers: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <Input
                value={form.stat_servers_label}
                onChange={(e) => setForm((p) => ({ ...p, stat_servers_label: e.target.value }))}
              />
            </div>
          </div>

          {/* Stat 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Número</Label>
                <Input
                  type="number"
                  value={form.stat_sales}
                  onChange={(e) => setForm((p) => ({ ...p, stat_sales: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <Input
                value={form.stat_sales_label}
                onChange={(e) => setForm((p) => ({ ...p, stat_sales_label: e.target.value }))}
              />
            </div>
          </div>

          {/* Stat 3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Número</Label>
                <Input
                  type="number"
                  value={form.stat_products}
                  onChange={(e) => setForm((p) => ({ ...p, stat_products: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <Input
                value={form.stat_products_label}
                onChange={(e) => setForm((p) => ({ ...p, stat_products_label: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Config */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            Vídeo — "Veja o bot funcionando"
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Cole um link de vídeo (YouTube, etc.) ou faça upload de um arquivo de vídeo. Esse vídeo será exibido em um modal na landing page.
          </p>

          {/* URL input */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Link className="h-3 w-3" /> Link do vídeo (YouTube, MP4, etc.)
            </Label>
            <Input
              placeholder="https://www.youtube.com/watch?v=..."
              value={form.video_url}
              onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value, video_type: "url" }))}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* File upload */}
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Upload className="h-3 w-3" /> Upload de arquivo de vídeo
            </Label>
            <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Enviando...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para selecionar um vídeo</span>
                </>
              )}
            </label>
            <p className="text-[10px] text-muted-foreground mt-1">Sem restrição de tamanho. Formatos: MP4, MOV, WebM, etc.</p>
          </div>

          {/* Preview */}
          {form.video_url && (
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <Label className="text-xs text-muted-foreground mb-1 block">URL configurada:</Label>
              <p className="text-xs text-foreground break-all font-mono">{form.video_url}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
};

export default AdminLandingConfigPage;
