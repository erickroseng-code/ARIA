# Guia de Debug - Integração ClickUp

## 📋 Sumário
Todos os componentes da integração ClickUp foram verificados e estão corretamente configurados. Este guia explica como testar e debugar qualquer problema.

---

## ✅ O que foi Verificado

### 1. **Variáveis de Ambiente** (.env)
- ✅ `CLICKUP_API_TOKEN=pk_164632817_...`
- ✅ `CLICKUP_DEFAULT_LIST_ID=7-90132644838-1`
- ✅ `CLICKUP_TEAM_ID=90132644838`
- ✅ `CLICKUP_USER_ID=164632817`

### 2. **Servidor (server.ts)**
- ✅ Lê as variáveis corretas
- ✅ Inicializa `ClickUpClient`
- ✅ Inicializa `ClickUpQueryService`
- ✅ Injeta no `ChatService`
- ✅ Registra logs de inicialização

### 3. **ChatService**
- ✅ Método `streamResponse()` detecta queries ClickUp
- ✅ Método `buildClickUpContext()` busca dados do ClickUp
- ✅ Injeta dados no system prompt
- ✅ Logging em 5 pontos críticos

### 4. **Frontend**
- ✅ `chat.service.ts` envia `content` e `sessionId`
- ✅ Aponta para endpoint correto `/api/chat/stream`
- ✅ Schema de request está correto

---

## 🔍 Como Testar

### **Opção 1: Teste Rápido via curl**

```bash
# Terminal 1: Inicie o servidor API
cd aria/apps/api
npm run dev

# Terminal 2: Teste de query ClickUp
curl -s -X POST "http://localhost:3001/api/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"content":"Quais sao minhas tarefas?","sessionId":"test123"}' | head -100
```

**O que deve aparecer:**
- Resposta SSE com chunks de dados
- Cada linha começa com `data: {type:'chunk',...}`
- Resposta deve incluir dados reais do ClickUp

---

### **Opção 2: Teste Completo do Fluxo**

```bash
# Execute o script de teste
cd aria
npx tsx test-clickup-flow.ts
```

**Isso testará:**
1. ✅ Credenciais configuradas
2. ✅ Clientes inicializados
3. ✅ `getMyTasks()` funciona
4. ✅ `getClientPipeline()` funciona
5. ✅ Formatação para IA funciona

---

### **Opção 3: Teste via Interface Web**

```bash
# Terminal 1: API
cd aria/apps/api && npm run dev

# Terminal 2: Web
cd aria/apps/web && npm run dev

# Terminal 3: Abra no navegador
# http://localhost:3000
```

**Testes:**
1. Envie: "Quais sao minhas tarefas?"
2. Envie: "Qual é o pipeline de clientes?"
3. Envie: "Tarefas para hoje"
4. Envie: "Clientes em andamento"

---

## 📊 Pontos de Logging para Monitorar

Quando testar, procure nos logs por:

### **1. Inicialização (server.ts)**
```
[server] ClickUp Config Check: {
  hasToken: true,
  hasListId: true,
  listId: '7-90132644838-1',
  userId: 164632817
}
[server] ClickUp integration initialized ✓
```

### **2. Detecção de Query (ChatService.isClickUpQuery)**
```
[ChatService.isClickUpQuery] {
  message: 'Quais sao minhas tarefas?',
  isQuery: true
}
```

### **3. Construção de Context (ChatService.buildClickUpContext)**
```
[ChatService.buildClickUpContext] qs available? true
[ChatService.buildClickUpContext] Intent detection: {
  isMyTasks: true,
  isClientPipeline: false
}
[ChatService.buildClickUpContext] Fetching my tasks with filter: undefined
[ChatService.buildClickUpContext] Got tasks: 5
[ChatService.buildClickUpContext] Final context length: 1234 parts: 1
```

### **4. Requisições API (ClickUpClient.request)**
```
[ClickUpClient.request] Making request to: https://api.clickup.com/api/v2/team/90132644838/task | method: GET
[ClickUpClient.request] Response status: 200
```

