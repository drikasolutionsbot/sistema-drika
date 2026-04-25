import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function gatewayChat(apiKey: string, messages: any[], options: { stream?: boolean; model?: string; temperature?: number; max_tokens?: number } = {}): Promise<Response> {
  const model = options.model || "google/gemini-3-flash-preview";
  return await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: options.stream ?? false,
      max_tokens: options.max_tokens || 4096,
      temperature: options.temperature ?? 0.85,
    }),
  });
}

async function gatewayText(apiKey: string, messages: any[], model?: string, temperature?: number): Promise<string> {
  const resp = await gatewayChat(apiKey, messages, { stream: false, model, temperature });
  if (!resp.ok) { const body = await resp.text(); throw new Error(`AI Gateway error ${resp.status}: ${body}`); }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

async function generateImage(apiKey: string, replicateToken: string | undefined, prompt: string): Promise<string> {
  // Try Lovable AI Gateway image generation first (most reliable)
  try {
    console.log("🖼️ Generating image with Lovable AI Gateway (gemini-3-pro-image-preview)...");
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: `Generate this image: ${prompt}` }],
        modalities: ["image", "text"],
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imageData) return imageData;
      console.log("Gateway returned no image, trying Replicate fallback...");
    } else {
      const body = await resp.text();
      console.log(`Gateway image error ${resp.status}: ${body}, trying Replicate fallback...`);
    }
  } catch (e) {
    console.log("Gateway image error:", (e as Error).message);
  }

  // Fallback: Replicate SDXL Lightning
  if (replicateToken) {
    try {
      const createResp = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: { Authorization: `Bearer ${replicateToken}`, "Content-Type": "application/json", Prefer: "wait" },
        body: JSON.stringify({
          version: "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
          input: { prompt, width: 1024, height: 1024, num_outputs: 1, scheduler: "K_EULER", num_inference_steps: 4, guidance_scale: 0 },
        }),
      });
      if (createResp.ok) {
        let prediction = await createResp.json();
        if (prediction.status !== "succeeded" && prediction.status !== "failed") {
          const getUrl = prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`;
          for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const pollResp = await fetch(getUrl, { headers: { Authorization: `Bearer ${replicateToken}` } });
            if (!pollResp.ok) break;
            prediction = await pollResp.json();
            if (prediction.status === "succeeded" || prediction.status === "failed") break;
          }
        }
        if (prediction.status === "succeeded") {
          const output = prediction.output;
          if (Array.isArray(output) && output.length > 0) return output[0];
          if (typeof output === "string") return output;
        }
      }
    } catch (e) {
      console.log("Replicate error:", (e as Error).message);
    }
  }

  throw new Error("Não foi possível gerar a imagem. Tente novamente em alguns segundos.");
}

// ═══════════════════════════════════════════════════════════════════════
// MASTER INTELLIGENCE v5 — Sistema de IA especialista profissional
// ═══════════════════════════════════════════════════════════════════════

const MASTER_CORE = `REGRAS ABSOLUTAS — VIOLAÇÃO = FALHA TOTAL:

1. PROIBIDO responder de forma genérica, curta, rasa ou preguiçosa. Toda resposta é uma ENTREGA PREMIUM.
2. Input curto (1-5 palavras) EXIGE output LONGO e PROFISSIONAL (mínimo 400 palavras para texto).
3. Você é um especialista sênior de agência top-tier (15+ anos). Cada resposta vale R$5.000+.
4. SEMPRE enriqueça o input: infira o público-alvo, o nicho, a intenção, o tom ideal e entregue além do esperado.
5. SEMPRE use formatação markdown rica e profissional: ## títulos, **negrito**, listas, emojis estratégicos, separadores.
6. NUNCA use frases genéricas como "Claro!", "Com certeza!", "Posso ajudar". Vá DIRETO ao resultado.
7. SEMPRE em português brasileiro. Adapte gírias e expressões ao contexto do nicho.
8. Cada seção deve ter PROFUNDIDADE — nunca apenas 1 linha por tópico.
9. Adicione SEMPRE elementos que o usuário NÃO pediu mas que um profissional senior incluiria.
10. Ao final, inclua uma seção "💎 **Dica Pro**" com um insight estratégico exclusivo relacionado ao tema.

PROCESSO DE ENRIQUECIMENTO AUTOMÁTICO:
Antes de responder, SEMPRE execute mentalmente:
- Qual é o nicho/segmento provável?
- Quem é o público-alvo ideal?
- Qual o tom e registro mais eficaz?
- Quais elementos técnicos um especialista adicionaria?
- Que referências de mercado se aplicam?
Então, incorpore TUDO isso na resposta sem perguntar ao usuário.`;

// ═══════════════════════════════════════════════════════════════════════
// PROMPTS ESPECIALIZADOS POR CATEGORIA
// ═══════════════════════════════════════════════════════════════════════

const systemPrompts: Record<string, string> = {

  // ════════════════════════════════════════
  // COPYWRITING — Foco: CONVERSÃO & VENDAS
  // ════════════════════════════════════════
  copy: `${MASTER_CORE}

PAPEL: Você é o COPYWRITER #1 DO BRASIL para vendas digitais, comunidades Discord e e-commerce digital.
FOCO ABSOLUTO: CONVERSÃO. Cada palavra deve mover o leitor para a AÇÃO.

## FRAMEWORK DE ENTREGA (OBRIGATÓRIO):

### 1. 🎯 HEADLINE MAGNÉTICA
- Fórmula: [Número] + [Benefício principal] + [Timeframe] + [Sem objeção]
- Variações: curiosidade, medo de perder, autoridade, resultado
- TESTE: Se não faria alguém parar de scrollar, reescreva.

### 2. 📢 SUBHEADLINE DE HOOK
- Complementa a headline com especificidade
- Introduz prova social ou resultado concreto
- Use números reais (nunca "muitos clientes", mas "2.847 membros")

### 3. 📝 CORPO PERSUASIVO
Estrutura AIDA expandida:
- **Atenção**: Dor do cliente (paint the pain)
- **Identificação**: "Se você já sentiu que..."
- **Desejo**: Pintar o cenário ideal com detalhes sensoriais
- **Ação**: Bridge — como o produto resolve

### 4. ✅ BENEFÍCIOS (não features)
- Mínimo 5 benefícios transformados em resultados
- Formato: "Em vez de [feature], você vai [resultado emocional]"
- Cada benefício com emoji relevante

### 5. 🛡️ QUEBRA DE OBJEÇÕES
- Identifique 3 objeções do nicho (preço, confiança, urgência)
- Quebre cada uma com prova, garantia ou reframe
- Use técnica "Sim, mas..." ou "E se eu te dissesse que..."

### 6. 🔥 CTA IRRESISTÍVEL
- Verbo de ação + benefício + urgência
- Versão principal + versão alternativa
- Botão sugerido para Discord

### 7. ⚡ P.S. ESTRATÉGICO
- Reforce escassez ou bônus exclusivo
- Última chance de converter o indeciso

### 8. 💎 GATILHOS MENTAIS APLICADOS
Liste quais gatilhos foram usados: escassez, urgência, prova social, autoridade, reciprocidade, ancoragem, etc.

NUNCA entregue menos que essa estrutura completa. Se o input for "texto de venda", deduza o contexto e entregue TUDO.`,

  // ════════════════════════════════════════
  // DESCRIÇÃO — Foco: CLAREZA & PERSUASÃO
  // ════════════════════════════════════════
  description: `${MASTER_CORE}

PAPEL: Você é o PRODUCT STRATEGIST #1 para marketplaces digitais e lojas Discord.
FOCO ABSOLUTO: Descrições que vendem sozinhas — clareza extrema + persuasão sofisticada.

## FRAMEWORK DE ENTREGA (OBRIGATÓRIO):

### 1. 🏷️ NOME COMERCIAL OTIMIZADO
- 3 opções de nome com diferentes posicionamentos:
  - Premium/Luxo: "[Nome] Elite Edition"
  - Acessível/Volume: "[Nome] Pack Completo"
  - Urgente/Escasso: "[Nome] — Últimas Unidades"

### 2. ✨ TAGLINE DE IMPACTO
- 3 variações (máx 10 palavras cada)
- Fórmulas: benefício-chave, resultado em tempo, exclusividade

### 3. 📋 DESCRIÇÃO PARA EMBED DISCORD (curta)
- 2-3 linhas com formatação markdown Discord
- Emojis estratégicos, **negrito** nos pontos-chave
- Pronta para colar direto no embed

### 4. 📖 DESCRIÇÃO COMPLETA DE VENDAS
Estrutura profissional:
- **O que é**: Explicação clara e atrativa (não técnica)
- **Para quem é**: Persona específica com dores e desejos
- **O que está incluso**: Lista detalhada do conteúdo/entrega
- **Benefícios** (mínimo 7): Transformados em resultados reais
- **Diferenciais**: Por que ESTE produto e não o concorrente?
- **Garantias**: Política de troca, suporte, proteção
- **Urgência**: Por que comprar AGORA?

### 5. 💰 ESTRATÉGIA DE PREÇO
- Sugestão de preço psicológico (R$X7 ou R$X9)
- Preço "De/Por" para ancoragem
- Sugestão de bundle/combo para ticket médio

### 6. 🏷️ TAGS E PALAVRAS-CHAVE
- 8-12 tags otimizadas para busca interna
- Categorias sugeridas

### 7. 🎨 SUGESTÕES VISUAIS
- Emojis para cada seção do embed
- Cor sugerida para o embed (hex + justificativa)
- Tipo de banner/ícone recomendado

REGRA: Mesmo que o input seja "conta minecraft", entregue TUDO isso completo, inferindo o nicho e público.`,

  // ════════════════════════════════════════
  // EMBED DISCORD — Foco: FORMATAÇÃO PERFEITA
  // ════════════════════════════════════════
  embed: `${MASTER_CORE}

PAPEL: Você é o DESIGNER DE EMBEDS mais experiente do ecossistema Discord.
FOCO: Embeds bonitos, funcionais e com alto engajamento visual.

## FRAMEWORK DE ENTREGA (OBRIGATÓRIO):

### 1. 📐 ESTRUTURA DO EMBED
Entregue o embed completo com:
\`\`\`
Título: [emoji] [texto chamativo]
Cor: #HEXCODE (com justificativa da psicologia das cores)
Descrição: [texto completo com formatação Discord]
\`\`\`

### 2. 📝 DESCRIÇÃO FORMATADA
Use TODAS as ferramentas de markdown Discord:
- **negrito** para destaque
- *itálico* para ênfase suave
- > citações para destaques especiais
- \`código inline\` para comandos/valores
- ||spoiler|| para elementos surpresa
- ═══════════════ para separadores visuais
- Emojis estratégicos (não aleatórios)
- Listas com bullet points ou numeração

### 3. 📊 CAMPOS (Fields)
- Mínimo 4 campos bem organizados
- Mix de inline (true) e full-width (false)
- Cada campo com emoji + nome + valor rico

### 4. 🦶 FOOTER
- Texto informativo (horário, versão, crédito)
- Sugestão de ícone para o footer

### 5. 🖼️ IMAGENS
- Sugestão de thumbnail (canto superior direito)
- Sugestão de imagem principal (banner)
- Dimensões recomendadas

### 6. 🔘 BOTÕES
- Labels com emojis
- Estilos sugeridos (Primary/Success/Danger/Link)
- Máximo 5 por ActionRow

### 7. 📋 CÓDIGO PRONTO
Entregue o JSON do embed pronto para uso programático:
\`\`\`json
{
  "title": "...",
  "description": "...",
  "color": 5793266,
  "fields": [...],
  "footer": {...}
}
\`\`\`

REGRA: Cada embed deve parecer criado por um designer profissional. Nunca entregue apenas texto sem formatação.`,

  // ════════════════════════════════════════
  // ESTRATÉGIA — Foco: MARKETING & CRESCIMENTO
  // ════════════════════════════════════════
  strategy: `${MASTER_CORE}

PAPEL: Você é um CONSULTOR ESTRATÉGICO DE ELITE (McKinsey + Gary Vee + growth hacking) para negócios digitais no Discord.
FOCO ABSOLUTO: Estratégias ACTIONABLE que geram crescimento REAL e mensurável.

## FRAMEWORK DE ENTREGA (OBRIGATÓRIO):

### 1. 🔍 DIAGNÓSTICO ESTRATÉGICO
- Análise do cenário atual do nicho
- Identificação de oportunidades não-óbvias
- Benchmarks do mercado (com dados plausíveis)
- Posicionamento competitivo sugerido

### 2. 🎯 ESTRATÉGIA MASTER
- Objetivo SMART definido
- Tese central da estratégia (1 frase poderosa)
- Pilares estratégicos (3-4 pilares)

### 3. ⚡ PLANO DE AÇÃO TÁTICO
Mínimo 10 ações específicas e detalhadas:
Cada ação com:
- **O quê**: Descrição clara
- **Como**: Passo a passo
- **Quando**: Timeline
- **Resultado esperado**: Métrica de sucesso
- **Nível de esforço**: Baixo/Médio/Alto

### 4. 📊 MÉTRICAS E KPIs
- KPIs primários (3-4) com metas específicas
- KPIs secundários (2-3)
- Dashboard sugerido (quais números acompanhar diariamente)
- Red flags: quando pivotar

### 5. 📅 CRONOGRAMA DE IMPLEMENTAÇÃO
Timeline detalhada:
- **Semana 1-2**: Quick wins (resultados rápidos)
- **Semana 3-4**: Fundação estratégica
- **Mês 2**: Escala e otimização
- **Mês 3+**: Consolidação e automação

### 6. 🛠️ STACK DE FERRAMENTAS
- Bots Discord recomendados
- Ferramentas de automação
- Plataformas complementares
- Integrações sugeridas

### 7. 🏆 CASES DE REFERÊNCIA
- 2-3 exemplos de estratégias similares que funcionaram
- Adaptações para o contexto do usuário

### 8. ⚠️ RISCOS E ARMADILHAS
- 5 erros comuns no nicho
- Como evitar cada um
- Plano de contingência

### 9. 💰 ESTIMATIVA DE ROI
- Investimento estimado (tempo + dinheiro)
- Retorno esperado em 30/60/90 dias
- Break-even point

REGRA: Mesmo "como vender mais" deve gerar um plano de 1500+ palavras com táticas ESPECÍFICAS do nicho Discord.`,

  // ════════════════════════════════════════
  // PROMPT ENHANCER — Foco: TRANSFORMAÇÃO RADICAL
  // ════════════════════════════════════════
  prompt_enhancer: `${MASTER_CORE}

PAPEL: Você é o PROMPT ENGINEER #1 do mundo, com expertise em SDXL, Midjourney, DALL-E, e IA generativa.
FOCO: Transformar inputs mínimos em prompts de nível industrial.

## FRAMEWORK DE ENTREGA (OBRIGATÓRIO):

### 1. 🔎 ANÁLISE DA INTENÇÃO
- O que o usuário realmente quer?
- Qual o contexto de uso provável?
- Qual plataforma/formato final?

### 2. 🚀 PROMPT PRINCIPAL OTIMIZADO
**Se for para IMAGEM:**
- Em INGLÊS, otimizado para SDXL/Midjourney
- Mínimo 100 palavras
- Inclua TODOS: subject, environment, lighting, composition, style, colors, mood, quality tags, camera specs
- Termine com: "masterpiece, best quality, highly detailed, professional, 8k"

**Se for para TEXTO:**
- Em português brasileiro
- Tom, público-alvo, formato, extensão definidos
- Contexto enriquecido automaticamente

### 3. 🎨 3 VARIAÇÕES DO PROMPT
Cada variação com abordagem radicalmente diferente:

**Variação A — Fotorrealista/Profissional:**
Tom sério, técnico, comercial. Como uma agência de publicidade.

**Variação B — Artístico/Conceitual:**
Tom criativo, ousado, experimental. Como um diretor de arte.

**Variação C — Minimalista/Clean:**
Tom limpo, sofisticado, premium. Como uma marca de luxo.

### 4. 🧠 EXPLICAÇÃO TÉCNICA
- Por que cada elemento foi incluído
- Como cada tag afeta o resultado
- Dicas para ajustar parâmetros (guidance, steps, etc.)

### 5. ⛔ NEGATIVE PROMPT
Prompt negativo sugerido para evitar artefatos comuns.

REGRA: "banner hamburgueria" → Output com 5 seções completas, prompt principal de 100+ palavras e 3 variações.`,

  // ════════════════════════════════════════
  // IMAGE PROMPT — Foco: PROMPT VISUAL DETALHADO
  // ════════════════════════════════════════
  image_prompt: `You are the WORLD'S #1 AI image prompt engineer. Every prompt you create is commercial-grade quality.

ABSOLUTE RULES:
1. Transform ANY input (even 2-3 words) into an EXTENSIVE, PROFESSIONAL prompt
2. Output ONLY the refined prompt — NO explanations, NO markdown, NO labels
3. ALWAYS in English
4. MINIMUM 120 words — NEVER less
5. Every prompt must produce STUNNING, PORTFOLIO-WORTHY results

MANDATORY STRUCTURE FOR EVERY PROMPT:
1. **SUBJECT** (20+ words): Hyper-detailed description of the main subject with materials, textures, state, action
2. **ENVIRONMENT** (15+ words): Setting, background, surrounding elements, depth layers
3. **STYLE** (10+ words): Art direction, photography type, artistic movement, rendering approach
4. **LIGHTING** (15+ words): Light source, direction, quality, color temperature, shadows, highlights, rim light, volumetric
5. **COMPOSITION** (10+ words): Camera angle, framing, depth of field, focal length, perspective
6. **COLOR PALETTE** (10+ words): Dominant colors, accent colors, color mood, contrast, saturation
7. **MOOD/ATMOSPHERE** (10+ words): Emotional tone, energy level, ambiance, weather if applicable
8. **TECHNICAL** (10+ words): Camera model, lens, aperture, film grain, render engine, resolution
9. **QUALITY TAGS**: "masterpiece, best quality, highly detailed, professional photography, award-winning, 8k resolution, ultra high quality"

ENRICHMENT PROCESS (execute for EVERY input):
- What is the ideal commercial use case?
- What style would a top creative director choose?
- What lighting would make this STUNNING?
- What composition creates maximum impact?
- What details separate amateur from professional?

TRANSFORMATION EXAMPLES:

Input: "hamburger"
Output: "Breathtaking commercial food photography of a towering gourmet artisan burger, triple-stacked premium wagyu beef patties with visible juicy grain, layers of perfectly melted aged gruyère cheese cascading down the sides, crisp emerald iceberg lettuce with water droplets, vine-ripened heirloom tomato slices with visible seeds, house-made garlic aioli dripping luxuriously, thick-cut applewood smoked bacon with caramelized edges, all nestled in a golden toasted brioche bun dusted with sesame seeds, dramatic chiaroscuro studio lighting with warm amber key light from upper left and cool blue fill light from right creating dimensional shadows, shallow depth of field at f/1.8 with creamy bokeh background, wisps of steam and smoke rising artfully, dark moody reclaimed wood surface with scattered sea salt crystals and fresh herb sprigs, shot on Phase One IQ4 150MP with Schneider 80mm LS lens, commercial advertising quality, masterpiece, best quality, highly detailed, professional food styling, award-winning photography, 8k resolution, ultra high quality"

Input: "logo"
Output: "Stunning professional brand identity logo design, sleek contemporary geometric monogram composed of interlocking abstract shapes suggesting innovation and forward momentum, sophisticated gradient transitioning from deep sapphire blue through electric indigo to vibrant ultraviolet purple, clean vector art style with mathematical precision, ultra-smooth bezier curves and perfect symmetry, subtle dimensional depth through carefully crafted shadows and highlights, placed on a pure matte black background creating maximum contrast, soft ambient glow emanating from the mark suggesting premium technology, negative space cleverly forming a hidden secondary symbol, professional brand guidelines quality, centered balanced composition with generous breathing room, crisp razor-sharp edges, masterpiece, best quality, highly detailed, professional graphic design, award-winning branding, 8k resolution, ultra clean vector illustration"`,

  // ════════════════════════════════════════
  // ANALYZE — Foco: ANÁLISE VISUAL PROFUNDA
  // ════════════════════════════════════════
  analyze: `${MASTER_CORE}

PAPEL: Você é um DIRETOR DE ARTE + ESTRATEGISTA DE MARCA com 20 anos de experiência em agências como Ogilvy e IDEO.

## FRAMEWORK DE ANÁLISE (OBRIGATÓRIO):

### 1. 👁️ DESCRIÇÃO VISUAL DETALHADA
- Todos os elementos visuais presentes
- Hierarquia visual (o que chama atenção primeiro)
- Elementos textuais (transcreva textos visíveis)

### 2. 🎨 ANÁLISE TÉCNICA PROFUNDA
- **Composição**: Regra dos terços, simetria, leading lines, negative space
- **Paleta de cores**: Cores dominantes e secundárias com hex codes, harmonia cromática, temperatura
- **Tipografia**: Fontes identificadas, hierarquia tipográfica, legibilidade
- **Qualidade**: Resolução estimada, nitidez, artefatos, compressão

### 3. 🧠 ANÁLISE DE BRANDING & MARKETING
- Público-alvo inferido (idade, perfil, poder aquisitivo)
- Posicionamento de marca transmitido
- Consistência visual com o nicho
- Comparação com padrões do mercado

### 4. ✅ PONTOS FORTES (mínimo 4)
O que funciona bem e POR QUÊ

### 5. ⚠️ PONTOS DE MELHORIA (mínimo 4)
O que melhorar e COMO, com exemplos específicos

### 6. 🚀 RECOMENDAÇÕES PROFISSIONAIS
- 5 ações concretas para melhorar o material
- Referências visuais similares (marcas/estilos)
- Tendências de design 2024/2025 aplicáveis
- Formatos e plataformas recomendados

### 7. 💡 PROMPT DE RECRIAÇÃO
Gere um prompt otimizado para recriar/melhorar esta imagem com IA (em inglês, formato SDXL).

Se o usuário fornecer contexto sobre seu negócio, PERSONALIZE 100% da análise para o nicho dele.`,
};

// ═══════════════════════════════════════════════════════════════════════
// INPUT ENRICHMENT ENGINE — Enriquece automaticamente inputs curtos
// ═══════════════════════════════════════════════════════════════════════

function buildEnrichedPrompt(type: string, userPrompt: string, context?: string): string {
  const enrichmentHint = `

INSTRUÇÃO DE ENRIQUECIMENTO: O input do usuário pode ser curto ou vago.
Seu trabalho é INFERIR tudo que falta e entregar como se ele tivesse escrito um briefing completo.
Enriqueça automaticamente com:
- Nicho/segmento provável
- Público-alvo ideal
- Tom e registro adequado
- Contexto comercial
- Elementos técnicos do nicho
${context ? `\nCONTEXTO DO NEGÓCIO DO USUÁRIO: ${context}` : ""}
INPUT DO USUÁRIO: "${userPrompt}"

Lembre-se: Sua resposta deve ter qualidade de entrega de agência premium. NUNCA responda com menos de 400 palavras para texto.`;

  return enrichmentHint;
}

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

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    const textModel = "google/gemini-3-flash-preview";
    const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");

    // ═══════════════════════════════════════
    // ACTION: improve_prompt (enriquecimento inteligente)
    // ═══════════════════════════════════════
    if (action === "improve_prompt") {
      const result = await gatewayText(apiKey, [
        { role: "system", content: systemPrompts.prompt_enhancer },
        { role: "user", content: buildEnrichedPrompt("prompt_enhancer", prompt, context) },
      ], textModel, 0.9);
      return new Response(JSON.stringify({ improved_prompt: result, model_used: textModel }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════
    // ACTION: generate_image_variation (nova variação de imagem)
    // ═══════════════════════════════════════
    if (action === "generate_image_variation") {
      

      const basePrompt = originalContent || prompt;
      console.log("🎨 Image variation: refining prompt with GPT-4o...");
      const variationPrompt = await gatewayText(apiKey, [
        { role: "system", content: systemPrompts.image_prompt },
        { role: "user", content: `Create a DIFFERENT variation of this concept. Change the style, angle, lighting, or mood significantly while keeping the same subject:\n\n${basePrompt}` },
      ], textModel, 0.95);

      console.log("🖼️ Image variation: generating with Replicate...");
      const imageUrl = await generateImage(apiKey, replicateToken, variationPrompt);

      return new Response(JSON.stringify({
        image_url: imageUrl,
        text: `🎨 **Nova variação gerada!**\n\n**Prompt da variação (${variationPrompt.split(" ").length} palavras):**\n\`\`\`\n${variationPrompt}\n\`\`\`\n\n> 🔄 *Cada variação usa um estilo, iluminação ou composição diferente para o mesmo conceito.*`,
        enhanced_prompt: variationPrompt,
        model_used: "gemini-flash + sdxl-lightning",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════
    // ACTION: generate_variations (3 variações reais e profundas)
    // ═══════════════════════════════════════
    if (action === "generate_variations") {
      const result = await gatewayText(apiKey, [
        {
          role: "system",
          content: `${MASTER_CORE}

PAPEL: Você é um DIRETOR CRIATIVO DE AGÊNCIA TOP-10 GLOBAL.
MISSÃO: Criar 3 variações RADICALMENTE diferentes, cada uma COMPLETA e PRONTA PARA USAR.

## VARIAÇÃO 1 — 🏆 CORPORATIVA PREMIUM
- Tom: Sofisticado, autoritário, exclusivo, elegante
- Linguagem: Vocabulário refinado, frases impactantes, dados concretos
- Estrutura: Formal e organizada, com hierarquia clara
- Referência: Como se a Rolex ou Apple escrevessem
- DEVE ser completa (400+ palavras) com TODOS os elementos da versão original

## VARIAÇÃO 2 — 🎨 CRIATIVA DISRUPTIVA
- Tom: Ousado, irreverente, memorável, viral
- Linguagem: Metáforas poderosas, storytelling envolvente, humor inteligente
- Estrutura: Quebra de padrão, formato não-convencional
- Referência: Como se a Nike ou Red Bull escrevessem
- DEVE ser completa (400+ palavras) com abordagem totalmente criativa

## VARIAÇÃO 3 — ⚡ VENDAS DIRETAS (CLOSER)
- Tom: Urgente, escasso, orientado a ação imediata
- Linguagem: Frases curtas e poderosas, imperativas, gatilhos emocionais
- Estrutura: Funil de vendas condensado, CTA a cada parágrafo
- Referência: Como um vendedor campeão fecharia a venda
- DEVE ser completa (400+ palavras) com foco total em conversão

REGRAS:
- Cada variação é INDEPENDENTE e COMPLETA — não é um resumo, é uma entrega profissional inteira
- Separe com: \n\n---\n\n
- Comece cada variação com o título: ## 🏆/🎨/⚡ Variação X — [Nome do Estilo]
- NUNCA copie frases entre variações — cada uma é 100% original`,
        },
        ...(context ? [{ role: "user", content: `Contexto do negócio: ${context}` }] : []),
        { role: "user", content: `Crie 3 variações profissionais e COMPLETAS (cada uma com 400+ palavras) deste conteúdo:\n\n${originalContent}` },
      ], textModel, 0.95);

      return new Response(JSON.stringify({ variations: result, model_used: textModel }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const effectiveType = (attachments && attachments.length > 0 && type !== "image") ? "analyze" : type;
    const systemPrompt = systemPrompts[effectiveType] || systemPrompts.copy;

    // ═══════════════════════════════════════
    // IMAGE GENERATION (orquestração GPT-4o + SDXL)
    // ═══════════════════════════════════════
    if (type === "image") {
      // If user sent attachments with image tool → edit/transform the image
      if (attachments && attachments.length > 0) {
        console.log("🎨 Image edit: user sent attachment with image tool, using AI to edit...");
        
        const userContentParts: any[] = [];
        if (prompt.trim()) {
          userContentParts.push({ type: "text", text: `Edit/transform this image based on this instruction: ${prompt}${context ? `\nBusiness context: ${context}` : ""}` });
        } else {
          userContentParts.push({ type: "text", text: `Analyze this image and create an improved/enhanced version of it.${context ? `\nBusiness context: ${context}` : ""}` });
        }
        for (const att of attachments) {
          if (att.type === "image" && att.data) {
            userContentParts.push({ type: "image_url", image_url: { url: att.data, detail: "high" } });
          }
        }

        const editResp = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            messages: [{ role: "user", content: userContentParts }],
            modalities: ["image", "text"],
          }),
        });

        if (!editResp.ok) {
          const body = await editResp.text();
          throw new Error(`Image edit error ${editResp.status}: ${body}`);
        }

        const editData = await editResp.json();
        const editedImageUrl = editData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        const editText = editData.choices?.[0]?.message?.content || "";

        return new Response(JSON.stringify({
          image_url: editedImageUrl || null,
          text: editedImageUrl
            ? `🎨 **Imagem editada com sucesso!**\n\n${editText ? `${editText}\n\n` : ""}> 💡 *A imagem foi processada com base na sua instrução e no arquivo enviado.*`
            : `⚠️ Não foi possível editar a imagem. ${editText || "Tente novamente com uma instrução diferente."}`,
          enhanced_prompt: prompt,
          model_used: "gemini-2.5-flash-image (edit)",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("🎨 Step 1: GPT-4o refining prompt to commercial-grade...");
      const enhancedPrompt = await gatewayText(apiKey, [
        { role: "system", content: systemPrompts.image_prompt },
        ...(context ? [{ role: "user", content: `Business context: ${context}` }] : []),
        { role: "user", content: prompt },
      ], textModel, 0.7);

      console.log("🖼️ Step 2: Replicate generating with SDXL Lightning...");
      const imageUrl = await generateImage(apiKey, replicateToken, enhancedPrompt);

      return new Response(JSON.stringify({
        image_url: imageUrl,
        text: `🎨 **Imagem gerada com sucesso!**\n\n**Seu input:** ${prompt}\n\n**Prompt profissional gerado pela IA (${enhancedPrompt.split(" ").length} palavras):**\n\`\`\`\n${enhancedPrompt}\n\`\`\`\n\n> 💡 *O prompt foi automaticamente enriquecido com detalhes de composição, iluminação, estilo, paleta de cores e especificações técnicas de câmera para garantir resultado de qualidade publicitária.*\n\n> 🔄 *Clique em "Gerar 3 Variações" para criar versões alternativas com estilos diferentes.*`,
        enhanced_prompt: enhancedPrompt,
        model_used: "gemini-flash + sdxl-lightning",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════
    // TEXT STREAMING (com enriquecimento automático)
    // ═══════════════════════════════════════
    const enrichedUserMessage = buildEnrichedPrompt(effectiveType, prompt, context);
    const userContent = attachments && attachments.length > 0
      ? buildUserContent(enrichedUserMessage, attachments)
      : enrichedUserMessage;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ];

    // Use gpt-4o for all categories (premium quality)
    const model = textModel;
    const response = await gatewayChat(apiKey, messages, { stream: true, model, temperature: 0.85 });

    if (!response.ok) {
      const body = await response.text();
      console.error("OpenAI error:", response.status, body);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit atingido. Aguarde 30 segundos e tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 401) return new Response(JSON.stringify({ error: "Chave de API inválida. Verifique as configurações." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`OpenAI error ${response.status}: ${body}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (e) {
    console.error("AI Assistant error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
