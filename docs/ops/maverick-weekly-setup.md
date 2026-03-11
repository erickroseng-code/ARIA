# Maverick Weekly — Setup Guide

Guia para configurar a automação semanal de carrosséis do Instagram.

## Secrets necessários

Configure estes secrets no repositório GitHub (`Settings → Secrets and variables → Actions`):

| Secret | Valor | Exemplo |
|--------|-------|---------|
| `ARIA_API_URL` | URL da API no Render (sem barra final) | `https://aria-api.onrender.com` |
| `MAVERICK_WEEKLY_TOPICS` | Array JSON de tópicos | `["emagrecimento feminino", "mindset financeiro"]` |
| `TELEGRAM_BOT_TOKEN` | Token do bot Telegram | `7123456789:AAEF...` |
| `TELEGRAM_CHAT_ID` | Chat ID do canal/grupo | `-1001234567890` |

### Via GitHub CLI:

```bash
gh secret set ARIA_API_URL --body "https://aria-api.onrender.com"

gh secret set MAVERICK_WEEKLY_TOPICS \
  --body '["emagrecimento feminino", "mindset financeiro", "produtividade pessoal"]'

gh secret set TELEGRAM_BOT_TOKEN --body "SEU_TOKEN_AQUI"
gh secret set TELEGRAM_CHAT_ID --body "SEU_CHAT_ID_AQUI"
```

## Horário do cron

O workflow está configurado para:
- **Cron:** `0 11 * * 1` — toda segunda-feira às 11h UTC
- **Equivale a:** 8h BRT (UTC-3) / 9h BRST (UTC-2, horário de verão)

Para alterar, edite `.github/workflows/maverick-weekly.yml`:
```yaml
schedule:
  - cron: '0 11 * * 1'  # Altere aqui
```

Exemplos de cron:
- Terça, 8h BRT: `0 11 * * 2`
- Segunda e quinta: `0 11 * * 1,4`
- Diário 8h BRT: `0 11 * * *`

## Disparo manual

Para executar agora (sem esperar o cron):

1. Acesse a aba **Actions** no GitHub
2. Clique em **Maverick Weekly — Carrosséis Automáticos**
3. Clique **Run workflow**
4. Opcionalmente, informe tópicos específicos no campo `topics` (JSON array)
5. Escolha o tema (`dark` ou `light`)
6. Clique **Run workflow**

## Tópicos padrão

Os tópicos padrão vêm do secret `MAVERICK_WEEKLY_TOPICS`. Para atualizar:

```bash
gh secret set MAVERICK_WEEKLY_TOPICS \
  --body '["novo tópico 1", "novo tópico 2", "novo tópico 3"]'
```

Máximo: 10 tópicos por batch.

## Troubleshooting

### Render cold start
O step "Warm up API" tenta acordar a API antes do batch. Se a API demorar mais de 45s para responder, o warm-up falha silenciosamente e o batch pode timeout. Solução: configure o UptimeRobot (ver `docs/ops/uptimerobot-setup.md`) para evitar spin-down.

### Timeout do batch
O curl tem `--max-time 600` (10 minutos). Se consistentemente ultrapassar, verifique:
- Quantos tópicos estão no `MAVERICK_WEEKLY_TOPICS`
- Se o Render free tier está com a CPU throttled (upgrade para Starter $7/mês resolve)

### Falha na notificação de erro
Se a notificação de falha não chegar, verifique se `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` estão corretos:
```bash
curl "https://api.telegram.org/bot<TOKEN>/getMe"
```

### Verificar resultado do batch
O batchId fica disponível por 24h:
```bash
curl https://aria-api.onrender.com/api/maverick/weekly-batch/<BATCH_ID>
```
