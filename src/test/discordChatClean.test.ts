import { describe, expect, it } from "vitest";
import {
  DISCORD_PERMISSION_ADMINISTRATOR,
  formatChannelCleanSummary,
  hasDiscordAdminPermission,
  isAdminOnlyCommand,
} from "@/lib/discordChatClean";

describe("discordChatClean helpers", () => {
  it("grants access strictly to server Administrators or explicit owners", () => {
    expect(hasDiscordAdminPermission(String(DISCORD_PERMISSION_ADMINISTRATOR))).toBe(true);
    expect(hasDiscordAdminPermission(BigInt(0x8) | BigInt(0x2000))).toBe(true);

    // ManageMessages (0x2000) without Administrator (0x8) must NOT pass
    expect(hasDiscordAdminPermission(String(0x2000))).toBe(false);
    expect(hasDiscordAdminPermission("0")).toBe(false);
    expect(hasDiscordAdminPermission(null)).toBe(false);

    // Owner fallback still works
    expect(hasDiscordAdminPermission("0", "123456789012345678", ["123456789012345678"])).toBe(true);
    expect(hasDiscordAdminPermission("0", "999999999999999999", ["123456789012345678"])).toBe(false);
  });

  it("identifies admin-only moderation commands", () => {
    expect(isAdminOnlyCommand("/clear")).toBe(true);
    expect(isAdminOnlyCommand("limpar")).toBe(true);
    expect(isAdminOnlyCommand("/PAINEL")).toBe(true);
    expect(isAdminOnlyCommand("/comprar")).toBe(false);
    expect(isAdminOnlyCommand("/estoque")).toBe(false);
  });

  it("formats the channel clean summary card text cleanly", () => {
    const manual = formatChannelCleanSummary(54, "998877665544332211", 1795774680);
    expect(manual).toBe("O canal teve **54 mensagens excluídas** pelo <@998877665544332211> <t:1795774680:f>");

    const singular = formatChannelCleanSummary(1, "998877665544332211", 1795774680);
    expect(singular).toBe("O canal teve **1 mensagem excluída** pelo <@998877665544332211> <t:1795774680:f>");

    const auto = formatChannelCleanSummary(12, null, 1795774680);
    expect(auto).toBe("O canal teve **12 mensagens excluídas** automaticamente <t:1795774680:f>");
  });
});
