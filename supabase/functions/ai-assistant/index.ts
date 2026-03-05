import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, prompt, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    // For image generation, we use the image model
    if (type === "image") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            { role: "user", content: prompt },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const t = await response.text();
        console.error("AI gateway image error:", status, t);
        throw new Error("Erro ao gerar imagem");
      }

      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      const text = data.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ image_url: imageUrl, text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Text generation with streaming
    const messages = [
      { role: "system", content: systemPrompt },
      ...(context ? [{ role: "user", content: `Contexto: ${context}` }] : []),
      { role: "user", content: prompt },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error("Erro na IA");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
