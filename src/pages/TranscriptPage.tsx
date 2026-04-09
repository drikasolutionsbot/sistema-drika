import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Loader2, AlertCircle } from "lucide-react";

const TranscriptPage = () => {
  const [searchParams] = useSearchParams();
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const tenantId = searchParams.get("tenant_id");
  const ticketId = searchParams.get("ticket_id");

  const transcriptUrl = useMemo(() => {
    if (!tenantId || !ticketId) return null;
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${baseUrl}/functions/v1/serve-transcript?tenant_id=${encodeURIComponent(tenantId)}&ticket_id=${encodeURIComponent(ticketId)}`;
  }, [tenantId, ticketId]);

  useEffect(() => {
    const loadTranscript = async () => {
      if (!transcriptUrl) {
        setError("Link do transcript inválido.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(transcriptUrl);
        if (!response.ok) {
          throw new Error("Não foi possível carregar o transcript.");
        }

        const content = await response.text();
        setHtml(content);
        document.title = "Transcript do Ticket";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar transcript.");
      } finally {
        setLoading(false);
      }
    };

    loadTranscript();
  }, [transcriptUrl]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Carregando transcript</h1>
          <p className="text-sm text-muted-foreground">Estamos preparando a visualização completa do ticket.</p>
        </div>
      </main>
    );
  }

  if (error || !html) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card px-8 py-10 text-center shadow-sm">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <h1 className="text-xl font-semibold text-foreground">Transcript indisponível</h1>
          <p className="text-sm text-muted-foreground">{error || "Não encontramos este transcript."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Transcript do ticket</h1>
            <p className="text-sm text-muted-foreground">Visualização legível do histórico completo da conversa.</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-0 sm:px-6 sm:py-6">
        <div className="overflow-hidden border-y border-border bg-card sm:rounded-2xl sm:border">
          <iframe
            title="Transcript do ticket"
            srcDoc={html}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            className="h-[calc(100vh-81px)] w-full border-0 bg-card"
          />
        </div>
      </section>
    </main>
  );
};

export default TranscriptPage;