### **5. Métodos Query (ClickUpQueryService)**
```
[ClickUpQueryService.getMyTasks] Fetching tasks. myUserId: 164632817
[ClickUpQueryService.getMyTasks] Got 5 tasks
[ClickUpQueryService.getClientPipeline] Fetching pipeline. pipeListId: 7-90132644838-1
[ClickUpQueryService.getClientPipeline] Fetched 15 tasks from list
```

---

## 🐛 Troubleshooting

### **Problema: "ClickUp not configured"**
**Causa:** Servidor não consegue ler `CLICKUP_API_TOKEN` ou `CLICKUP_DEFAULT_LIST_ID`

**Solução:**
1. Verifique `.env` tem os valores corretos
2. Reinicie o servidor (não basta reload)
3. Verifique `aria/apps/api/src/config/env.ts` - deve ter as variáveis no schema

---

### **Problema: Requisição para ClickUp API falha com 401**
**Causa:** Token inválido ou expirado

**Solução:**
```bash
# Teste o token diretamente
curl -s -H "Authorization: pk_164632817_WDST5DKQP85G0QZVSEM0ZU4NQ4KM5WQV" \
  https://api.clickup.com/api/v2/team/90132644838/task | jq .
```

Se retornar erro, o token está inválido. Gere um novo token no ClickUp.

---

### **Problema: Logs não aparecem**
**Causa:** Logs estão sendo redirecionados para arquivo

**Solução:**
```bash
# Execute com logging no console
NODE_ENV=development npm run dev
```

---

### **Problema: "buildClickUpContext" retorna string vazia**
**Causa:** `ClickUpQueryService` não está inicializado ou `getClickUpQueryService()` retorna null

**Solução:**
1. Verifique se `initializeClickUpQueryService()` foi chamado no server.ts (linha 49)
2. Verifique se `clickupApiToken && clickupListId` (linha 47) estão verdadeiros
3. Adicione logs no server.ts para confirmar inicialização

---

## 📝 Exemplo de Fluxo Esperado

### User: "Quais sao minhas tarefas?"

```
[1] Frontend envia para /api/chat/stream
    └─ {"content": "Quais sao minhas tarefas?", "sessionId": "..."}

[2] handleStream (chat.controller.ts) recebe e chama chatService.streamResponse()

[3] ChatService.streamResponse() detecta query ClickUp
    └─ isClickUpQuery() → true
    └─ buildClickUpContext() → chamada ClickUp API

[4] ClickUpQueryService.getMyTasks()
    └─ ClickUpClient.getTasksByAssignee()
    └─ API ClickUp retorna tarefas do usuário

[5] Dados formatados e injetados no system prompt
    └─ "⚠️ DADOS AO VIVO DO CLICKUP — OBRIGATÓRIO:..."

[6] Claude recebe prompt com dados reais
    └─ Retorna resposta baseada em tarefas reais

[7] Resposta streamed via SSE para o frontend
```

---

## 🧪 Script de Teste Interativo

Se quiser testar o fluxo completo localmente:

```bash
cd aria
npx tsx test-clickup-flow.ts
```

Este script:
1. ✅ Valida credenciais
2. ✅ Testa ClickUpClient
3. ✅ Testa ClickUpQueryService
4. ✅ Mostra exemplo de dados formatados

---

## 📞 Se Ainda Não Funcionar

Coleta de informações para debug:

```bash
# 1. Exporte logs do servidor
NODE_ENV=development npm run dev 2>&1 | tee aria.log

# 2. Faça um teste via curl e capture a saída
curl -v -X POST "http://localhost:3001/api/chat/stream" \
  -H "Content-Type: application/json" \
  -d '{"content":"teste","sessionId":"debug"}' 2>&1 | tee curl.log

# 3. Compartilhe aria.log + curl.log + mensagem de erro
```

---

## ✨ Próximos Passos

Depois de confirmar que ClickUp funciona:

1. **Testar outros tipos de query:**
   - "Mostrar pipeline de clientes"
   - "Tarefas em andamento"
   - "Tarefas atrasadas"

2. **Implementar mais handlers:**
   - Criar tarefa via chat
   - Atualizar status
   - Filtrar por cliente

3. **Adicionar testes unitários:**
   - Tests para ClickUpQueryService
   - Tests para ChatService com ClickUp
