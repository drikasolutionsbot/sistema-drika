export {
  DEFAULT_HOW_IT_WORKS_TITLE,
  DISCORD_IS_COMPONENTS_V2_FLAG,
  TICKET_DEFAULT_APP_EMOJI,
  TICKET_SELECT_PLACEHOLDER,
  buildTicketPanelPayload,
  formatDescriptionWithQuoteBar,
  formatTicketPanelText,
  parseDiscordEmoji,
  parseTicketAccentColor,
  resolveHowItWorksHeading,
  resolveTicketPromptLine,
  resolveTicketSelectPlaceholder,
  type BuildTicketPanelInput,
  type ParsedDiscordEmoji,
  type TicketCategoryOptionInput,
} from "../../supabase/functions/_shared/ticket-panel";

export interface PreviewLine {
  kind: "quote" | "quote_spacer" | "text" | "spacer";
  text: string;
}

export type PreviewBlock =
  | { kind: "quote_group"; lines: PreviewLine[] }
  | { kind: "line"; line: PreviewLine };

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
    if (trimmed === ">") {
      result.push({ kind: "quote_spacer", text: "" });
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

/**
 * Groups consecutive quoted lines (`>` and empty `>` spacers) into one continuous bar block.
 */
export function groupTicketPreviewBlocks(lines: PreviewLine[]): PreviewBlock[] {
  const blocks: PreviewBlock[] = [];

  for (const line of lines) {
    if (line.kind === "quote" || line.kind === "quote_spacer") {
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === "quote_group") {
        prev.lines.push(line);
      } else {
        blocks.push({ kind: "quote_group", lines: [line] });
      }
      continue;
    }
    blocks.push({ kind: "line", line });
  }

  return blocks;
}
