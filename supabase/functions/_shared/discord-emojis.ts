// Crisp pure-white 64x64 RGBA PNG icons matching Discord dark secondary/link buttons.
const DISCORD_API = "https://discord.com/api/v10";

export const WHITE_CART_PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABzElEQVR42u2aUZHEIAyGKwEJlYAEJCABCUhYB0ioBCRUQiVUAhJyLzs3+7C9KzSBAGEmj9uZfM2GP3+6AMAycywCQAAIAAEgAATAb6wAEABg/yciAPjRAGgASJB39pEARCg7ehQAeyEAPwoAXwggjtQEQwGAc6Zr8LiAoGYBcFUhdhYA7gLAaxYAejQ9UPKjb2Ip3VCPLcNhAijVCy2PxgTw6iz5E/svYDsDsGEDUJ0BsBR+wNlJ8onKEIkjlP8TAL4TAI4KgOkEgKL0BLmfSG2KHr2X/1MAgTmAlRqAY5z8UWMvoBkD8LUWI6nn8scAwHEyPGuuxjhOhqEmAI6Toa4JQPVc/ljbYU6T4dYCQPzDKK0dpgUA27NLjPUg96EJtp42RVgPuvthBXXE3C0VRvKKoUVmawLgaI7sswOItXsAJ3Mk5ahBzI5q37NBy/A5k6B8J0gIQL17g8l9I5m9xzz9So0i8XCh0RWB6Pq0wDQHABHDpyv0IVMJBMzk75ik7mF1Jaz7nwJAxBQoD8yXZgB2YgB37TfTCsA2ewUYBj0gtr4FNqK3f/cWWDkIoXBhVStEyX1+gau5KkEqd0hjKE2ZBQSAABAAAmDm+AELbMKhTTsDogAAAABJRU5ErkJggg==";

export const WHITE_TROPHY_PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAB6ElEQVR42u2b7Y2EIBCGLcESKIESKGFLsARLsANLsIQrgRIoYUuwhLlswiWEiOI6MuC9k/BHiYwPOF9gR0Tdf24dAAAAAAAAAADApSYtAAAAAgA0ERnfpOVPD10CwGegN9Urb6/jLQAGakcGbgAvak9eXAB6Ilo3BnCJ66Vl9bpsXe85AEzRg3+ISFXoBZTXLZSJA0Bo9OzBfQmjF+tjD+6fAqCjAdVGn0UQwLKhj4r66CsAhuibr807pKy9y/UIZ77/JdFHCQJQCZ2WXDtwBsDeg5zAyzsGvVlWwKfNAgDmHX3YVsCQSVwLANCZK3Lg9AIm011KuL8wX2HzAvGL1eQJcjzA+45I0EbWdxT0AmPkjewdkWAqF1gTS7PE8s/RhS0XOJMNDoWWftFsMPc7d564vfHlrR/DfWkfWCpCdmOpTTtWmLv8FdqmdQOQKVETVEEtrjvIyDhnPzUpZicsFtkYMTfPfhM7Q7bA7FcNgDNLVK3uDXIkSXPLm6P9xcJpVjBT++7wlVB5fMr2+DcFE/ek8wHaBy7TgXewQT9NDz0gMe0AmFo8IAEAAAAAAAAAAAAAAFDi6BwAAECFAPqgMGkKVIXD1tcAQPK0qAEAAAAAAJAGoIIyVummWgyF8dMUAAAAAABALe0XaoEPhDv5UAkAAAAASUVORK5CYII=";

export type DiscordComponentEmoji =
  | { id: string; name: string; animated?: boolean }
  | { name: string };

const CART_EMOJI_NAME = "drika_cart_white";
const TROPHY_EMOJI_NAME = "drika_trophy_white";

let emojiCache: {
  expiresAt: number;
  cartEmoji: DiscordComponentEmoji;
  trophyEmoji: DiscordComponentEmoji;
} | null = null;

function decodeAppIdFromToken(botToken: string): string {
  try {
    const first = String(botToken || "").split(".")[0];
    if (!first) return "";
    const padded = first + "=".repeat((4 - (first.length % 4)) % 4);
    const decoded = atob(padded);
    return /^\d{17,20}$/.test(decoded) ? decoded : "";
  } catch {
    return "";
  }
}

