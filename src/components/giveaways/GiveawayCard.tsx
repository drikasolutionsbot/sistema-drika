import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gift, Users, Clock, Hash, Trophy, XCircle, Pencil, ChevronRight, Loader2, UserCircle2, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Giveaway {
  id: string;
  title: string;
  description: string | null;
  prize: string;
  winners_count: number;
  ends_at: string;
  channel_id: string | null;
  status: string;
  winners: any[];
  entries_count: number;
  created_at: string;
}

interface GiveawayCardProps {
  giveaway: Giveaway;
  onDraw: (id: string) => void;
  onCancel: (id: string) => void;
  onEdit: (giveaway: Giveaway) => void;
  onDelete: (id: string) => void;
  tenantId?: string | null;
  channelName?: string;
}

// ── Participants Modal ──
function ParticipantsModal({ open, onClose, giveawayId, giveawayTitle }: {
  open: boolean;
  onClose: () => void;
  giveawayId: string;
  giveawayTitle: string;
}) {
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("giveaway_entries")
      .select("discord_user_id, discord_username, discord_avatar, ticket_count")
      .eq("giveaway_id", giveawayId)
      .order("discord_username", { ascending: true })
      .then(({ data }) => {
        setParticipants(data || []);
        setLoading(false);
      });
  }, [open, giveawayId]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-card border-border max-h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Participantes — {giveawayTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : participants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Users className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">Nenhum participante ainda</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground pb-2 sticky top-0 bg-card">
                {participants.length} participante{participants.length !== 1 ? "s" : ""}
              </p>
              {participants.map((p, i) => {
                const avatarUrl = p.discord_avatar
                  ? `https://cdn.discordapp.com/avatars/${p.discord_user_id}/${p.discord_avatar}.webp?size=64`
                  : null;
                return (
                  <div key={p.discord_user_id || i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={p.discord_username} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.discord_username || p.discord_user_id}</p>
                      {p.discord_user_id && (
                        <p className="text-[10px] text-muted-foreground font-mono">{p.discord_user_id}</p>
                      )}
                    </div>
                    {p.ticket_count > 1 && (
                      <Badge variant="outline" className="text-[10px] shrink-0 gap-1 border-primary/30 text-primary">
                        🎟 {p.ticket_count}x
                      </Badge>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useCountdown(endsAt: string) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      const now = Date.now();
      const end = new Date(endsAt).getTime();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft("Sorteando ganhador...");
        setIsExpired(true);
        if (interval) clearInterval(interval);
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`
      );
    };
    update();
    interval = setInterval(update, 1000);
    return () => { if (interval) clearInterval(interval); };
  }, [endsAt]);

  return { timeLeft, isExpired };
}

export default function GiveawayCard({ giveaway, onDraw, onCancel, onEdit, onDelete, tenantId, channelName }: GiveawayCardProps) {
  const { timeLeft, isExpired } = useCountdown(giveaway.ends_at);
  const isEnded = giveaway.status === "ended";
  const isCanceled = giveaway.status === "canceled";
  const isFinished = isEnded || isExpired || isCanceled;
  const [participantsOpen, setParticipantsOpen] = useState(false);

  return (
    <Card className={`relative overflow-hidden border-border/60 hover:shadow-lg transition-shadow ${isFinished ? "opacity-80" : ""}`}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${isFinished ? "bg-gradient-to-r from-yellow-500 to-orange-500" : "bg-gradient-to-r from-primary to-accent"}`} />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            {giveaway.title}
          </CardTitle>
          <Badge variant={isFinished ? "secondary" : "default"} className={isFinished ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : ""}>
            {isCanceled ? "Cancelado" : isEnded ? "Encerrado" : isExpired ? "⏰ Finalizado" : "Ativo"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Trophy className="h-4 w-4" />
          {giveaway.prize}
        </div>

        {giveaway.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{giveaway.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className={isExpired && !isEnded && !isCanceled ? "text-yellow-500 font-medium animate-pulse" : ""}>
              {isCanceled ? "Cancelado" : isEnded ? "⏰ Encerrado" : isExpired ? "🎲 Sorteando ganhador..." : timeLeft}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <button
              type="button"
              onClick={() => setParticipantsOpen(true)}
              className="flex items-center gap-1 hover:text-primary transition-colors group"
            >
              <span>{giveaway.entries_count} participante{giveaway.entries_count !== 1 ? "s" : ""}</span>
              <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trophy className="h-4 w-4" />
            <span>{giveaway.winners_count} vencedor{giveaway.winners_count > 1 ? "es" : ""}</span>
          </div>
          {giveaway.channel_id && (
            <div className="flex items-center gap-2 text-muted-foreground" title={channelName || "Canal vinculado"}>
              <Hash className="h-4 w-4 shrink-0" />
              <span className="truncate">{channelName || "Canal vinculado"}</span>
            </div>
          )}
        </div>

        {/* Exibição dos vencedores caso finalizado e haja vencedores */}
        {isEnded && giveaway.winners && giveaway.winners.length > 0 && (
          <div className="pt-2 border-t border-border/40 space-y-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="h-3 w-3" />
              Ganhador{giveaway.winners.length !== 1 ? "es" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {giveaway.winners.map((w: any, idx: number) => (
                <div key={w.discord_user_id || idx} className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-full py-1 pr-3 pl-1 text-xs">
                  {w.discord_avatar ? (
                    <img src={w.discord_avatar} alt="avatar" className="h-5 w-5 rounded-full object-cover" />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                      <UserCircle2 className="h-3 w-3" />
                    </div>
                  )}
                  <span className="font-medium truncate max-w-[120px]">{w.discord_username || w.discord_user_id}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isExpired && !isEnded && !isCanceled && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-2 text-xs text-yellow-500 text-center font-medium">
            ⚠️ Tempo esgotado — clique em "Sortear" para finalizar
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {!isEnded && !isCanceled && (
            <Button size="sm" onClick={() => onDraw(giveaway.id)} className="flex-1" variant={isExpired ? "default" : "default"}>
              <Trophy className="h-4 w-4 mr-1" /> Sortear
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onEdit(giveaway)} className={isEnded || isCanceled ? "flex-1" : ""}>
            <Pencil className="h-4 w-4" />
          </Button>
          {!isEnded && !isCanceled && (
            <Button size="sm" variant="outline" onClick={() => onCancel(giveaway.id)} title="Cancelar sorteio">
              <XCircle className="h-4 w-4 text-orange-500" />
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => onDelete(giveaway.id)} title="Excluir sorteio">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>

      <ParticipantsModal
        open={participantsOpen}
        onClose={() => setParticipantsOpen(false)}
        giveawayId={giveaway.id}
        giveawayTitle={giveaway.title}
      />
    </Card>
  );
}
