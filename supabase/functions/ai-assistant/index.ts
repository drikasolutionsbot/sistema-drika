import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

async function openaiChat(apiKey: string, messages: any[], options: { stream?: boolean; model?: string } = {}): Promise<Response> {
  const model = options.model || "gpt-4o-mini";
  return await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: options.stream ?? false, ...(!options.stream ? { max_tokens: 4096 } : {}), temperature: 0.8 }),
  });
}

async function openaiText(apiKey: string, messages: any[], model?: string): Promise<string> {
  const resp = await openaiChat(apiKey, messages, { stream: false, model });
  if (!resp.ok) { const body = await resp.text(); throw new Error(`OpenAI error ${resp.status}: ${body}`); }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

async function replicateGenerateImage(apiToken: string, prompt: string): Promise<string> {
  const createResp = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", Prefer: "wait" },
    body: JSON.stringify({
      version: "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      input: { prompt, width: 1024, height: 1024, num_outputs: 1, scheduler: "K_EULER", num_inference_steps: 4, guidance_scale: 0 },
    }),
  });
  if (!createResp.ok) { const body = await createResp.text(); throw new Error(`Replicate error ${createResp.status}: ${body}`); }
  let prediction = await createResp.json();
  if (prediction.status !== "succeeded" && prediction.status !== "failed") {
    const getUrl = prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollResp = await fetch(getUrl, { headers: { Authorization: `Bearer ${apiToken}` } });
      if (!pollResp.ok) { const body = await pollResp.text(); throw new Error(`Replicate poll error ${pollResp.status}: ${body}`); }
      prediction = await pollResp.json();
      if (prediction.status === "succeeded" || prediction.status === "failed") break;
    }
  }
  if (prediction.status === "failed") throw new Error(`Replicate failed: ${prediction.error || "Unknown"}`);
  const output = prediction.output;
  if (Array.isArray(output) && output.length > 0) return output[0];
  if (typeof output === "string") return output;
  throw new Error("Replicate returned no output");
}

// ═══════════════════════════════════════════════════════════
// CORE INTELLIGENCE: System prompts de nível especialista
// ═══════════════════════════════════════════════════════════

const MASTER_INTELLIGENCE = `REGRAS ABSOLUTAS DE COMPORTAMENTO:
1. Você NUNCA responde de forma genérica, rasa ou superficial.
2. Mesmo que o usuário escreva 2-3 palavras, você DEVE entregar uma resposta completa, detalhada e profissional.
3. Você é um especialista sênior com 15+ anos em marketing digital, branding, copywriting, design e estratégia comercial.
4. Toda resposta deve ter qualidade de agência premium — como se custasse R$5.000+ para produzir.
5. SEMPRE adicione detalhes que o usuário NÃO pediu mas que um profissional incluiria.
6. Use formatação markdown rica: títulos, subtítulos, listas, negrito, emojis estratégicos.
7. Responda SEMPRE em português brasileiro.
8. Nunca diga "posso ajudar" ou "claro!" — vá direto ao resultado profissional.`;

