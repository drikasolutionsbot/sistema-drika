import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Cache WASM and fonts across invocations (warm starts)
let wasmInitialized = false;
let fontRegular: Uint8Array | null = null;
let fontBold: Uint8Array | null = null;

async function ensureInitialized() {
  if (!wasmInitialized) {
    const wasmRes = await fetch(
      "https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm",
    );
    await initWasm(await wasmRes.arrayBuffer());
    wasmInitialized = true;
  }
  if (!fontRegular || !fontBold) {
    const [r, b] = await Promise.all([
      fetch(
        "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf",
      ).then((res) => res.arrayBuffer()),
      fetch(
        "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf",
      ).then((res) => res.arrayBuffer()),
    ]);
    fontRegular = new Uint8Array(r);
    fontBold = new Uint8Array(b);
  }
}

function escapeXml(unsafe: string): string {
  return String(unsafe || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateReceiptSvg(params: {
  userName: string;
  userTag: string;
  dateTime: string;
  title: string;
  productName: string;
  productPrice: string;
  subtotal: string;
  total: string;
  storeName: string;
  avatarDataUri?: string;
  storeLogoDataUri?: string;
}): string {
  const {
    userName,
    userTag,
    dateTime,
    title,
    productName,
    productPrice,
    subtotal,
    total,
    storeName,
    avatarDataUri,
    storeLogoDataUri,
  } = params;

  const e = escapeXml;

  const avatarSection = avatarDataUri
    ? `<image href="${e(avatarDataUri)}" x="29" y="29" width="42" height="42" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice" />
       <circle cx="50" cy="50" r="21" fill="none" stroke="#2a2d3d" stroke-width="1.5" />`
    : `<circle cx="50" cy="50" r="21" fill="#202330" stroke="#2a2d3d" stroke-width="1.5" />
       <circle cx="50" cy="44" r="6" fill="#75798e" />
       <path d="M38 60 q0-12 12-12 t12 12" fill="#75798e" />`;

  const storeLogoSection = storeLogoDataUri
    ? `<image href="${e(storeLogoDataUri)}" x="28" y="327" width="20" height="20" clip-path="url(#storeLogoClip)" preserveAspectRatio="xMidYMid slice" />
       <rect x="28" y="327" width="20" height="20" rx="5" fill="none" stroke="#2a2d3d" stroke-width="1" />`
    : `<rect x="28" y="327" width="20" height="20" rx="5" fill="#202330" stroke="#2a2d3d" stroke-width="1" />
       <circle cx="38" cy="334" r="3" fill="#75798e" />
       <path d="M32 343 q0-6 6-6 t6 6" fill="#75798e" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="370" viewBox="0 0 680 370">
  <defs>
    <clipPath id="avatarClip">
      <circle cx="50" cy="50" r="21" />
    </clipPath>
    <clipPath id="storeLogoClip">
      <rect x="28" y="327" width="20" height="20" rx="5" />
    </clipPath>
  </defs>

  <!-- Background Card -->
  <rect x="1" y="1" width="678" height="368" rx="16" fill="#0d0e13" stroke="#1d1f2b" stroke-width="1.5" />

  <!-- Avatar -->
  ${avatarSection}

  <!-- User Name -->
  <text x="82" y="44" fill="#ffffff" font-size="16" font-family="Inter, sans-serif" font-weight="700">${e(userName)}</text>
  <!-- User Tag -->
  <text x="82" y="61" fill="#696d7d" font-size="13" font-family="Inter, sans-serif" font-weight="400">${e(userTag)}</text>

  <!-- Date & Time (Top Right) -->
  <text x="652" y="44" fill="#696d7d" font-size="13" font-family="Inter, sans-serif" font-weight="400" text-anchor="end">${e(dateTime)}</text>

  <!-- Title Row -->
  <circle cx="39" cy="104" r="11" fill="#00D26A" />
  <path d="M35 104.2 L37.8 107 L43.5 101" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
  <text x="60" y="111" fill="#ffffff" font-size="21" font-family="Inter, sans-serif" font-weight="900">${e(title)}</text>

  <!-- CARRINHO Label -->
  <text x="28" y="148" fill="#585c6c" font-size="11" font-family="Inter, sans-serif" font-weight="700" letter-spacing="0.8">CARRINHO</text>
  <!-- Product Name -->
  <text x="28" y="174" fill="#ffffff" font-size="15" font-family="Inter, sans-serif" font-weight="500">${e(productName)}</text>
  <!-- Product Price -->
  <text x="652" y="174" fill="#ffffff" font-size="16" font-family="Inter, sans-serif" font-weight="700" text-anchor="end">${e(productPrice)}</text>

  <!-- Divider Line -->
  <line x1="28" y1="195" x2="652" y2="195" stroke="#1d1f2b" stroke-width="1.2" />

  <!-- SUBTOTAL Row -->
  <text x="28" y="218" fill="#75798e" font-size="13" font-family="Inter, sans-serif" font-weight="600" letter-spacing="0.5">SUBTOTAL</text>
  <!-- Subtotal Value -->
  <text x="652" y="218" fill="#ffffff" font-size="16" font-family="Inter, sans-serif" font-weight="700" text-anchor="end">${e(subtotal)}</text>

  <!-- Valor Pago Box -->
  <rect x="28" y="244" width="624" height="62" rx="12" fill="#13141d" stroke="#1f2230" stroke-width="1.2" />
  <text x="46" y="281" fill="#686d7e" font-size="12" font-family="Inter, sans-serif" font-weight="700" letter-spacing="0.8">VALOR PAGO</text>
  <text x="634" y="287" fill="#00D26A" font-size="30" font-family="Inter, sans-serif" font-weight="900" text-anchor="end">${e(total)}</text>

  <!-- Footer: Store Logo + Name -->
  ${storeLogoSection}
  <text x="56" y="342" fill="#ffffff" font-size="12" font-family="Inter, sans-serif" font-weight="900" letter-spacing="0.8">${e(storeName)}</text>
</svg>`;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

async function fetchImageAsDataUri(
  url: string,
  fallback: string | null = null,
): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return fallback;
    const buf = await res.arrayBuffer();
    const ct = res.headers.get("content-type") || "image/png";
    const mimeType = ct.split(";")[0].trim();
    const b64 = toBase64(buf);
    return `data:${mimeType};base64,${b64}`;
  } catch {
    return fallback;
  }
}

function formatCdnUrl(url?: string | null): string {
  if (!url) return "";
  return url
    .replace("krudxivcuygykoswjbbx.supabase.co", "cdn-drika.studyhakify.workers.dev")
    .replace("iwotvdfxppjwasywrbmw.supabase.co", "cdn-drika.studyhakify.workers.dev");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      userName = "Usuário",
      userTag = "",
      userAvatarUrl = "",
      dateTime,
      title = "Compra Realizada",
      productName = "Produto",
      productPrice,
      subtotal,
      total,
      storeName = "Loja",
      storeLogoUrl = "",
    } = body;

    await ensureInitialized();

    // Fetch avatar + store logo concurrently via Cloudflare CDN (best effort)
    const [avatarDataUri, storeLogoDataUri] = await Promise.all([
      userAvatarUrl ? fetchImageAsDataUri(formatCdnUrl(userAvatarUrl)) : Promise.resolve(null),
      storeLogoUrl ? fetchImageAsDataUri(formatCdnUrl(storeLogoUrl)) : Promise.resolve(null),
    ]);

    // Format date/time
    const now = new Date();
    const formattedDateTime = dateTime ||
      `${now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} - ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

    const truncatedProductName =
      productName.length > 45 ? `${productName.slice(0, 42)}...` : productName;
    const truncatedUserName =
      userName.length > 25 ? `${userName.slice(0, 23)}...` : userName;
    const truncatedStoreName =
      storeName.length > 40 ? `${storeName.slice(0, 37)}...` : storeName;

    const svg = generateReceiptSvg({
      userName: truncatedUserName,
      userTag: userTag.startsWith("@") ? userTag : `@${userTag}`,
      dateTime: formattedDateTime,
      title,
      productName: truncatedProductName,
      productPrice: productPrice || total || "R$ 0,00",
      subtotal: subtotal || total || "R$ 0,00",
      total: total || "R$ 0,00",
      storeName: truncatedStoreName.toUpperCase(),
      avatarDataUri: avatarDataUri ?? undefined,
      storeLogoDataUri: storeLogoDataUri ?? undefined,
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 680 },
      font: {
        fontBuffers: [fontRegular!, fontBold!],
        defaultFontFamily: "Inter",
      },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("generate-sale-image error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
