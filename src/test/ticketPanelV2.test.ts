import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOW_IT_WORKS_TITLE,
  DISCORD_IS_COMPONENTS_V2_FLAG,
  TICKET_DEFAULT_APP_EMOJI,
  TICKET_SELECT_PLACEHOLDER,
  buildTicketPanelPayload,
  formatDescriptionWithQuoteBar,
  formatTicketPanelText,
  groupTicketPreviewBlocks,
  parseTicketAccentColor,
  parseTicketPreviewLines,
  resolveHowItWorksHeading,
  resolveTicketPromptLine,
  resolveTicketSelectPlaceholder,
} from "@/lib/ticketPanel";

describe("ticketPanel Components V2 payload", () => {
  it("builds a unified Components V2 Container with banner, text, separator, and select menu inside", () => {
    const payload = buildTicketPanelPayload({
      tenantId: "tenant-123",
      channelId: "999888777",
      title: "CENTRAL ATENDIMENTO | FLOW STORE",
      description: [
        "> ⭐ Receba atendimento e tire suas dúvidas!",
        "",
        "> 🛒 Peça o produto que você comprou.",
      ].join("\n"),
      imageUrl: "https://cdn.example.com/banner.png",
      embedColor: "#2B2D31",
      categories: [
        { id: "cat-1", name: "Suporte", emoji: "🛠️", description: "Ajuda geral" },
        { id: "cat-2", name: "Compras", emoji: "<:cart:123456789>", description: "Entrega de pedidos" },
      ],
    });

    expect(payload.flags).toBe(DISCORD_IS_COMPONENTS_V2_FLAG);
    expect("embeds" in payload).toBe(false);
    expect("content" in payload).toBe(false);
    expect(payload.components).toHaveLength(1);

    const container = payload.components[0] as any;
    expect(container.type).toBe(17);
    expect(container.accent_color).toBeUndefined();
    expect(container.components).toHaveLength(4);

    // 1. Top MediaGallery banner
    expect(container.components[0]).toEqual({
      type: 12,
      items: [{ media: { url: "https://cdn.example.com/banner.png" } }],
    });

    // 2. TextDisplay with heading, quote lines, and auto prompt
    expect(container.components[1].type).toBe(10);
    expect(container.components[1].content).toContain("### CENTRAL ATENDIMENTO | FLOW STORE");
    expect(container.components[1].content).toContain("> ⭐ Receba atendimento e tire suas dúvidas!");
    expect(container.components[1].content).toContain("Clique nas opções abaixo para continuar:");

    // 3. Hairline Separator
    expect(container.components[2]).toEqual({
      type: 14,
      divider: true,
      spacing: 1,
    });

    // 4. Nested ActionRow with StringSelect inside Container
    const actionRow = container.components[3];
    expect(actionRow.type).toBe(1);
    const select = actionRow.components[0];
    expect(select.type).toBe(3);
    expect(select.custom_id).toBe("ticket_category_select:tenant-123:999888777");
    expect(select.placeholder).toBe(TICKET_SELECT_PLACEHOLDER);
    expect(select.options).toHaveLength(2);
    expect(select.options[0].emoji).toEqual({ name: "🛠️" });
    expect(select.options[1].emoji).toEqual({ id: "123456789", name: "cart", animated: false });
  });

  it("places fallback ticket button inside the Container when there are no categories", () => {
    const payload = buildTicketPanelPayload({
      tenantId: "tenant-abc",
      channelId: "111222333",
      title: "Atendimento",
      description: "Clique no botão abaixo para abrir um ticket.",
      buttonLabel: "📩 Abrir Atendimento",
      buttonStyle: "glass",
      embedColor: "#5865F2",
      thumbnailUrl: "https://cdn.example.com/thumb.png",
      categories: [],
    });

    const container = payload.components[0] as any;
    expect(container.type).toBe(17);
    expect(container.accent_color).toBe(0x5865f2);

    // Without banner: Section(9 with Thumbnail 11) + Separator(14) + ActionRow(1 with Button 2)
    expect(container.components).toHaveLength(3);
    expect(container.components[0].type).toBe(9);
    expect(container.components[0].accessory).toEqual({
      type: 11,
      media: { url: "https://cdn.example.com/thumb.png" },
    });
    expect(container.components[0].components[0].content).not.toContain("Clique no botão abaixo para continuar:");
    expect(container.components[1]).toEqual({ type: 14, divider: true, spacing: 1 });

    const btn = container.components[2].components[0];
    expect(btn).toEqual({
      type: 2,
      style: 2,
      label: "Abrir Atendimento",
      custom_id: "ticket_open_tenant-abc_111222333",
      emoji: TICKET_DEFAULT_APP_EMOJI,
    });
  });

  it("treats neutral dark colors as borderless V2 containers and parses preview quotes", () => {
    expect(parseTicketAccentColor("")).toBeUndefined();
    expect(parseTicketAccentColor("#2B2D31")).toBeUndefined();
    expect(parseTicketAccentColor("#242429")).toBeUndefined();
    expect(parseTicketAccentColor("#ED4245")).toBe(0xed4245);

    expect(resolveTicketPromptLine("Clique nas opções abaixo para continuar:", true)).toBeNull();
    expect(resolveTicketPromptLine("Atendimento rápido 24h", true)).toBe("Clique nas opções abaixo para continuar:");

    const parsed = parseTicketPreviewLines("> ⭐ Linha um\n\nTexto normal");
    expect(parsed).toEqual([
      { kind: "quote", text: "⭐ Linha um" },
      { kind: "spacer", text: "" },
      { kind: "text", text: "Texto normal" },
    ]);
  });

  it("uses Como funciona? as default field title and respects custom or empty overrides", () => {
    expect(resolveHowItWorksHeading(undefined)).toBe(DEFAULT_HOW_IT_WORKS_TITLE);
    expect(resolveHowItWorksHeading(null)).toBe("Como funciona?");
    expect(resolveHowItWorksHeading("Atendimento")).toBe("Atendimento");
    expect(resolveHowItWorksHeading("")).toBe("");

    const withDefault = formatTicketPanelText({
      title: "Atendimento",
      description: "Descrição",
      howItWorks: "Texto extra",
      hasCategories: true,
    });
    expect(withDefault).toContain("**Como funciona?**\nTexto extra");

    const withCustom = formatTicketPanelText({
      title: "Atendimento",
      description: "Descrição",
      howItWorksTitle: "Horário de Atendimento",
      howItWorks: "09h às 22h",
      hasCategories: true,
    });
    expect(withCustom).toContain("**Horário de Atendimento**\n09h às 22h");

    const withoutHeading = formatTicketPanelText({
      title: "Atendimento",
      description: "Descrição",
      howItWorksTitle: "",
      howItWorks: "Somente o corpo",
      hasCategories: true,
    });
    expect(withoutHeading).not.toContain("**Como funciona?**");
    expect(withoutHeading).toContain("Somente o corpo");
  });

  it("wraps description paragraphs into a single continuous quote bar and stops before the prompt", () => {
    const formatted = formatDescriptionWithQuoteBar(
      "⭐ Linha 1\n\n🛒 Linha 2\n\n🎧 Linha 3",
      true
    );
    expect(formatted).toBe("> ⭐ Linha 1\n>\n> 🛒 Linha 2\n>\n> 🎧 Linha 3");

    const blocks = groupTicketPreviewBlocks(parseTicketPreviewLines(formatted));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("quote_group");
    if (blocks[0].kind === "quote_group") {
      expect(blocks[0].lines).toHaveLength(5);
      expect(blocks[0].lines[1].kind).toBe("quote_spacer");
    }

    const panelText = formatTicketPanelText({
      title: "CENTRAL ATENDIMENTO | FLOW STORE",
      description: "⭐ Linha 1\n\n🛒 Linha 2",
      quoteBar: true,
      hasCategories: true,
    });
    expect(panelText).toBe(
      "### CENTRAL ATENDIMENTO | FLOW STORE\n\n> ⭐ Linha 1\n>\n> 🛒 Linha 2\n\nClique nas opções abaixo para continuar:"
    );
  });

  it("supports custom emoji and text for the category selector placeholder with safe fallback", () => {
    expect(resolveTicketSelectPlaceholder("")).toBe(TICKET_SELECT_PLACEHOLDER);
    expect(resolveTicketSelectPlaceholder("🎫 Escolha uma categoria")).toBe("🎫 Escolha uma categoria");
    expect(resolveTicketSelectPlaceholder("a".repeat(200)).length).toBe(150);

    const payload = buildTicketPanelPayload({
      tenantId: "tenant-1",
      channelId: "123",
      selectPlaceholder: "📩 Selecione o setor desejado",
      categories: [{ id: "cat-1", name: "Suporte" }],
    });
    const container = payload.components[0] as any;
    const actionRow = container.components[container.components.length - 1];
    expect(actionRow.components[0].placeholder).toBe("📩 Selecione o setor desejado");
  });
});
