import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

let wasmInitialized = false;
let fontRegular: Uint8Array | null = null;
let fontBold: Uint8Array | null = null;
let fontBlack: Uint8Array | null = null;

async function ensureInitialized() {
  if (!wasmInitialized) {
    const wasmRes = await fetch(
      "https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm",
    );
    await initWasm(await wasmRes.arrayBuffer());
    wasmInitialized = true;
  }
  if (!fontRegular || !fontBold || !fontBlack) {
    const [r, b, bl] = await Promise.all([
      fetch("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf").then((res) => res.arrayBuffer()),
      fetch("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf").then((res) => res.arrayBuffer()),
      fetch("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-900-normal.ttf").then((res) => res.arrayBuffer()),
    ]);
    fontRegular = new Uint8Array(r);
    fontBold = new Uint8Array(b);
    fontBlack = new Uint8Array(bl);
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

function generateRestockSvg(params: {
  productName: string;
  addedCount: string;
  totalStock: string;
  dateTime: string;
  themeColor?: string; // hex like #9333ea
}): string {
  const e = escapeXml;
  const theme = params.themeColor || "#9333ea"; // Default purple
  
  // Format dates: "05/10 - 13:40"
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a0f" />
      <stop offset="100%" stop-color="#1a1a24" />
    </linearGradient>
    <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme}" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.8" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="800" height="400" fill="url(#bgGradient)" rx="24" />
  
  <!-- Subtle theme accent shape -->
  <circle cx="650" cy="200" r="250" fill="url(#accentGradient)" />
  <circle cx="100" cy="-50" r="300" fill="url(#accentGradient)" />

  <!-- Top Badge: RESTOCK -->
  <rect x="60" y="50" width="160" height="48" rx="24" fill="#ffffff" />
  <path d="M95 62 L85 75 L92 75 L89 86 L100 73 L93 73 Z" fill="#000000" />
  <text x="110" y="80" fill="#000000" font-size="18" font-family="Inter, sans-serif" font-weight="900" letter-spacing="1.5">RESTOCK</text>

  <text x="240" y="79" fill="#8b8e9b" font-size="16" font-family="Inter, sans-serif" font-weight="400">novos itens acabaram de chegar</text>

  <!-- Product Name (huge) -->
  <text x="60" y="160" fill="#ffffff" font-size="42" font-family="Inter, sans-serif" font-weight="900" letter-spacing="-0.5">${e(params.productName)}</text>
  
  <line x1="60" y1="190" x2="450" y2="190" stroke="#2a2d3d" stroke-width="2" />

  <!-- Adicionados Box -->
  <rect x="60" y="230" width="180" height="90" rx="16" fill="#13141d" stroke="#2a2d3d" stroke-width="1.5" />
  <rect x="80" y="250" width="30" height="30" rx="6" fill="#1c1f2e" />
  <!-- Box icon inside little rect -->
  <path d="M87 265 L95 261 L103 265 M87 265 L87 271 L95 275 L95 261 M95 275 L103 271 L103 265" stroke="#75798e" stroke-width="2" fill="none" stroke-linejoin="round" />
  <text x="125" y="265" fill="#75798e" font-size="14" font-family="Inter, sans-serif" font-weight="600">Adicionados</text>
  <text x="125" y="295" fill="#ffffff" font-size="28" font-family="Inter, sans-serif" font-weight="900">${e(params.addedCount)}x</text>

  <!-- Data Box -->
  <rect x="260" y="230" width="220" height="90" rx="16" fill="#13141d" stroke="#2a2d3d" stroke-width="1.5" />
  <rect x="280" y="250" width="30" height="30" rx="6" fill="#1c1f2e" />
  <!-- Clock icon -->
  <circle cx="295" cy="265" r="7" stroke="#75798e" stroke-width="2" fill="none" />
  <path d="M295 260 L295 265 L299 265" stroke="#75798e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  <text x="325" y="265" fill="#75798e" font-size="14" font-family="Inter, sans-serif" font-weight="600">Data</text>
  <text x="325" y="295" fill="#ffffff" font-size="22" font-family="Inter, sans-serif" font-weight="900">${e(params.dateTime)}</text>

  <!-- Total Stock Circle Section on Right -->
  <circle cx="650" cy="160" r="90" fill="#13141d" stroke="#2a2d3d" stroke-width="2" />
  <circle cx="650" cy="160" r="105" fill="none" stroke="${theme}" stroke-width="1" stroke-dasharray="8 8" opacity="0.5" />
  
  <text x="650" y="170" fill="#ffffff" font-size="64" font-family="Inter, sans-serif" font-weight="900" text-anchor="middle">${e(params.totalStock)}</text>
  <text x="650" y="205" fill="#8b8e9b" font-size="16" font-family="Inter, sans-serif" font-weight="600" text-anchor="middle" letter-spacing="1">em estoque</text>

  <!-- Pill button under circle -->
  <rect x="550" y="280" width="200" height="40" rx="20" fill="#13141d" stroke="#2a2d3d" stroke-width="1.5" />
  <path d="M575 292 L568 300 L572 300 L570 308 L578 298 L574 298 Z" fill="${theme}" />
  <text x="590" y="306" fill="#ffffff" font-size="16" font-family="Inter, sans-serif" font-weight="700">+${e(params.addedCount)} unidades</text>

</svg>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, addedCount, totalStock, dateTime, themeColor } = await req.json();

    if (!productName || !addedCount || !dateTime) {
      throw new Error("Missing required fields");
    }

    await ensureInitialized();

    const svg = generateRestockSvg({
      productName,
      addedCount: String(addedCount),
      totalStock: totalStock ? String(totalStock) : "?",
      dateTime,
      themeColor,
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 800 },
      font: {
        fontBuffers: [fontRegular!, fontBold!, fontBlack!],
        defaultFontFamily: "Inter",
      },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error: any) {
    console.error("Error generating restock image:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
