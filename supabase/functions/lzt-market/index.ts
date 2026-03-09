import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LZT_BASE = "https://prod-api.lzt.market";

// Comprehensive Russian → Portuguese translation map for LZT Market
const RU_PT_MAP: Record<string, string> = {
  // Minecraft specific
  "МИД": "MFA", "Ява": "Java", "Коренная порода": "Bedrock",
  "Ява и Коренная порода": "Java e Bedrock",
  "Майнкрафт": "Minecraft", "майнкрафт": "minecraft",
  "Бедрок": "Bedrock", "бедрок": "bedrock",
  "Джава": "Java", "джава": "java",
  "Плащ": "Capa", "плащ": "capa",
  "Скин": "Skin", "скин": "skin",
  "Гиперпиксель": "Hypixel",
  // Account types
  "Аккаунт": "Conta", "аккаунт": "conta",
  "Полный доступ": "Acesso total", "полный доступ": "acesso total",
  "Без привязки": "Sem vínculo", "без привязки": "sem vínculo",
  "С привязкой": "Com vínculo", "с привязкой": "com vínculo",
  "Смена данных": "Troca de dados", "смена данных": "troca de dados",
  "Автовыдача": "Entrega automática", "автовыдача": "entrega automática",
  // Gaming general
  "Игра": "Jogo", "игра": "jogo", "Игры": "Jogos", "игры": "jogos",
  "Скины": "Skins", "скины": "skins", "Предметы": "Itens", "предметы": "itens",
  "Уровень": "Nível", "уровень": "nível",
  "Баланс": "Saldo", "баланс": "saldo",
  "Премиум": "Premium", "премиум": "premium",
  "Подписка": "Assinatura", "подписка": "assinatura",
  "Навсегда": "Para sempre", "навсегда": "para sempre",
  "Гарантия": "Garantia", "гарантия": "garantia",
  // Account details
  "Почта": "E-mail", "почта": "e-mail",
  "Пароль": "Senha", "пароль": "senha",
  "Личный": "Pessoal", "личный": "pessoal",
  "Рабочий": "Funcional", "рабочий": "funcional",
  "Новый": "Novo", "новый": "novo", "новая": "nova",
  "Старый": "Antigo", "старый": "antigo",
  // Platforms
  "Стим": "Steam", "стим": "steam",
  "Эпик Геймс": "Epic Games",
  "Ориджин": "Origin",
  "Юбисофт": "Ubisoft",
  "Баттлнет": "Battle.net",
  "Райот": "Riot Games",
  // Status/info
  "Продано": "Vendido", "продано": "vendido",
  "Доступно": "Disponível", "доступно": "disponível",
  "Описание": "Descrição", "описание": "descrição",
  "Категория": "Categoria", "категория": "categoria",
  "Цена": "Preço", "цена": "preço",
  "Купить": "Comprar", "купить": "comprar",
  "Данные": "Dados", "данные": "dados",
  "Выдача": "Entrega", "выдача": "entrega",
  "Мгновенная": "Instantânea", "мгновенная": "instantânea",
  "Восстановление": "Recuperação", "восстановление": "recuperação",
  // Connectors
  "и": "e", "или": "ou", "с": "com", "без": "sem", "на": "no", "для": "para",
  "не": "não", "нет": "não", "да": "sim",
};

