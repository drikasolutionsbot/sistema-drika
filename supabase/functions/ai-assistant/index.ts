import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lovable AI Gateway models — ordered from best to cheapest
const TEXT_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "google/gemini-2.5-flash-lite",
];

const IMAGE_MODELS = [
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
  "google/gemini-2.5-flash-image",
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, prompt, context, attachments } = await req.json();
    
    const apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
    const apiUrl = LOVABLE_API_URL;
    const authHeader = "Bearer";

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

      analyze: `Você é um assistente de IA avançado e analista visual. Quando o usuário envia uma imagem ou documento, analise detalhadamente o conteúdo.
Para imagens: descreva o que vê, identifique elementos, cores, textos, logos, pessoas, objetos.
Para documentos/textos: resuma, extraia informações-chave, organize os dados.
Sempre responda em português brasileiro de forma clara e estruturada com markdown.
Se o usuário fornecer contexto adicional sobre seu negócio/produto, use-o para personalizar e enriquecer sua análise.
Se o usuário fizer uma pergunta sobre o conteúdo, responda de forma precisa e completa.`,
    };

    // Build user message content (multimodal if attachments present)
    const buildUserContent = (userPrompt: string, userAttachments?: any[]) => {
      if (!userAttachments || userAttachments.length === 0) {
        return userPrompt;
      }
      
      const parts: any[] = [];
      
      // Add text prompt
      if (userPrompt.trim()) {
        parts.push({ type: "text", text: userPrompt });
      }
      
      // Add image attachments
      for (const att of userAttachments) {
        if (att.type === "image" && att.data) {
          parts.push({
            type: "image_url",
            image_url: { url: att.data },
          });
        }
      }
      
      return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
    };

    // Determine type — if attachments present and no explicit type, use "analyze"
    const effectiveType = (attachments && attachments.length > 0 && type !== "image") ? "analyze" : type;
    const systemPrompt = systemPrompts[effectiveType] || systemPrompts.copy;

    // Image generation
    if (type === "image") {
      const { response, model } = await tryModels(
        IMAGE_MODELS,
        (m) => ({
          model: m,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
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

      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      const text = data.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ image_url: imageUrl, text, model_used: model }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Text generation with streaming + fallback
    const userContent = buildUserContent(prompt, attachments);
    
    const messages = [
      { role: "system", content: systemPrompt },
      ...(context ? [{ role: "user", content: `Contexto: ${context}` }] : []),
      { role: "user", content: userContent },
    ];

    const { response, model } = await tryModels(
      TEXT_MODELS,
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

    console.log(`Streaming response from model: ${model}`);
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Model-Used": model,
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