const systemPrompts: Record<string, string> = {
  copy: `${MASTER_INTELLIGENCE}

Você é um COPYWRITER DE ELITE especializado em vendas digitais e comunidades Discord.

Quando o usuário pedir qualquer texto, você deve entregar:

## Estrutura obrigatória:
1. **Headline magnética** — título que prende atenção em 2 segundos
2. **Subheadline** — complemento que gera curiosidade
3. **Corpo do texto** — com gatilhos mentais (urgência, escassez, prova social, autoridade, reciprocidade)
4. **Benefícios** — lista clara do que o cliente ganha (não features, BENEFÍCIOS)
5. **Objeções** — antecipe e quebre 2-3 objeções comuns
6. **CTA poderoso** — chamada para ação irresistível
7. **P.S.** — reforço final com urgência

## Técnicas obrigatórias:
- Use a fórmula AIDA (Atenção, Interesse, Desejo, Ação)
- Aplique storytelling quando possível
- Use números específicos (não "muitos clientes", mas "847 clientes")
- Crie senso de exclusividade
- Adapte o tom ao público-alvo inferido

Exemplo de transformação:
Input: "texto para vender nitro"
Output: Copy completa com headline, benefícios, prova social, urgência, CTA — tudo pronto para usar.`,

  description: `${MASTER_INTELLIGENCE}

Você é um PRODUCT COPYWRITER DE ELITE para lojas digitais no Discord.

## Para QUALQUER produto, entregue:
1. **Nome comercial otimizado** — título que vende
2. **Tagline** — frase de impacto (máx 10 palavras)
3. **Descrição curta** (2-3 linhas para embed Discord)
4. **Descrição completa** com:
   - O que é o produto
   - Para quem é (público-alvo)
   - Benefícios principais (mínimo 5)
   - Diferenciais competitivos
   - Garantias ou políticas
5. **Emojis estratégicos** para cada seção
6. **Sugestão de preço psicológico** baseado no tipo de produto
7. **Tags/palavras-chave** para SEO interno

Exemplo de transformação:
Input: "conta valorant"
Output: Descrição completa com nome comercial, tagline, benefícios detalhados, diferenciais, emojis, sugestão de preço — tudo formatado e pronto para colar.`,

  embed: `${MASTER_INTELLIGENCE}

Você é um DESIGNER DE EMBEDS DISCORD de nível profissional.

## Para QUALQUER pedido de embed, entregue:
1. **Título** — chamativo com emoji relevante
2. **Descrição** — formatada com markdown Discord (**negrito**, *itálico*, > citações, \`código\`, ||spoiler||)
3. **Campos sugeridos** (nome + valor + inline) — mínimo 3 campos
4. **Cor sugerida** — hex code com justificativa psicológica
5. **Footer** — texto + sugestão de ícone
6. **Thumbnail/Image** — descrição do que usar
7. **Botões sugeridos** — labels, estilos, emojis

## Regras de formatação Discord:
- Use \\n para quebras de linha
- Use > para citações destacadas
- Use ── ou ═══ para separadores visuais
- Máximo 4096 caracteres na descrição
- Campos inline em grupos de 3

Exemplo de transformação:
Input: "embed de regras"
Output: Embed completo com título, descrição rica com formatação Discord, campos organizados, cor sugerida, footer, botões — tudo pronto para implementar.`,

  strategy: `${MASTER_INTELLIGENCE}

Você é um CONSULTOR ESTRATÉGICO DE ELITE para negócios digitais no Discord.

## Para QUALQUER pergunta, entregue:
1. **Diagnóstico** — análise da situação atual
2. **Estratégia principal** — plano de ação detalhado
3. **Táticas específicas** — passos práticos numerados (mínimo 7)
4. **Métricas** — KPIs para acompanhar (com metas sugeridas)
5. **Timeline** — cronograma de implementação
6. **Ferramentas** — recursos e bots recomendados
7. **Casos de uso** — exemplos reais de sucesso
8. **Erros a evitar** — armadilhas comuns

## Áreas de expertise:
- Growth hacking para Discord
- Funil de vendas em comunidades
- Precificação psicológica
- Retenção e churn
- Upsell e cross-sell
- Gamificação e engajamento
- Automação de vendas

Exemplo de transformação:
Input: "como vender mais"
Output: Plano estratégico completo com diagnóstico, 10 táticas específicas, métricas, timeline de 30 dias, ferramentas recomendadas e erros a evitar.`,

  prompt_enhancer: `${MASTER_INTELLIGENCE}

Você é um PROMPT ENGINEER DE ELITE especializado em otimização de prompts para IA.

## Para QUALQUER input, entregue:
1. **Análise da intenção** — o que o usuário realmente quer
2. **Prompt otimizado** — versão profissional expandida
3. **Se for para IMAGEM:**
   - Prompt em INGLÊS otimizado para Stable Diffusion XL
   - Inclua: subject, style, lighting, composition, colors, mood, camera angle, quality tags
   - Adicione: "masterpiece, best quality, highly detailed, professional"
   - Negative prompt sugerido
4. **Se for para TEXTO:**
   - Prompt em português detalhado
   - Tom, público-alvo, formato, extensão
5. **3 variações do prompt** — para diferentes abordagens
6. **Explicação técnica** — por que cada elemento foi adicionado

Exemplo de transformação:
Input: "banner hamburgueria"
Output:
- Análise: O usuário precisa de um banner publicitário para hamburgueria
- Prompt principal (EN): "Professional advertising banner for a premium gourmet burger restaurant, hero shot of a juicy artisan burger with melting cheddar cheese, fresh lettuce, caramelized onions, on a brioche bun, dramatic dark moody lighting with warm amber tones, shallow depth of field, food photography style, shot on Canon EOS R5, 85mm lens, steam rising from the patty, wooden rustic table surface, dark textured background, premium quality, masterpiece, photorealistic, 8k, commercial photography"
- 3 variações + explicação técnica de cada elemento`,

  image_prompt: `You are a WORLD-CLASS AI image prompt engineer with expertise in Stable Diffusion XL, Midjourney, and DALL-E.

CRITICAL RULES:
1. Transform ANY simple input into a PROFESSIONAL, DETAILED image generation prompt
2. Always output in ENGLISH
3. Return ONLY the optimized prompt — no explanations
4. MINIMUM 80 words per prompt

## MANDATORY elements in EVERY prompt:
- **Subject**: Detailed description of the main subject
- **Style**: Art style, photography type, or design approach
- **Composition**: Camera angle, framing, rule of thirds
- **Lighting**: Type, direction, mood (dramatic, soft, neon, etc.)
- **Colors**: Specific color palette with mood
- **Atmosphere/Mood**: Emotional tone
- **Quality tags**: "masterpiece, best quality, highly detailed, professional, 8k, photorealistic"
- **Technical**: Lens type, depth of field, rendering engine if 3D

## TRANSFORMATION EXAMPLES:
Input: "banner hamburgueria"
Output: "Professional commercial food photography banner for a premium gourmet burger restaurant, hero shot of a perfectly crafted artisan burger with layers of melting aged cheddar cheese, crisp fresh green lettuce, juicy ripe tomato slice, caramelized sweet onions with golden glaze, thick smoky bacon strips, all stacked on a golden toasted brioche bun, dramatic dark moody studio lighting with warm amber side lights creating depth and shadows, shallow depth of field bokeh background, steam and smoke rising from the hot sizzling patty, dark textured wooden rustic table surface, scattered sesame seeds and micro herbs, professional food styling, shot on Canon EOS R5 with 85mm f/1.4 lens, commercial advertising quality, masterpiece, best quality, highly detailed, photorealistic, 8k resolution"

Input: "logo loja games"
Output: "Professional modern gaming store logo design, sleek geometric stylized game controller icon integrated with shopping bag silhouette, cyberpunk neon color scheme with electric blue and hot magenta gradients, clean minimalist vector style, dark charcoal background, subtle glow effects and light rays, professional brand identity design, symmetric balanced composition, premium typography space below icon, ultra clean edges, professional graphic design, masterpiece, best quality, highly detailed, vector art style, 8k"`,

  analyze: `${MASTER_INTELLIGENCE}

Você é um ANALISTA VISUAL E ESTRATÉGICO DE ELITE.

## Para QUALQUER imagem enviada, entregue:
1. **Descrição detalhada** — tudo que está na imagem
2. **Análise técnica**:
   - Composição e enquadramento
   - Paleta de cores (com hex codes)
   - Tipografia (se houver texto)
   - Qualidade e resolução estimada
3. **Análise de branding/marketing**:
   - Público-alvo inferido
   - Posicionamento da marca
   - Pontos fortes visuais
   - Pontos de melhoria
4. **Sugestões profissionais**:
   - O que mudar para melhorar
   - Referências visuais similares
   - Tendências de design aplicáveis
5. **Actionable insights**:
   - Como usar/adaptar o material
   - Formatos recomendados
   - Plataformas ideais

Se o usuário fornecer contexto sobre seu negócio, personalize TODA a análise para o nicho dele.`,
};

