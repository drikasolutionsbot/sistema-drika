# 🤖 Drika Bot Externo

Bot Discord integrado ao painel Drika via Supabase compartilhado.

## 📋 Pré-requisitos

- Node.js 18+
- Token de bot Discord
- Service Role Key do Supabase (mesmo projeto do painel)

## 🚀 Instalação

```bash
cd bot-externo
npm install
```

## ⚙️ Configuração

1. Copie o `.env.example` para `.env`:
```bash
cp .env.example .env
```

2. Preencha o `.env`:
- `DISCORD_BOT_TOKEN` — Token do seu bot no [Discord Developer Portal](https://discord.com/developers/applications)
- `SUPABASE_URL` — URL do seu projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — Service Role Key (encontrada em Settings > API no Supabase)

3. No **painel web**, vá em **Configurações > Bot Externo** e configure o Guild ID do servidor

## ▶️ Executar

```bash
npm start
```

Ou com auto-reload:
```bash
npm run dev
```

## 🔧 Funcionalidades

### Comandos Slash
| Comando | Descrição |
|---------|-----------|
| `/loja` | Exibe todos os produtos da loja |
| `/comprar <produto>` | Compra direta de um produto |
| `/estoque` | Mostra estoque atual |
| `/ticket` | Envia painel de tickets |
| `/painel` | Link para o painel web |

### Sistema de Checkout
- Thread privada para cada compra
- Exibição de PIX (chave estática)
- Confirmação manual de pagamento
- Entrega automática de estoque
- Expiração automática de pedidos

### Proteção
- **Anti-Raid** — Detecta entrada em massa
- **Anti-Spam** — Silencia spammers
- **Anti-Link** — Remove links não permitidos

### Tickets
- Painel interativo com botão
- Criação de canal privado
- Fechamento automático

## 🔄 Como funciona

```
┌─────────────┐     ┌──────────┐     ┌─────────────┐
│  Painel Web │────▶│ Supabase │◀────│ Bot Externo │
│  (Lovable)  │     │   (DB)   │     │  (Node.js)  │
└─────────────┘     └──────────┘     └─────────────┘
     Salva             Armazena         Lê e executa
  configurações        os dados        no Discord
```

O painel web salva todas as configurações no Supabase.
O bot externo lê essas configurações e executa no Discord.
Ambos compartilham o mesmo banco de dados.

## 📁 Estrutura

```
bot-externo/
├── index.js            # Entrada principal
├── supabase.js         # Cliente Supabase + queries
├── commands/
│   ├── loja.js         # /loja
│   ├── comprar.js      # /comprar
│   ├── estoque.js      # /estoque
│   ├── painel.js       # /painel
│   └── ticket.js       # /ticket + sistema de tickets
├── handlers/
│   └── checkout.js     # Fluxo completo de compra
├── events/
│   ├── interaction.js  # Router de interações
│   ├── memberJoin.js   # Novo membro
│   └── protection.js   # Anti-raid, anti-spam, anti-link
├── .env.example
├── package.json
└── README.md
```
