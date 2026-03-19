import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lovable AI Gateway models
const TEXT_MODELS = [
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "google/gemini-3-flash-preview",
  "openai/gpt-5-nano",
  "openai/gpt-5-mini",
  "google/gemini-2.5-pro",
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5",
];

const IMAGE_MODELS = [
  "google/gemini-2.5-flash-image",
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
];


// Google AI Studio models
const GOOGLE_AI_TEXT_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
];

const GOOGLE_AI_IMAGE_MODELS = [
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash",
];

async function tryModels(
  models: string[],
  buildBody: (model: string) => object,
  apiKey: string,
  apiUrl: string,
  authHeader: string,
): Promise<{ response: Response; model: string }> {
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    console.log(`Trying model: ${model} (attempt ${i + 1}/${models.length})`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `${authHeader} ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildBody(model)),
    });

    if (response.status === 429 || response.status === 402) {
      console.warn(`Model ${model} returned ${response.status}, trying next...`);
      await response.text();
      if (i === models.length - 1) {
        return {
          response: new Response(
            JSON.stringify({
              error: response.status === 402
                ? "Créditos insuficientes em todos os modelos. Adicione créditos ao workspace."
                : "Limite de requisições excedido em todos os modelos. Tente novamente em alguns minutos.",
            }),
            { status: response.status, headers: { "Content-Type": "application/json" } },
          ),
          model,
        };
      }
      continue;
    }

    return { response, model };
  }

  throw new Error("No models available");
}

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GOOGLE_AI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, prompt, context, provider } = await req.json();
    
    // Determine provider: "google" or "drika" (default)
    const selectedProvider = provider || "drika";
    
    let apiKey: string;
    let apiUrl: string;
    let authHeader: string;
    
    if (selectedProvider === "groq") {
      // Rotate between multiple Groq API keys for higher rate limits
      const groqKeys = [
        Deno.env.get("GROQ_API_KEY"),
        Deno.env.get("GROQ_API_KEY_2"),
        Deno.env.get("GROQ_API_KEY_3"),
        Deno.env.get("GROQ_API_KEY_4"),
      ].filter((k): k is string => !!k && k.length > 0);

      if (groqKeys.length === 0) throw new Error("Nenhuma GROQ_API_KEY configurada. Adicione nas configurações do Supabase.");

      apiKey = groqKeys[Math.floor(Date.now() / 1000) % groqKeys.length];
      console.log(`Using Groq key pool: ${groqKeys.length} keys available`);
      apiUrl = GROQ_API_URL;
      authHeader = "Bearer";
    } else if (selectedProvider === "inference") {
      apiKey = Deno.env.get("INFERENCE_NET_API_KEY") || "";
      if (!apiKey) throw new Error("INFERENCE_NET_API_KEY não está configurada.");
      apiUrl = INFERENCE_API_URL;
      authHeader = "Bearer";
    } else if (selectedProvider === "huggingface") {
      apiKey = Deno.env.get("HUGGINGFACE_API_KEY") || "";
      if (!apiKey) throw new Error("HUGGINGFACE_API_KEY não está configurada.");
      apiUrl = HF_API_URL;
      authHeader = "Bearer";
    } else if (selectedProvider === "google") {
      const googleKeys = [
        Deno.env.get("GOOGLE_AI_API_KEY"),
        Deno.env.get("GOOGLE_AI_API_KEY_2"),
      ].filter((k): k is string => !!k && k.length > 0);

      if (googleKeys.length === 0) throw new Error("Nenhuma GOOGLE_AI_API_KEY configurada.");

      apiKey = googleKeys[Math.floor(Date.now() / 1000) % googleKeys.length];
      console.log(`Using Google AI key pool: ${googleKeys.length} keys available`);
      apiUrl = GOOGLE_AI_URL;
      authHeader = "Bearer";
    } else {
      apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
      if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
      apiUrl = LOVABLE_API_URL;
      authHeader = "Bearer";
    }

    const systemPrompts: Record<string, string> = {
      copy: `Você é um copywriter profissional especializado em vendas online e Discord. 
Crie textos persuasivos, chamativos e que convertem. Use gatilhos mentais como urgência, escassez, prova social e autoridade.
Sempre responda em português brasileiro. Formate com markdown quando útil.
Se o usuário fornecer contexto sobre o produto/serviço, use-o para personalizar a copy.`,

      description: `Você é um especialista em criar descrições de produtos para lojas online no Discord.
Crie descrições atraentes, claras e que destaquem benefícios. Use emojis de forma estratégica.
Sempre responda em português brasileiro. Formate com markdown.
Estruture a descrição com: título chamativo, benefícios principais, detalhes do produto e call-to-action.`,

      embed: `Você é um designer de embeds do Discord. Crie textos formatados para embeds Discord.
Use formatação Discord: **negrito**, *itálico*, > citações, \`código\`.
Sempre responda em português brasileiro.
Retorne o conteúdo organizado em seções: título, descrição e campos sugeridos.`,

      strategy: `Você é um consultor de vendas e marketing digital especializado em comunidades Discord.
Dê conselhos práticos e estratégias para aumentar vendas, engajamento e retenção de membros.
Sempre responda em português brasileiro. Use exemplos reais e dicas acionáveis.`,

      image_prompt: `Você é um especialista em criar prompts para geração de imagens com IA.
O usuário vai descrever o que precisa (banner, logo, thumbnail, etc.) e você deve criar um prompt detalhado em INGLÊS para gerar a imagem.
Retorne APENAS o prompt em inglês, sem explicações adicionais. O prompt deve ser detalhado, descritivo e otimizado para modelos de geração de imagem.
Inclua estilo, cores, composição, iluminação e mood.`,
    };

    const systemPrompt = systemPrompts[type] || systemPrompts.copy;

    // Image generation — supported on Drika engine and Google AI Studio
    if (type === "image") {
      if (selectedProvider !== "drika" && selectedProvider !== "google") {
        return new Response(
          JSON.stringify({ error: "Geração de imagens só é suportada pelo Drika Engine e Google AI Studio." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const imageModels = selectedProvider === "google" ? GOOGLE_AI_IMAGE_MODELS : IMAGE_MODELS;
      const imageApiUrl = selectedProvider === "google" ? GOOGLE_AI_URL : apiUrl;
      const imageApiKey = apiKey;

      const buildImageBody = selectedProvider === "google"
        ? (m: string) => ({
            model: m,
            messages: [{ role: "user", content: prompt }],
            modalities: ["text", "image"],
          })
        : (m: string) => ({
            model: m,
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          });

      const { response, model } = await tryModels(
        imageModels,
        buildImageBody,
        imageApiKey,
        imageApiUrl,
        authHeader,
      );

      if (!response.ok) {
        const body = await response.text();
        return new Response(body, {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      const text = data.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ image_url: imageUrl, text, model_used: model }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Text generation with streaming + fallback
    const messages = [
      { role: "system", content: systemPrompt },
      ...(context ? [{ role: "user", content: `Contexto: ${context}` }] : []),
      { role: "user", content: prompt },
    ];

    const textModels = selectedProvider === "groq" ? GROQ_TEXT_MODELS : selectedProvider === "inference" ? INFERENCE_TEXT_MODELS : selectedProvider === "huggingface" ? HF_TEXT_MODELS : selectedProvider === "google" ? GOOGLE_AI_TEXT_MODELS : TEXT_MODELS;

    const { response, model } = await tryModels(
      textModels,
      (m) => ({ model: m, messages, stream: true }),
      apiKey,
      apiUrl,
      authHeader,
    );

    if (!response.ok) {
      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Streaming response from model: ${model} (provider: ${selectedProvider})`);
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Model-Used": model,
        "X-Provider": selectedProvider,
      },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
