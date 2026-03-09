import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Loader2, GripVertical, Pencil, Video, Image, ExternalLink, Upload } from "lucide-react";
import TrashIcon from "@/components/ui/trash-icon";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Tutorial {
  id: string;
  title: string;
  cover_url: string | null;
  video_url: string | null;
  video_type: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

const AdminTutorialsPage = () => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tutorial | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoType, setVideoType] = useState<"url" | "upload">("url");
  const [active, setActive] = useState(true);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const fetchTutorials = async () => {
    const { data } = await supabase
      .from("tutorials")
      .select("*")
      .order("sort_order", { ascending: true });
    setTutorials((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchTutorials(); }, []);

  const resetForm = () => {
    setTitle("");
    setCoverUrl("");
    setVideoUrl("");
    setVideoType("url");
    setActive(true);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (t: Tutorial) => {
    setEditing(t);
    setTitle(t.title);
    setCoverUrl(t.cover_url || "");
    setVideoUrl(t.video_url || "");
    setVideoType((t.video_type as "url" | "upload") || "url");
    setActive(t.active);
    setDialogOpen(true);
  };

  const handleUploadFile = async (file: File, folder: string, setter: (url: string) => void, setUploading: (v: boolean) => void) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `tutorials/${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("tenant-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(path);
      setter(urlData.publicUrl);
      toast.success("Arquivo enviado!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Título obrigatório"); return; }
    if (!videoUrl.trim()) { 
      toast.error(videoType === "upload" ? "Envie um arquivo de vídeo" : "URL do vídeo obrigatória"); 
      return; 
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        cover_url: coverUrl.trim() || null,
        video_url: videoUrl.trim(),
        video_type: videoType,
        active,
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        const { error } = await supabase.from("tutorials").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Tutorial atualizado!");
      } else {
        const { error } = await supabase.from("tutorials").insert({
          ...payload,
          sort_order: tutorials.length,
        });
        if (error) throw error;
        toast.success("Tutorial criado!");
      }
      setDialogOpen(false);
      resetForm();
      fetchTutorials();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase.from("tutorials").delete().eq("id", id);
      if (error) throw error;
      toast.success("Tutorial removido!");
      fetchTutorials();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from("tutorials").update({ active: !current }).eq("id", id);
    fetchTutorials();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tutoriais</h1>
          <p className="text-muted-foreground">Gerencie os tutoriais exibidos para os clientes</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Tutorial
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tutorials.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Video className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-foreground mb-1">Nenhum tutorial</h3>
            <p className="text-sm text-muted-foreground mb-4">Adicione tutoriais para seus clientes</p>
            <Button onClick={openCreate} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Criar primeiro tutorial
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tutorials.map((t) => (
            <Card key={t.id} className={`overflow-hidden transition-all ${!t.active ? "opacity-50" : ""}`}>
              {/* Cover */}
              <div className="relative aspect-video bg-muted">
                {t.cover_url ? (
                  <img src={t.cover_url} alt={t.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Video className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Switch
                    checked={t.active}
                    onCheckedChange={() => handleToggleActive(t.id, t.active)}
                    className="scale-75"
                  />
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground truncate">{t.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
                  <Video className="h-3 w-3" />
                  {t.video_type === "upload" ? "Vídeo enviado" : t.video_url}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        {deleting === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrashIcon size={14} />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir tutorial?</AlertDialogTitle>
                        <AlertDialogDescription>"{t.title}" será removido permanentemente.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(t.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Tutorial" : "Novo Tutorial"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Como configurar o bot" />
            </div>

            {/* Cover */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Image className="h-3.5 w-3.5" />
                Capa
              </Label>
              <div className="flex gap-2">
                <Input
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="URL da imagem de capa"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => coverFileRef.current?.click()}
                  disabled={uploadingCover}
                >
                  {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
                <input
                  ref={coverFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadFile(file, "covers", setCoverUrl, setUploadingCover);
                  }}
                />
              </div>
              {coverUrl && (
                <div className="rounded-lg overflow-hidden border border-border aspect-video">
                  <img src={coverUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Video */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5" />
                Vídeo *
              </Label>
              <div className="flex gap-2 mb-2">
                <Button
                  variant={videoType === "url" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVideoType("url")}
                  className="gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  URL
                </Button>
                <Button
                  variant={videoType === "upload" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVideoType("upload")}
                  className="gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                </Button>
              </div>

              {videoType === "url" ? (
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... ou qualquer URL de vídeo"
                />
              ) : (
                <div className="space-y-2">
                  <div
                    onClick={() => videoFileRef.current?.click()}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
                      videoUrl ? "border-emerald-500/30 bg-emerald-500/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    {uploadingVideo ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : videoUrl ? (
                      <>
                        <Video className="h-5 w-5 text-emerald-400" />
                        <span className="text-sm text-emerald-400">Vídeo enviado</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Clique para enviar um vídeo</span>
                      </>
                    )}
                  </div>
                  <input
                    ref={videoFileRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleUploadFile(file, "videos", (url) => {
                          setVideoUrl(url);
                          setVideoType("upload");
                        }, setUploadingVideo);
                      }
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTutorialsPage;
