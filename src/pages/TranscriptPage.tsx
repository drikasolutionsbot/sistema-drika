import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { FileText, Loader2, AlertCircle, MessageSquare, Lock, Eye } from "lucide-react";

const TranscriptPage = () => {
  const [searchParams] = useSearchParams();
  const { channelId } = useParams<{ channelId: string }>();
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const tenantId = searchParams.get("tenant_id");
  const ticketId = searchParams.get("ticket_id");

  const transcriptUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (channelId) {
      return `${baseUrl}/functions/v1/serve-transcript?channel_id=${encodeURIComponent(channelId)}`;
    }
    if (tenantId && ticketId) {
      return `${baseUrl}/functions/v1/serve-transcript?tenant_id=${encodeURIComponent(tenantId)}&ticket_id=${encodeURIComponent(ticketId)}`;
    }
    return null;
  }, [channelId, tenantId, ticketId]);

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
        if (!response.ok) throw new Error("Não foi possível carregar o transcript.");
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

  const displayId = channelId || ticketId?.slice(0, 8) || "";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ background: "#1a1a1a" }}>
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#ff69b4" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#f5f5f5" }}>Carregando transcript</h1>
            <p className="mt-1 text-sm" style={{ color: "#888" }}>Aguarde um momento…</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !html) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ background: "#1a1a1a" }}>
        <div className="mx-4 flex max-w-sm flex-col items-center gap-4 rounded-xl px-8 py-10 text-center" style={{ background: "#242424", border: "1px solid #333" }}>
          <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "rgba(255,80,80,0.12)" }}>
            <AlertCircle className="h-6 w-6" style={{ color: "#ff5050" }} />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#f5f5f5" }}>Transcript indisponível</h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "#777" }}>
              {error || "Não foi possível encontrar este transcript."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "#1a1a1a" }}>
      {/* Header */}
      <header className="sticky top-0 z-20" style={{ background: "#222", borderBottom: "2px solid #ff69b4" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Logo icon */}
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "linear-gradient(135deg, #ff69b4, #da3a8a)" }}
            >
              <FileText className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide" style={{ color: "#f5f5f5", letterSpacing: "0.04em" }}>
                TRANSCRIPT
              </h1>
              {displayId && (
                <p className="flex items-center gap-1.5 text-xs" style={{ color: "#ff69b4" }}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#4ade80" }} />
                  {displayId}
                </p>
              )}
            </div>
          </div>

          <div className="hidden items-center gap-5 sm:flex">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#999" }}>
              <Lock style={{ width: 13, height: 13 }} />
              <span>Protegido</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#999" }}>
              <Eye style={{ width: 13, height: 13 }} />
              <span>Somente leitura</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="mx-auto max-w-5xl px-0 sm:px-5 sm:py-4">
        <div className="overflow-hidden sm:rounded-xl" style={{ border: "1px solid #333" }}>
          <iframe
            title="Transcript do ticket"
            srcDoc={html}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            className="h-[calc(100vh-52px)] w-full border-0"
            style={{ background: "#2f3136" }}
          />
        </div>
      </section>

      {/* Footer */}
      <div className="py-3 text-center">
        <p className="text-xs" style={{ color: "#444" }}>
          Powered by{" "}
          <span className="font-semibold" style={{ color: "#ff69b4" }}>DrikaHub</span>
        </p>
      </div>
    </main>
  );
};

export default TranscriptPage;
