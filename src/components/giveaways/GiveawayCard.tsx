import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gift, Users, Clock, Hash, Trophy, XCircle, Pencil } from "lucide-react";

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

export default function GiveawayCard({ giveaway, onDraw, onCancel, onEdit }: GiveawayCardProps) {
  const { timeLeft, isExpired } = useCountdown(giveaway.ends_at);
  const isEnded = giveaway.status === "ended";
  const isFinished = isEnded || isExpired;

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
            {isEnded ? "Encerrado" : isExpired ? "⏰ Finalizado" : "Ativo"}
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
            <span className={isFinished ? "text-yellow-500 font-medium animate-pulse" : ""}>
              {isEnded ? "⏰ Encerrado" : isExpired ? "🎲 Sorteando ganhador..." : timeLeft}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{giveaway.entries_count} participantes</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trophy className="h-4 w-4" />
            <span>{giveaway.winners_count} vencedor{giveaway.winners_count > 1 ? "es" : ""}</span>
          </div>
          {giveaway.channel_id && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Hash className="h-4 w-4" />
              <span className="truncate">Canal vinculado</span>
            </div>
          )}
        </div>

        {isExpired && !isEnded && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-2 text-xs text-yellow-500 text-center font-medium">
            ⚠️ Tempo esgotado — clique em "Sortear" para finalizar
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={() => onDraw(giveaway.id)} className="flex-1" variant={isExpired && !isEnded ? "default" : "default"}>
            <Trophy className="h-4 w-4 mr-1" /> Sortear
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEdit(giveaway)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onCancel(giveaway.id)}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
