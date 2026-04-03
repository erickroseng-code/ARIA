# Aria API

Fastify API do sistema Aria. Serve o chat, integrações (Google, ClickUp, Notion, Telegram), Atlas (otimizador de ads) e Maverick (geração de conteúdo).

## Desenvolvimento local

```bash
# Na raiz do monorepo (aria/)
npm run dev:api
```

API disponível em `http://localhost:3001`
Health check: `http://localhost:3001/health`

## Deploy no Render (produção)

### Pré-requisitos

1. Conta no [Render](https://render.com) (free tier é suficiente)
2. Repositório conectado ao GitHub
3. Docker instalado localmente para testar antes do deploy

### Setup inicial

1. No Render Dashboard: **New → Blueprint**
2. Selecionar este repositório
3. O `render.yaml` na raiz do repo configura o serviço automaticamente
4. Configurar as variáveis de ambiente marcadas como `sync: false` (ver seção abaixo)

### Variáveis de ambiente obrigatórias no Render

Após criar o serviço, vá em **Environment** e adicione:

| Variável | Descrição | Onde obter |
|----------|-----------|-----------|
| `OPENROUTER_API_KEY` | Chave principal de LLM | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `JWT_SECRET` | Secret de autenticação | `openssl rand -base64 32` |
| `SCHEDULER_SECRET` | Autenticação GitHub Actions → API | Qualquer string segura |
| `TELEGRAM_BOT_TOKEN` | Token do bot Telegram | BotFather no Telegram |
| `TELEGRAM_CHAT_ID` | ID do chat para notificações | `@userinfobot` no Telegram |

### Variáveis opcionais (ativar features)

| Variável | Feature | Onde obter |
|----------|---------|-----------|
| `GROQ_API_KEY` | Chat AI (fallback) | [groq.com/keys](https://console.groq.com/keys) |
| `TAVILY_API_KEY` | Busca web do Maverick (`/api/maverick/discover`) | [tavily.com](https://tavily.com) |
| `MAVERICK_VIDEO_INTEL_MAX` | Quantidade de vídeos para transcrever por dossiê | Ex: `5` |
| `R2_ENDPOINT` + `R2_BUCKET` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` + `R2_REGION` | Storage temporário R2 para vídeo (com cleanup após transcrição) | Cloudflare R2 |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REFRESH_TOKEN` | Google Calendar/Workspace | Google Cloud Console |
| `CLICKUP_API_TOKEN` + `CLICKUP_DEFAULT_LIST_ID` | Gestão de tarefas | ClickUp → Settings → Apps |
| `NOTION_API_KEY` | Documentos Notion | [notion.so/my-integrations](https://www.notion.so/my-integrations) |
| `META_ACCESS_TOKEN` + `META_AD_ACCOUNT_ID` | Atlas (Meta Ads) | Meta Business Manager |
| `FIGMA_API_TOKEN` + `FIGMA_FILE_KEY` | Export carousel para Figma | Figma → Account Settings |
| `ELEVENLABS_API_KEY` | Text-to-Speech | [elevenlabs.io](https://elevenlabs.io) |

### Configurar GitHub Actions para chamar a API

Adicione os seguintes secrets no repositório GitHub:

```bash
# URL pública da API no Render
gh secret set ARIA_API_URL --body "https://aria-api.onrender.com"

# Secret para autenticar chamadas agendadas
gh secret set SCHEDULER_SECRET --body "sua-string-secreta-aqui"

# Telegram para notificações de falha
gh secret set TELEGRAM_BOT_TOKEN --body "seu-token-aqui"
gh secret set TELEGRAM_CHAT_ID --body "seu-chat-id-aqui"
```

### Build local (testar antes do deploy)

```bash
# A partir da raiz do repositório (aios-core/)
docker build -t aria-api -f aria/apps/api/Dockerfile aria/

# Testar com as variáveis de ambiente
docker run --env-file aria/.env -p 3001:3001 aria-api

# Verificar health
curl http://localhost:3001/health
```

### Limitações do Render Free Tier

| Item | Limite |
|------|--------|
| Horas/mês | 750h (suficiente para 1 serviço 24/7) |
| RAM | 512MB |
| Spin-down | Após 15 min sem tráfego (~30s cold start) |
| Persistent disk | Não disponível |

**SQLite em produção:** O banco SQLite é reiniciado a cada novo deploy. Para persistência real, configure `DATABASE_URL` com uma URL do [Turso](https://turso.tech) (libsql cloud, free tier disponível).

**Keep-alive:** Configure o UptimeRobot (Story 11.3) para pingar `/health` a cada 5 min e evitar o spin-down.
