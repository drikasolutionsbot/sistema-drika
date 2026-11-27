export const TICKET_SELECT_PLACEHOLDER = "➡️ Clique aqui para ver as opções";
export const DISCORD_IS_COMPONENTS_V2_FLAG = 32768;

export const TICKET_DEFAULT_APP_EMOJI = {
  id: "1521240067064987669",
  name: "mail",
  animated: false,
} as const;

const NEUTRAL_CONTAINER_COLORS = new Set([
  "",
  "none",
  "#2b2d31",
  "#242429",
  "#1e1f22",
  "#1a1b1e",
  "#313338",
]);

const BUTTON_STYLE_MAP: Record<string, number> = {
  primary: 1,
  secondary: 2,
  success: 3,
  danger: 4,
  glass: 2,
  link: 2,
};

export interface TicketCategoryOptionInput {
  id: string;
  name: string;
  emoji?: string | null;
  description?: string | null;
}

export interface BuildTicketPanelInput {
  tenantId: string;
  channelId: string;
  title?: string | null;
  description?: string | null;
  howItWorks?: string | null;
  footer?: string | null;
  buttonLabel?: string | null;
  buttonStyle?: string | null;
  embedColor?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  categories?: TicketCategoryOptionInput[] | null;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultOpenTicketLabel?: string;
}

export interface ParsedDiscordEmoji {
  emoji: string | null;
  cleanLabel: string;
  isCustom: boolean;
  animated: boolean;
  customName?: string;
  customId?: string;
}

/**
 * Parses a leading custom Discord emoji (<:name:id> or <a:name:id>) or unicode emoji.
 */
export function parseDiscordEmoji(input: string): ParsedDiscordEmoji {
  const raw = String(input || "");
  const customMatch = raw.match(/^<(a?):(\w+):(\d+)>\s*/);
  if (customMatch) {
    return {
      emoji: customMatch[0].trim(),
      cleanLabel: raw.slice(customMatch[0].length),
      isCustom: true,
      animated: customMatch[1] === "a",
      customName: customMatch[2],
      customId: customMatch[3],
    };
  }

  const unicodeMatch = raw.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
  if (unicodeMatch) {
    return {
      emoji: unicodeMatch[1],
      cleanLabel: raw.slice(unicodeMatch[0].length),
      isCustom: false,
      animated: false,
    };
  }

  return {
    emoji: null,
    cleanLabel: raw,
    isCustom: false,
    animated: false,
  };
}

/**
 * Parses a hex color for Discord Container accent_color, omitting neutral dark values
 * so the borderless dark Container visual stays clean by default.
 */
export function parseTicketAccentColor(embedColor?: string | null): number | undefined {
  const normalized = (embedColor || "").trim().toLowerCase();
  if (!normalized || NEUTRAL_CONTAINER_COLORS.has(normalized)) {
    return undefined;
  }

  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return undefined;
  }

  return parseInt(hex, 16);
}

/**
 * Checks whether an automatic prompt line should be appended above the divider.
 */
export function resolveTicketPromptLine(bodyText: string, hasCategories: boolean): string | null {
  if (/continuar|abaixo|opções|opcoes|botão|botao|botões|botoes|menu|below/i.test(bodyText)) {
    return null;
  }
  return hasCategories
    ? "Clique nas opções abaixo para continuar:"
    : "Clique no botão abaixo para continuar:";
}

/**
 * Formats the markdown string placed inside the Ticket Container TextDisplay block.
 */
export function formatTicketPanelText(params: {
  title?: string | null;
  description?: string | null;
  howItWorks?: string | null;
  footer?: string | null;
  hasCategories: boolean;
  defaultTitle?: string;
  defaultDescription?: string;
}): string {
  const parts: string[] = [];
  const rawTitle = (params.title || params.defaultTitle || "Atendimento").trim();
  if (rawTitle) {
    const alreadyHeading = /^#{1,3}\s/.test(rawTitle) || /^\*\*.*\*\*$/.test(rawTitle);
    parts.push(alreadyHeading ? rawTitle : `### ${rawTitle}`);
  }

  const rawDesc = (params.description || params.defaultDescription || "").trim();
  if (rawDesc) {
    parts.push(rawDesc);
  }

  const rawHowItWorks = (params.howItWorks || "").trim();
  if (rawHowItWorks) {
    parts.push(`**Como funciona?**\n${rawHowItWorks}`);
  }

  const combinedBody = [rawDesc, rawHowItWorks].filter(Boolean).join("\n");
  const promptLine = resolveTicketPromptLine(combinedBody, params.hasCategories);
  if (promptLine) {
    parts.push(promptLine);
  }

  const rawFooter = (params.footer || "").trim();
  if (rawFooter) {
    parts.push(`-# ${rawFooter}`);
  }

  const text = parts.join("\n\n");
  return text.length > 3900 ? `${text.slice(0, 3897)}...` : text;
}