// Extract best available image URL from LZT item data
function extractImageUrl(item: Record<string, unknown>): string | null {
  // 1. Try imagePreviewLinks array (some categories have preview images)
  if (Array.isArray(item.imagePreviewLinks) && item.imagePreviewLinks.length > 0) {
    const first = item.imagePreviewLinks[0];
    if (typeof first === "string") return first;
    if (typeof first === "object" && first !== null) {
      const obj = first as Record<string, string>;
      if (obj.image) return obj.image;
      if (obj.url) return obj.url;
    }
  }
  // 2. For Minecraft accounts, generate skin render from minecraft_id
  if (item.minecraft_id && typeof item.minecraft_id === "string") {
    return `https://crafatar.com/renders/body/${item.minecraft_id}?overlay&scale=4`;
  }
  // 3. Try common image fields
  if (item.primary_img && typeof item.primary_img === "string") return item.primary_img;
  if (item.ss && typeof item.ss === "object" && item.ss !== null) {
    const screenshots = Object.values(item.ss as Record<string, unknown>);
    if (screenshots.length > 0) {
      const first = screenshots[0];
      if (typeof first === "string") return first;
      if (typeof first === "object" && first !== null && "normal_size" in (first as Record<string, unknown>)) {
        return (first as Record<string, string>).normal_size;
      }
    }
  }
  if (item.image_url && typeof item.image_url === "string") return item.image_url;
  if (item.thumbnail_url && typeof item.thumbnail_url === "string") return item.thumbnail_url;
  // 4. Extract first image from descriptionHtml
  if (item.descriptionHtml && typeof item.descriptionHtml === "string") {
    const imgMatch = (item.descriptionHtml as string).match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) return imgMatch[1];
  }
  return null;
}

function translateRuToPt(text: string): string {
  if (!text) return text;
  let result = text;
  for (const [ru, pt] of Object.entries(RU_PT_MAP)) {
    result = result.replaceAll(ru, pt);
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("LZT_MARKET_API_TOKEN");
    if (!token) throw new Error("LZT_MARKET_API_TOKEN not configured");

    const { action, category, page, pmin, pmax, item_id, title, url: itemUrl } = await req.json();

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    // List categories
    if (action === "categories") {
      const res = await fetch(`${LZT_BASE}/category`, { headers });
      if (!res.ok) throw new Error(`LZT API error: ${res.status}`);
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get by URL (extract item_id from lzt.market URL)
    if (action === "get_by_url") {
      if (!itemUrl) throw new Error("Missing url");
      // Extract ID from URLs like https://lzt.market/1234567/ or https://prod-api.lzt.market/1234567
      const match = itemUrl.match(/(\d{5,})/);
      if (!match) throw new Error("Could not extract item ID from URL");
      const extractedId = match[1];
      const res = await fetch(`${LZT_BASE}/${extractedId}`, { headers });
      if (!res.ok) throw new Error(`LZT API error: ${res.status}`);
      const data = await res.json();
      // Translate item
      if (data?.item) {
        const item = data.item;
        item.title_translated = translateRuToPt(item.title_en || item.title || "");
        item.description_translated = translateRuToPt(item.descriptionEnPlain || item.description_en || item.description || "");
        item.extracted_image_url = extractImageUrl(item);
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search / list accounts by category
    if (action === "search") {
      const params = new URLSearchParams();
      if (page) params.set("page", String(page));
      if (pmin) params.set("pmin", String(pmin));
      if (pmax) params.set("pmax", String(pmax));
      if (title) params.set("title", String(title));

      const categoryPath = category ? `/${category}` : "";
      const url = `${LZT_BASE}${categoryPath}?${params.toString()}`;

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`LZT API error: ${res.status}`);
      const data = await res.json();

      // Translate all item titles
      if (data?.items && typeof data.items === "object") {
        for (const key of Object.keys(data.items)) {
          const item = data.items[key];
          item.title_translated = translateRuToPt(item.title_en || item.title || "");
          item.description_translated = translateRuToPt(item.descriptionEnPlain || item.description_en || item.description || "");
          item.extracted_image_url = extractImageUrl(item);
        }
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get single account details
    if (action === "get") {
      if (!item_id) throw new Error("Missing item_id");
      const res = await fetch(`${LZT_BASE}/${item_id}`, { headers });
      if (!res.ok) throw new Error(`LZT API error: ${res.status}`);
      const data = await res.json();
      if (data?.item) {
        const item = data.item;
        item.title_translated = translateRuToPt(item.title_en || item.title || "");
        item.description_translated = translateRuToPt(item.descriptionEnPlain || item.description_en || item.description || "");
        item.extracted_image_url = extractImageUrl(item);
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
