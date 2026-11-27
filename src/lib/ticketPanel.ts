export {
  DEFAULT_HOW_IT_WORKS_TITLE,
  DISCORD_IS_COMPONENTS_V2_FLAG,
  TICKET_DEFAULT_APP_EMOJI,
  TICKET_SELECT_PLACEHOLDER,
  buildTicketPanelPayload,
  formatTicketPanelText,
  parseDiscordEmoji,
  parseTicketAccentColor,
  resolveHowItWorksHeading,
  resolveTicketPromptLine,
  type BuildTicketPanelInput,
  type ParsedDiscordEmoji,
  type TicketCategoryOptionInput,
} from "../../supabase/functions/_shared/ticket-panel";

export interface PreviewLine {
  kind: "quote" | "text" | "spacer";
  text: string;
}

/**
 * Splits multi-line description/body text into quote bars and regular paragraphs
 * matching Discord markdown blockquotes (`> ...`).
 */
export function parseTicketPreviewLines(input: string): PreviewLine[] {
  const lines = String(input || "").split(/\r?\n/);
  const result: PreviewLine[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      result.push({ kind: "spacer", text: "" });
      continue;
    }
    if (trimmed.startsWith(">")) {
      result.push({ kind: "quote", text: trimmed.replace(/^>\s?/, "") });
      continue;
    }
    result.push({ kind: "text", text: rawLine });
  }

  return result;
}
