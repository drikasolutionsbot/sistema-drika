import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, Send, Loader2, Sparkles, MessageSquareHeart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Por favor, escreva uma mensagem.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("platform_feedbacks").insert({
        name: name.trim() || null,
        message: message.trim(),
        rating: rating > 0 ? rating : null,
      });

      if (error) throw error;
      
      setSubmitted(true);
      toast.success("Feedback enviado com sucesso! Muito obrigado.");
      
      // Auto close after 3 seconds
      setTimeout(() => {
        onOpenChange(false);
        // Reset states for next time
        setTimeout(() => {
          setSubmitted(false);
          setRating(0);
          setMessage("");
          setName("");
        }, 500);
      }, 3000);
      
    } catch (err: any) {
      console.error("Erro ao enviar feedback:", err);
      toast.error("Houve um erro ao enviar seu feedback. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-[#0A0A0A] border-white/10 shadow-2xl">
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 opacity-50 pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500 opacity-50" />
        
        {submitted ? (
          <div className="relative p-8 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-2 shadow-[0_0_30px_rgba(var(--primary),0.3)]">
              <MessageSquareHeart className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold font-display text-white">Muito Obrigado!</h2>
            <p className="text-muted-foreground text-sm max-w-[280px]">
              Seu feedback é fundamental para continuarmos evoluindo a plataforma Drika.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="relative flex flex-col h-full">
            <DialogHeader className="p-6 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-primary/80">Opinião Importa</span>
              </div>
              <DialogTitle className="text-2xl font-bold font-display text-white">
                Deixe seu Feedback
              </DialogTitle>
              <DialogDescription className="text-muted-foreground/80">
                Nos conte o que você acha da plataforma. Sugestões e críticas são sempre bem-vindas!
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-2 space-y-5">
              {/* Rating */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Como você avalia sua experiência?</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="p-1 transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                    >
                      <Star
                        className={cn(
                          "w-7 h-7 transition-colors duration-200",
                          (hoveredRating >= star || (!hoveredRating && rating >= star))
                            ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                            : "text-white/20 hover:text-white/40"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Seu Nome <span className="text-muted-foreground/50 text-xs font-normal">(Opcional)</span></label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como gostaria de ser chamado?"
                  className="bg-white/5 border-white/10 focus-visible:ring-primary/30 focus-visible:border-primary/50 text-white placeholder:text-white/20 transition-all"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">Sua Mensagem <span className="text-red-400/80">*</span></label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="O que podemos melhorar ou o que você mais gostou?"
                  className="bg-white/5 border-white/10 focus-visible:ring-primary/30 focus-visible:border-primary/50 min-h-[100px] resize-none text-white placeholder:text-white/20 transition-all"
                  required
                />
              </div>
            </div>

            <div className="p-6 pt-4 mt-2">
              <Button 
                type="submit" 
                disabled={isSubmitting || !message.trim()} 
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-[0_0_15px_rgba(var(--primary),0.3)] transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Feedback
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