function buildCategorySelectOption(cat: TicketCategoryOptionInput): Record<string, unknown> {
  const option: Record<string, unknown> = {
    label: cat.name.slice(0, 100),
    value: cat.id,
  };

  if (cat.description) {
    option.description = cat.description.slice(0, 100);
  }

  if (cat.emoji) {
    const trimmed = String(cat.emoji).trim();
    const customMatch = trimmed.match(/<a?:(.+?):(\d+)>/);
    if (customMatch) {
      option.emoji = {
        name: customMatch[1],
        id: customMatch[2],
        animated: trimmed.startsWith("<a:"),
      };
    } else {
      const parsed = parseDiscordEmoji(trimmed);
      if (parsed.emoji) {
        option.emoji = { name: parsed.emoji };
      }
    }
  }

  return option;
}

function buildTicketActionRow(input: BuildTicketPanelInput, hasCategories: boolean): Record<string, unknown> {
  if (hasCategories) {
    const options = (input.categories || []).slice(0, 25).map(buildCategorySelectOption);
    return {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: `ticket_category_select:${input.tenantId}:${input.channelId}`,
          placeholder: TICKET_SELECT_PLACEHOLDER,
          min_values: 1,
          max_values: 1,
          options,
        },
      ],
    };
  }

  const discordStyle = BUTTON_STYLE_MAP[input.buttonStyle || "glass"] || 2;
  const fallbackLabel = input.defaultOpenTicketLabel || "Abrir Ticket";
  const parsed = parseDiscordEmoji(input.buttonLabel || fallbackLabel);
  const label = parsed.cleanLabel.trim() || fallbackLabel;

  let emoji: Record<string, unknown> = { ...TICKET_DEFAULT_APP_EMOJI };
  if (parsed.isCustom && parsed.customId && parsed.customName) {
    emoji = {
      id: parsed.customId,
      name: parsed.customName,
      animated: parsed.animated,
    };
  } else if (parsed.emoji && parsed.emoji !== "📩") {
    emoji = { name: parsed.emoji };
  }

  return {
    type: 1,
    components: [
      {
        type: 2,
        style: discordStyle,
        label,
        custom_id: `ticket_open_${input.tenantId}_${input.channelId}`,
        emoji,
      },
    ],
  };
}

/**
 * Builds a Discord Components V2 message payload (`flags: 32768`) containing a unified
 * dark Container (`type: 17`) with banner, text content, divider, and nested action row.
 */
export function buildTicketPanelPayload(input: BuildTicketPanelInput): {
  flags: number;
  components: Record<string, unknown>[];
} {
  const categories = Array.isArray(input.categories) ? input.categories : [];
  const hasCategories = categories.length > 0;
  const containerComponents: Record<string, unknown>[] = [];

  if (input.imageUrl) {
    containerComponents.push({
      type: 12,
      items: [{ media: { url: input.imageUrl } }],
    });
  }

  const mainText = formatTicketPanelText({
    title: input.title,
    description: input.description,
    howItWorks: input.howItWorks,
    footer: input.footer,
    hasCategories,
    defaultTitle: input.defaultTitle,
    defaultDescription: input.defaultDescription,
  });

  const textDisplay = {
    type: 10,
    content: mainText,
  };

  if (input.thumbnailUrl) {
    containerComponents.push({
      type: 9,
      components: [textDisplay],
      accessory: {
        type: 11,
        media: { url: input.thumbnailUrl },
      },
    });
  } else {
    containerComponents.push(textDisplay);
  }

  containerComponents.push({
    type: 14,
    divider: true,
    spacing: 1,
  });

  containerComponents.push(buildTicketActionRow(input, hasCategories));

  const container: Record<string, unknown> = {
    type: 17,
    components: containerComponents,
  };

  const accentColor = parseTicketAccentColor(input.embedColor);
  if (accentColor !== undefined) {
    container.accent_color = accentColor;
  }

  return {
    flags: DISCORD_IS_COMPONENTS_V2_FLAG,
    components: [container],
  };
}
