import { ExternalLink } from "lucide-react";
import type { EmbedData } from "./types";

/** Minimal markdown: bold, italic, underline, links */
const renderMarkdown = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*|__.*?__|_.*?_|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("__") && part.endsWith("__"))
      return <u key={i}>{part.slice(2, -2)}</u>;
    if ((part.startsWith("_") && part.endsWith("_")) || (part.startsWith("*") && part.endsWith("*")))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="bg-[#2f3136] px-1 rounded text-[0.85em]">{part.slice(1, -1)}</code>;
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch)
      return <a key={i} href={linkMatch[2]} className="text-[#00aff4] hover:underline" target="_blank" rel="noreferrer">{linkMatch[1]}</a>;
    return part;
  });
};

const BUTTON_COLORS: Record<string, string> = {
  primary: "#5865F2",
  secondary: "#4f545c",
  success: "#57F287",
  danger: "#ED4245",
  glass: "rgba(255,255,255,0.08)",
  link: "#4f545c",
};

const EmbedPreview = ({ embed }: { embed: EmbedData }) => {
  const hasContent = embed.title || embed.description || embed.author_name || embed.fields.length > 0 || embed.image_url || embed.thumbnail_url || embed.footer_text;
  const buttons = (embed.buttons || []).filter(b => b.enabled);

  if (!hasContent && buttons.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Preencha os campos para visualizar o embed.
      </div>
    );
  }

  return (
    <div className="font-[Whitney,Helvetica_Neue,Helvetica,Arial,sans-serif] text-sm">
      <div className="flex gap-4 p-4">
        <div className="h-10 w-10 rounded-full bg-[#5865F2] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">B</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-medium text-white text-[0.95rem]">Drika Bot</span>
            <span className="text-[#72767d] text-[0.7rem]">Hoje às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>

          {hasContent && (
            <div
              className="rounded overflow-hidden max-w-[520px] border-l-4"
              style={{ borderColor: embed.color, backgroundColor: "#2f3136" }}
            >
              <div className="p-4 flex gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  {embed.author_name && (
                    <div className="flex items-center gap-2">
                      {embed.author_icon_url && (
                        <img src={embed.author_icon_url} alt="" className="h-6 w-6 rounded-full" onError={e => (e.currentTarget.style.display = "none")} />
                      )}
                      <span className="text-xs font-medium text-white">
                        {embed.author_url ? (
                          <a href={embed.author_url} className="hover:underline text-white" target="_blank" rel="noreferrer">{embed.author_name}</a>
                        ) : embed.author_name}
                      </span>
                    </div>
                  )}

                  {embed.title && (
                    <div className="font-semibold text-white">
                      {embed.url ? (
                        <a href={embed.url} className="text-[#00aff4] hover:underline">{embed.title}</a>
                      ) : embed.title}
                    </div>
                  )}

                  {embed.description && (
                    <div className="text-[#dcddde] text-[0.875rem] leading-[1.125rem] whitespace-pre-wrap">
                      {renderMarkdown(embed.description)}
                    </div>
                  )}

                  {embed.fields.length > 0 && (
                    <div className="grid gap-2 mt-2" style={{
                      gridTemplateColumns: embed.fields.some(f => f.inline) ? "repeat(3, 1fr)" : "1fr",
                    }}>
                      {embed.fields.map(field => (
                        <div key={field.id} className={field.inline ? "" : "col-span-full"}>
                          <div className="text-xs font-semibold text-white mb-0.5">{field.name || "Campo"}</div>
                          <div className="text-[0.875rem] text-[#dcddde]">{renderMarkdown(field.value || "Valor")}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {embed.image_url && (
                    <img
                      src={embed.image_url}
                      alt=""
                      className="rounded mt-2 max-w-full max-h-[300px] object-contain"
                      onError={e => (e.currentTarget.style.display = "none")}
                    />
                  )}
                </div>

                {embed.thumbnail_url && (
                  <img
                    src={embed.thumbnail_url}
                    alt=""
                    className="h-20 w-20 rounded object-cover shrink-0"
                    onError={e => (e.currentTarget.style.display = "none")}
                  />
                )}
              </div>

              {(embed.footer_text || embed.timestamp) && (
                <div className="px-4 pb-3 flex items-center gap-2 text-[0.75rem] text-[#72767d]">
                  {embed.footer_icon_url && (
                    <img src={embed.footer_icon_url} alt="" className="h-5 w-5 rounded-full" onError={e => (e.currentTarget.style.display = "none")} />
                  )}
                  <span>
                    {embed.footer_text}
                    {embed.footer_text && embed.timestamp && " • "}
                    {embed.timestamp && new Date().toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          {buttons.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 max-w-[520px]">
              {buttons.map(btn => (
                <button
                  key={btn.id}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-medium text-white transition-opacity hover:opacity-90 ${btn.style === "glass" ? "border border-white/20 backdrop-blur-sm" : ""}`}
                  style={{ backgroundColor: BUTTON_COLORS[btn.style] || BUTTON_COLORS.primary }}
                >
                  {btn.emoji && <span>{btn.emoji}</span>}
                  <span>{btn.label || "Botão"}</span>
                  {btn.style === "link" && <ExternalLink className="h-3 w-3 ml-0.5 opacity-70" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmbedPreview;