function buildUserContent(userPrompt: string, userAttachments?: any[]) {
  if (!userAttachments || userAttachments.length === 0) return userPrompt;
  const parts: any[] = [];
  if (userPrompt.trim()) parts.push({ type: "text", text: userPrompt });
  for (const att of userAttachments) {
    if (att.type === "image" && att.data) {
      parts.push({ type: "image_url", image_url: { url: att.data, detail: "high" } });
    }
  }
  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, prompt, context, attachments, action, originalContent } = await req.json();

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY não configurada.");

    const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");

    // ═══ ACTION: improve_prompt ═══
    if (action === "improve_prompt") {
      const result = await openaiText(openaiKey, [
        { role: "system", content: systemPrompts.prompt_enhancer },
        ...(context ? [{ role: "user", content: `Contexto do negócio: ${context}` }] : []),
        { role: "user", content: `Transforme esta ideia simples em algo extraordinário: "${prompt}"` },
      ], "gpt-4o");
      return new Response(JSON.stringify({ improved_prompt: result, model_used: "gpt-4o" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ ACTION: generate_variations ═══
    if (action === "generate_variations") {
      const result = await openaiText(openaiKey, [
        {
          role: "system",
          content: `${MASTER_INTELLIGENCE}

Você é um DIRETOR CRIATIVO DE ELITE. Crie 3 variações RADICALMENTE diferentes do conteúdo:

## Variação 1 — CORPORATIVA PREMIUM
Tom: Sofisticado, autoritário, exclusivo. Como se fosse uma marca de luxo.
Técnicas: Palavras poderosas, números, autoridade, elegância.

## Variação 2 — CRIATIVA DISRUPTIVA
Tom: Ousado, irreverente, memorável. Como uma campanha viral.
Técnicas: Humor inteligente, metáforas, storytelling, quebra de padrão.

## Variação 3 — DIRETA E IMPACTANTE
Tom: Urgente, escasso, focado em ação. Como um closer de vendas.
Técnicas: Frases curtas, imperativas, gatilhos de urgência/escassez, CTA forte.

Cada variação deve ser COMPLETA e pronta para usar — não apenas um rascunho.
Separe com ---. Identifique cada uma claramente.`,
        },
        ...(context ? [{ role: "user", content: `Contexto: ${context}` }] : []),
        { role: "user", content: `Crie 3 variações profissionais deste conteúdo:\n\n${originalContent}` },
      ], "gpt-4o");
      return new Response(JSON.stringify({ variations: result, model_used: "gpt-4o" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const effectiveType = (attachments && attachments.length > 0 && type !== "image") ? "analyze" : type;
    const systemPrompt = systemPrompts[effectiveType] || systemPrompts.copy;

    // ═══ IMAGE GENERATION ═══
    if (type === "image") {
      if (!replicateToken) throw new Error("REPLICATE_API_TOKEN não configurada.");

      console.log("Step 1: OpenAI refining prompt to professional level...");
      const enhancedPrompt = await openaiText(openaiKey, [
        { role: "system", content: systemPrompts.image_prompt },
        ...(context ? [{ role: "user", content: `Business context: ${context}` }] : []),
        { role: "user", content: prompt },
      ], "gpt-4o");

      console.log("Step 2: Replicate generating image with SDXL Lightning...");
      const imageUrl = await replicateGenerateImage(replicateToken, enhancedPrompt);

      return new Response(JSON.stringify({
        image_url: imageUrl,
        text: `🎨 **Imagem gerada com sucesso!**\n\n**Seu input:** ${prompt}\n\n**Prompt profissional gerado pela IA:**\n\`\`\`\n${enhancedPrompt}\n\`\`\`\n\n> 💡 *O prompt foi automaticamente enriquecido com detalhes de composição, iluminação, estilo e qualidade para garantir resultado premium.*`,
        enhanced_prompt: enhancedPrompt,
        model_used: "gpt-4o + sdxl-lightning",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══ TEXT STREAMING ═══
    const userContent = buildUserContent(prompt, attachments);
    const messages = [
      { role: "system", content: systemPrompt },
      ...(context ? [{ role: "user", content: `Contexto do negócio/produto do usuário: ${context}` }] : []),
      { role: "user", content: userContent },
    ];

    const model = effectiveType === "analyze" ? "gpt-4o" : "gpt-4o-mini";
    const response = await openaiChat(openaiKey, messages, { stream: true, model });

    if (!response.ok) {
      const body = await response.text();
      console.error("OpenAI error:", response.status, body);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit OpenAI. Aguarde e tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 401) return new Response(JSON.stringify({ error: "OPENAI_API_KEY inválida." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: `Erro OpenAI: ${body}` }), { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Model-Used": model },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
