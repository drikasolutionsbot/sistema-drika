# Marketplace Global — Fluxo Completo

## Resumo do fluxo

```
Lojista (plano pago)
  └─ Cria produto na sua loja
  └─ Clica "Enviar para Marketplace Global"
       └─ status = pending_global
            ↓
Admin SaaS (Discord ID autorizado)
  └─ Aba "Aprovações Globais" no painel admin
  └─ Aprova ou rejeita
       ↓ (aprovado)
Bot global posta embed no canal da categoria
no servidor Discord da dona (#contas, #serviços, etc)
       ↓
Comprador clica "Comprar"
  └─ Checkout PIX centralizado (gateway da dona)
  └─ Pagamento confirmado
       ├─ 2% → carteira da dona (SaaS)
       ├─ 98% → carteira do vendedor (lojista)
       └─ Entrega automática do produto (mesmo fluxo da loja interna)
```

## Configurações no painel admin (Super Admin)

Nova aba **Marketplace Global** em `/admin`:
- **Comissão SaaS (%)**: padrão 2%, editável
- **Discord IDs aprovadores**: lista de IDs que podem aprovar (além do super admin)
- **Servidor Discord da dona**: guild_id do servidor onde produtos são publicados
- **Mapeamento categoria → canal**: para cada categoria global (Contas, Serviços, Bots, Outros), o ID do canal Discord onde o embed é postado
- **Gateway PIX global**: qual provider configurado da dona é usado (Efí/PushinPay/AbacatePay)

## Submissão pelo lojista

Em `ProductDetail.tsx` (botão novo no header do produto):
- Botão **"Enviar para Marketplace Global"** (visível só para planos pagos)
- Estados: `not_submitted` | `pending_global` | `approved_global` | `rejected_global`
- Se rejeitado, mostra motivo + permite reenvio
- Modal de confirmação com preview do que vai aparecer (nome, descrição, preço, banner)

## Aprovação pelo admin

Nova página `/admin/global-marketplace`:
- Lista produtos com `global_status = pending_global`
- Cards com preview completo (banner, descrição, preço, vendedor/tenant)
- Ações: **Aprovar** (escolhe categoria global) | **Rejeitar** (com motivo) | **Ver vendedor**
- Ao aprovar: bot posta embed no canal correto + produto fica visível globalmente

## Compra global

- Embed no Discord tem botão **Comprar** com `custom_id = global_buy:{global_listing_id}`
- Edge function `global-marketplace-checkout` gera PIX via gateway da dona
- Webhook PIX existente é estendido pra detectar `metadata.is_global = true`
- Ao confirmar: split automático nas carteiras (`wallet_transactions` × 2: débito SaaS de 2% como `commission_received`, crédito vendedor de 98% como `global_sale`)
- Entrega: reusa lógica de `auto_delivery` do produto original (estoque, role, mensagens)

## Detalhes técnicos

### Migrations

1. **Nova tabela `global_marketplace_listings`**:
   - `product_id` (FK products), `tenant_id` (vendedor)
   - `global_status` (pending/approved/rejected), `category_global` (text)
   - `submitted_at`, `reviewed_at`, `reviewed_by` (admin uuid), `rejection_reason`
   - `discord_message_id`, `discord_channel_id` (após postagem)
   - `total_sales`, `total_revenue_cents`

2. **Estender `landing_config`** (config singleton da dona):
   - `global_marketplace_commission_percent` (int, default 2)
   - `global_marketplace_guild_id` (text)
   - `global_marketplace_approver_discord_ids` (text[])
   - `global_marketplace_category_channels` (jsonb: `{contas: "channel_id", servicos: "..."}`)
   - `global_marketplace_payment_provider` (text)

3. **Estender `wallet_transactions`**:
   - Adicionar tipos `global_sale` e `global_commission`
   - `metadata.global_listing_id` para rastreio

4. **Estender `orders`**:
   - `is_global` (bool), `global_listing_id` (uuid), `commission_cents` (int), `seller_received_cents` (int)

### Edge functions

- `manage-global-marketplace` — submit/list/approve/reject (auth: super admin OU discord ID na whitelist)
- `global-marketplace-checkout` — gera PIX centralizado, marca `is_global=true`
- Estender webhook PIX existente (`pix-webhook-receiver`) — se `is_global`, faz split nas carteiras
- `post-global-listing-discord` — posta embed no canal da categoria (chamada após aprovação)

### Frontend

- `src/pages/admin/AdminGlobalMarketplacePage.tsx` — fila de aprovação
- `src/components/admin/GlobalMarketplaceConfigTab.tsx` — settings (% comissão, IDs aprovadores, mapeamento canais)
- `src/components/store/GlobalMarketplaceSubmitButton.tsx` — botão no ProductDetail
- Rota nova `/admin/global-marketplace` no `AdminLayout`

### Bot externo (`bot-externo/`)

- Handler em `events/interaction.js` para `custom_id` começando com `global_buy:` → chama edge function de checkout
- Comando opcional `/marketplace` no servidor da dona pra listar produtos por categoria

## Pontos abertos / decisões

- **Categorias globais fixas**: vou começar com 4 (Contas, Serviços, Bots, Outros) — editáveis depois pela dona
- **Estoque**: produto global compartilha estoque com o produto interno do vendedor (mesmo `products.id`)
- **Refund/disputa**: fora de escopo desta primeira versão (admin manual via carteira por enquanto)
- **Notificação ao vendedor**: DM no Discord quando aprovado/rejeitado/vendido (reusa sistema de DM templates)

---

Posso começar pela **migration + config no painel admin** e depois ir avançando módulo por módulo?