async function resolveAppId(botToken: string): Promise<string> {
  const quick = decodeAppIdFromToken(botToken);
  if (quick) return quick;
  try {
    const res = await fetch(`${DISCORD_API}/oauth2/applications/@me`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (res.ok) {
      const app = await res.json();
      if (app?.id) return String(app.id);
    }
  } catch {
    // ignore fallback failure
  }
  return "";
}

async function createAppEmoji(
  botToken: string,
  appId: string,
  name: string,
  imageDataUri: string
): Promise<DiscordComponentEmoji | null> {
  try {
    const res = await fetch(`${DISCORD_API}/applications/${appId}/emojis`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, image: imageDataUri }),
    });
    if (res.ok) {
      const created = await res.json();
      if (created?.id && created?.name) {
        return { id: String(created.id), name: String(created.name), animated: Boolean(created.animated) };
      }
    } else {
      const txt = await res.text().catch(() => "");
      console.warn(`[discord-emojis] Could not create app emoji ${name}: ${res.status} ${txt}`);
    }
  } catch (err) {
    console.warn(`[discord-emojis] Error creating app emoji ${name}:`, err);
  }
  return null;
}

/**
 * Ensures white shopping cart and white trophy application emojis exist on the bot,
 * caching results cleanly for reuse across product cards and sale notifications.
 */
export async function ensureWhiteButtonEmojis(botToken: string): Promise<{
  cartEmoji: DiscordComponentEmoji;
  trophyEmoji: DiscordComponentEmoji;
}> {
  const fallbackCart: DiscordComponentEmoji = { name: "🛒" };
  const fallbackTrophy: DiscordComponentEmoji = { name: "🏆" };

  if (!botToken) {
    return { cartEmoji: fallbackCart, trophyEmoji: fallbackTrophy };
  }

  if (emojiCache && Date.now() < emojiCache.expiresAt) {
    return { cartEmoji: emojiCache.cartEmoji, trophyEmoji: emojiCache.trophyEmoji };
  }

  const appId = await resolveAppId(botToken);
  if (!appId) {
    return { cartEmoji: fallbackCart, trophyEmoji: fallbackTrophy };
  }

  let cartEmoji: DiscordComponentEmoji | null = null;
  let trophyEmoji: DiscordComponentEmoji | null = null;

  try {
    const listRes = await fetch(`${DISCORD_API}/applications/${appId}/emojis`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (listRes.ok) {
      const payload = await listRes.json().catch(() => ({}));
      const items: any[] = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
      const foundCart = items.find((e) => e?.name === CART_EMOJI_NAME);
      const foundTrophy = items.find((e) => e?.name === TROPHY_EMOJI_NAME);
      if (foundCart?.id) {
        cartEmoji = { id: String(foundCart.id), name: String(foundCart.name), animated: Boolean(foundCart.animated) };
      }
      if (foundTrophy?.id) {
        trophyEmoji = { id: String(foundTrophy.id), name: String(foundTrophy.name), animated: Boolean(foundTrophy.animated) };
      }
    }
  } catch {
    // proceed to fallback
  }

  if (!cartEmoji) {
    cartEmoji = await createAppEmoji(botToken, appId, CART_EMOJI_NAME, WHITE_CART_PNG_DATA_URI);
  }
  if (!trophyEmoji) {
    trophyEmoji = await createAppEmoji(botToken, appId, TROPHY_EMOJI_NAME, WHITE_TROPHY_PNG_DATA_URI);
  }

  const resolvedCart = cartEmoji || fallbackCart;
  const resolvedTrophy = trophyEmoji || fallbackTrophy;

  if (cartEmoji && trophyEmoji) {
    emojiCache = {
      expiresAt: Date.now() + 10 * 60 * 1000,
      cartEmoji: resolvedCart,
      trophyEmoji: resolvedTrophy,
    };
  }

  return { cartEmoji: resolvedCart, trophyEmoji: resolvedTrophy };
}

export async function resolveFeedbackChannelId(
  supabase: any,
  tenantId: string,
  storeConfig?: { feedback_channel_id?: string | null } | null
): Promise<string | null> {
  if (storeConfig?.feedback_channel_id) {
    return String(storeConfig.feedback_channel_id).trim() || null;
  }
  const { data } = await supabase
    .from("channel_configs")
    .select("discord_channel_id")
    .eq("tenant_id", tenantId)
    .eq("channel_key", "logs_feedback")
    .maybeSingle();
  return data?.discord_channel_id ? String(data.discord_channel_id).trim() : null;
}

export function buildFeedbackLinkButton(opts: {
  guildId?: string | null;
  feedbackChannelId?: string | null;
  label?: string;
  trophyEmoji?: DiscordComponentEmoji;
}): Record<string, unknown> | null {
  if (!opts.guildId || !opts.feedbackChannelId) return null;
  return {
    type: 2,
    style: 5,
    label: opts.label || "Feedbacks",
    url: `https://discord.com/channels/${opts.guildId}/${opts.feedbackChannelId}`,
    emoji: opts.trophyEmoji || { name: "🏆" },
  };
}
