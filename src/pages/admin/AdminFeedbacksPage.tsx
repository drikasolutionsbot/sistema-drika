import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquareHeart, Star, Trash2, Calendar, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface Feedback {
  id: string;
  name: string | null;
  message: string;
  rating: number | null;
  created_at: string;
}

export default function AdminFeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_feedbacks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        // Se a tabela não existir ainda ou houver erro
        if (error.code !== "42P01") {
          toast.error("Erro ao carregar feedbacks");
        }
        return;
      }

      setFeedbacks(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from("platform_feedbacks").delete().eq("id", deletingId);
      if (error) throw error;
      
      toast.success("Feedback excluído");
      setFeedbacks(prev => prev.filter(f => f.id !== deletingId));
    } catch (err) {
      toast.error("Erro ao excluir");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white flex items-center gap-3">
            <MessageSquareHeart className="h-8 w-8 text-primary" />
            Feedbacks da Plataforma
          </h1>
          <p className="text-muted-foreground mt-2">
            Veja o que as pessoas estão dizendo sobre o Drika Hub.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg border border-border">
          <strong className="text-white text-lg">{feedbacks.length}</strong> avaliações
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p>Carregando feedbacks...</p>
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center bg-card/30 rounded-3xl border border-dashed border-border">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <MessageSquareHeart className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Nenhum feedback ainda</h3>
          <p className="text-muted-foreground max-w-sm">
            Quando os visitantes e lojistas enviarem feedbacks pela landing page, eles aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {feedbacks.map((f) => (
            <div 
              key={f.id} 
              className="group relative flex flex-col p-6 rounded-2xl bg-card border border-border/50 shadow-sm hover:border-primary/30 transition-all duration-300"
            >
              {/* Stars */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        f.rating && star <= f.rating
                          ? "fill-amber-400 text-amber-400"
                          : "fill-muted text-muted"
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setDeletingId(f.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg"
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Message */}
              <p className="text-sm text-foreground leading-relaxed flex-1 whitespace-pre-wrap mb-6">
                "{f.message}"
              </p>

              {/* Footer info */}
              <div className="mt-auto pt-4 border-t border-border/50 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span className="font-medium text-white/80">{f.name || "Anônimo"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(f.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Feedback</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar permanentemente este feedback?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
