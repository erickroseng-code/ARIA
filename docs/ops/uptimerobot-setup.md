# UptimeRobot — Keep-Alive da Aria API

O Render Free Tier faz spin-down da API após 15 minutos sem tráfego, causando cold start de ~30s na próxima requisição. O UptimeRobot pinga `/health` a cada 5 minutos para manter o serviço ativo 24/7.

## Configuração inicial

### 1. Criar conta

Acesse [uptimerobot.com](https://uptimerobot.com) e crie uma conta gratuita.
O plano free permite até 50 monitores com intervalo mínimo de 5 minutos.

### 2. Criar o monitor

1. Clique em **+ Add New Monitor**
2. Preencha os campos:

| Campo | Valor |
|-------|-------|
| Monitor Type | HTTP(S) |
| Friendly Name | `Aria API — Keep Alive` |
| URL (or IP) | `https://aria-api.onrender.com/health` |
| Monitoring Interval | **5 minutes** |
| Monitor Timeout | 30 seconds |

3. Em **Alert Contacts**: configurar alerta Telegram (ver seção abaixo)
4. Clique em **Create Monitor**

### 3. Configurar alerta Telegram

No UptimeRobot, vá em **My Settings → Alert Contacts → Add Alert Contact**:

| Campo | Valor |
|-------|-------|
| Alert Contact Type | Telegram |
| Friendly Name | `Aria Telegram` |
| Bot API Token | Seu `TELEGRAM_BOT_TOKEN` |
| Chat ID | Seu `TELEGRAM_CHAT_ID` |

Após salvar, volte ao monitor e adicione este contato em **Alert Contacts**.

**Mensagem enviada no downtime:**
```
⚠️ [Aria API] Downtime detectado em https://aria-api.onrender.com
```

### 4. Verificar funcionamento

Após criar o monitor, aguarde 5 minutos e verifique:
- Status deve aparecer como **Up** (verde)
- Em **Log** do monitor deve aparecer o primeiro ping bem-sucedido

## Recriar monitor (caso seja deletado)

Se o monitor for deletado acidentalmente, repita os passos da seção "Criar o monitor".
Os valores são sempre os mesmos:
- **URL:** `https://aria-api.onrender.com/health`
- **Interval:** 5 minutos
- **Alert contact:** Telegram com as credenciais do bot Aria

## Troubleshooting

### Monitor mostra "Down"

1. Verificar se o Render service está ativo: [dashboard.render.com](https://dashboard.render.com)
2. Testar manualmente: `curl https://aria-api.onrender.com/health`
3. Se retornar timeout: verificar logs no Render Dashboard
4. Se retornar 502: o serviço pode ter entrado em spin-down — aguardar 30s e tentar novamente

### Alerta Telegram não chegou

1. Verificar se o `TELEGRAM_BOT_TOKEN` no UptimeRobot está correto (sem espaços)
2. Verificar se o `TELEGRAM_CHAT_ID` está correto (pode ser negativo para grupos: `-1001234567890`)
3. Garantir que o bot foi adicionado ao chat e tem permissão para enviar mensagens
4. Testar o bot manualmente:
   ```bash
   curl "https://api.telegram.org/bot{TOKEN}/sendMessage" \
     -d "chat_id={CHAT_ID}&text=Teste+UptimeRobot"
   ```

### Verificar frequência real dos pings

No UptimeRobot, clique no monitor → **Response Time** para ver o histórico de pings e confirmar que estão ocorrendo a cada 5 minutos.

## Referência rápida

| Item | Valor |
|------|-------|
| URL monitorada | `https://aria-api.onrender.com/health` |
| Intervalo | 5 minutos |
| Timeout | 30 segundos |
| Alerta após | 1 falha (imediato) |
| Limite free | 50 monitores, 5 min mín |
| Custo | Gratuito |
