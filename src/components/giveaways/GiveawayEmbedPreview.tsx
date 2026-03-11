import { Gift } from "lucide-react";
import { format } from "date-fns";

export interface GiveawayEmbedConfig {
  color: string;
  title: string;
  description: string;
  footer: string;
  thumbnail_url: string;
  image_url: string;
}

export const defaultEmbedConfig: GiveawayEmbedConfig = {
  color: "#FEE75C",
  title: "🎉 SORTEIO: {title}",
  description: "**Prêmio:** {prize}\n\n{description}\n\n⏰ **Encerra:** {ends_at}\n👥 **Vencedores:** {winners_count}",
  footer: "Reaja com 🎉 para participar!",
  thumbnail_url: "",
  image_url: "",
};

interface GiveawayEmbedPreviewProps {
  config: GiveawayEmbedConfig;
  giveawayData: {
    title: string;
    prize: string;
    description: string;
    winnersCount: string;
    date?: Date;
    time: string;
  };
}

function replacePlaceholders(template: string, data: GiveawayEmbedPreviewProps["giveawayData"]): string {
  let result = template;
  result = result.replace(/{title}/g, data.title || "Meu Sorteio");
  result = result.replace(/{prize}/g, data.prize || "Prêmio");
  result = result.replace(/{description}/g, data.description || "Participe reagindo abaixo!");
  result = result.replace(/{winners_count}/g, data.winnersCount || "1");

  if (data.date) {
    const d = new Date(data.date);
    const [h, m] = (data.time || "23:59").split(":").map(Number);
    d.setHours(h, m, 0, 0);
    result = result.replace(/{ends_at}/g, format(d, "dd/MM/yyyy 'às' HH:mm"));
  } else {
    result = result.replace(/{ends_at}/g, "dd/MM/yyyy às HH:mm");
  }

  return result;
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    let html = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/__(.+?)__/g, '<u>$1</u>');
    return <span key={i} dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }} />;
  });
}

export default function GiveawayEmbedPreview({ config, giveawayData }: GiveawayEmbedPreviewProps) {
  const title = replacePlaceholders(config.title, giveawayData);
  const description = replacePlaceholders(config.description, giveawayData);
  const footer = replacePlaceholders(config.footer, giveawayData);

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "#2B2D31" }}>
      <div className="p-0">
        {/* Discord message container */}
        <div className="flex gap-3 p-4">
          {/* Bot avatar */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center">
            <Gift className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {/* Bot name */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm" style={{ color: "#FFFFFF" }}>Drika Bot</span>
              <span className="text-[10px] px-1 py-0.5 rounded font-medium" style={{ backgroundColor: "#5865F2", color: "#FFFFFF" }}>BOT</span>
              <span className="text-xs" style={{ color: "#949BA4" }}>Hoje às {format(new Date(), "HH:mm")}</span>
            </div>

            {/* Embed */}
            <div className="rounded overflow-hidden flex max-w-[520px]" style={{ backgroundColor: "#2B2D31", border: "1px solid #1E1F22" }}>
              {/* Color bar */}
              <div className="w-1 flex-shrink-0" style={{ backgroundColor: config.color || "#FEE75C" }} />
              <div className="p-3 flex-1 min-w-0" style={{ backgroundColor: "#2B2D31" }}>
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <div className="font-semibold text-sm mb-1" style={{ color: "#FFFFFF" }}>
                      {title}
                    </div>
                    {/* Description */}
                    <div className="text-sm leading-relaxed flex flex-col" style={{ color: "#DBDEE1" }}>
                      {renderMarkdown(description)}
                    </div>
                  </div>
                  {/* Thumbnail */}
                  {config.thumbnail_url && (
                    <img
                      src={config.thumbnail_url}
                      alt="Thumbnail"
                      className="w-16 h-16 rounded object-cover flex-shrink-0"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  )}
                </div>

                {/* Image */}
                {config.image_url && (
                  <img
                    src={config.image_url}
                    alt="Embed"
                    className="mt-2 rounded max-w-full max-h-[300px] object-cover"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}

                {/* Footer */}
                {footer && (
                  <div className="mt-2 pt-2 text-xs flex items-center gap-1" style={{ color: "#949BA4", borderTop: "1px solid #3F4147" }}>
                    {footer}
                  </div>
                )}
              </div>
            </div>

            {/* Reactions */}
            <div className="flex gap-1 mt-1">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: "#3C4270", border: "1px solid #5865F2" }}>
                <span>🎉</span>
                <span style={{ color: "#DEE0FC" }}>1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
