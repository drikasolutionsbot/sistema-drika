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

export type DiscordInlineSegment =
  | { kind: "text"; value: string }
  | { kind: "emoji"; id: string; name: string; animated: boolean; url: string };

/**
 * Splits a Discord markdown string into plain text and custom/animated Nitro emoji tokens.
 */
export function tokenizeDiscordInlineEmojis(input: string): DiscordInlineSegment[] {
  const source = String(input || "");
  if (!source) return [];

  const regex = /<(a?):(\w+):(\d+)>/g;
  const segments: DiscordInlineSegment[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(regex)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      segments.push({ kind: "text", value: source.slice(lastIndex, idx) });
    }
    const animated = match[1] === "a";
    const name = match[2];
    const id = match[3];
    segments.push({
      kind: "emoji",
      id,
      name,
      animated,
      url: `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}`,
    });
    lastIndex = idx + match[0].length;
  }

  if (lastIndex < source.length) {
    segments.push({ kind: "text", value: source.slice(lastIndex) });
  }

  return segments;
}

/**
 * Splits multi-line description/body text into quote bars and regular paragraphs
 * matching Discord markdown blockquotes (`> ...`).
 */
export function parseTicketPreviewLines(input: string): PreviewLine[] {
  const lines = String(input || "").split(/\r?\n/);
  const result: PreviewLine[] = [];
  let inMultilineQuote = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!inMultilineQuote && (trimmed === ">>>" || trimmed.startsWith(">>> "))) {
      inMultilineQuote = true;
      const afterPrefix = rawLine.replace(/^\s*>>>\s?/, "");
      if (afterPrefix.trim()) {
        result.push({ kind: "quote", text: afterPrefix });
      }
      continue;
    }

    if (inMultilineQuote) {
      if (!trimmed) {
        result.push({ kind: "quote_spacer", text: "" });
      } else {
        result.push({ kind: "quote", text: rawLine });
      }
      continue;
    }

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
