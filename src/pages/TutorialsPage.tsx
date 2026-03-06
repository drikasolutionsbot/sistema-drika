import { useState, useEffect } from "react";
import { Loader2, Video, Play, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface Tutorial {
  id: string;
  title: string;
  cover_url: string | null;
  video_url: string | null;
  video_type: string;
  sort_order: number;
}

function getEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  return null;
}

const TutorialsPage = () => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Tutorial | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("tutorials")
        .select("id, title, cover_url, video_url, video_type, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      setTutorials((data as any[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const openVideo = (t: Tutorial) => {
    if (!t.video_url) return;
    const embed = getEmbedUrl(t.video_url);
    if (embed || t.video_type === "upload") {
      setSelectedVideo(t);
    } else {
      window.open(t.video_url, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Tutoriais</h1>
        <p className="text-muted-foreground">Aprenda a usar todas as funcionalidades</p>
      </div>

      {tutorials.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Video className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-foreground mb-1">Nenhum tutorial disponível</h3>
            <p className="text-sm text-muted-foreground">Em breve novos conteúdos serão adicionados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tutorials.map((t) => (
            <Card
              key={t.id}
              className="overflow-hidden cursor-pointer group hover:border-primary/30 transition-all duration-300"
              onClick={() => openVideo(t)}
            >
              <div className="relative aspect-video bg-muted overflow-hidden">
                {t.cover_url ? (
                  <img
                    src={t.cover_url}
                    alt={t.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/10 to-primary/5">
                    <Video className="h-12 w-12 text-primary/30" />
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/40 transition-all duration-300">
                  <div className="h-14 w-14 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 shadow-lg">
                    <Play className="h-6 w-6 text-primary-foreground ml-0.5" />
                  </div>
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground line-clamp-2">{t.title}</h3>
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  {t.video_type === "upload" ? (
                    <><Video className="h-3 w-3" /> Vídeo</>
                  ) : (
                    <><ExternalLink className="h-3 w-3" /> {t.video_url?.includes("youtube") ? "YouTube" : t.video_url?.includes("vimeo") ? "Vimeo" : "Link externo"}</>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Video Player Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-background border-border">
          {selectedVideo && (
            <div className="space-y-0">
              <div className="aspect-video w-full bg-black">
                {selectedVideo.video_type === "upload" ? (
                  <video
                    src={selectedVideo.video_url || ""}
                    controls
                    autoPlay
                    className="w-full h-full"
                  />
                ) : (() => {
                  const embedUrl = getEmbedUrl(selectedVideo.video_url || "");
                  return embedUrl ? (
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <a
                        href={selectedVideo.video_url || ""}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-2"
                      >
                        <ExternalLink className="h-5 w-5" />
                        Abrir vídeo
                      </a>
                    </div>
                  );
                })()}
              </div>
              <div className="p-4">
                <h2 className="text-lg font-semibold text-foreground">{selectedVideo.title}</h2>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TutorialsPage;
