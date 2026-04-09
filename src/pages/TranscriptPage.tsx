import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Loader2, AlertCircle, MessageSquare, Clock, Shield } from "lucide-react";

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
        document.title = "Transcript — DrikaHub";
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
      <main className="flex min-h-screen items-center justify-center" style={{ background: "linear-gradient(135deg, #0f0f14 0%, #1a1a2e 50%, #16213e 100%)" }}>
        <div className="flex flex-col items-center gap-6 text-center">
          {/* Animated rings */}
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-violet-500" style={{ animationDuration: "1.5s" }} />
            <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-cyan-400" style={{ animationDuration: "2s", animationDirection: "reverse" }} />
            <MessageSquare className="h-7 w-7 text-white/80" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Carregando transcript</h1>
            <p className="mt-1 text-sm text-white/50">Preparando a visualização do histórico…</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !html) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ background: "linear-gradient(135deg, #0f0f14 0%, #1a1a2e 50%, #16213e 100%)" }}>
        <div className="mx-4 flex max-w-sm flex-col items-center gap-5 rounded-2xl border border-white/10 bg-white/5 px-8 py-10 text-center backdrop-blur-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Transcript indisponível</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              {error || "Não foi possível encontrar este transcript. Verifique o link e tente novamente."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const shortId = ticketId ? ticketId.slice(0, 8) : "";

  return (
    <main className="min-h-screen" style={{ background: "linear-gradient(135deg, #0f0f14 0%, #1a1a2e 50%, #16213e 100%)" }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">Transcript</h1>
              {shortId && (
                <p className="flex items-center gap-1.5 text-xs text-white/40">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  ID: {shortId}
                </p>
              )}
            </div>
          </div>

          <div className="hidden items-center gap-4 sm:flex">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Shield className="h-3.5 w-3.5" />
              <span>Criptografado</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Clock className="h-3.5 w-3.5" />
              <span>Somente leitura</span>
            </div>
          </div>
        </div>
      </header>

      {/* Transcript content */}
      <section className="mx-auto max-w-5xl px-0 sm:px-6 sm:py-5">
        <div className="overflow-hidden border-white/10 sm:rounded-2xl sm:border">
          <iframe
            title="Transcript do ticket"
            srcDoc={html}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            className="h-[calc(100vh-65px)] w-full border-0"
            style={{ background: "#36393f" }}
          />
        </div>
      </section>

      {/* Footer branding */}
      <div className="py-4 text-center">
        <p className="text-xs text-white/20">
          Powered by <span className="font-medium text-white/30">DrikaHub</span>
        </p>
      </div>
    </main>
  );
};

export default TranscriptPage;
