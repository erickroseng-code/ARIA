# 🔄 Migração: SQLite → Supabase

Script profissional para migração de dados do SQLite para Supabase.

## ✅ Pré-requisitos

- ✅ Supabase projeto criado
- ✅ Variáveis de ambiente configuradas (em `.env`):
  ```
  SUPABASE_URL=<seu_url_do_supabase>
  SUPABASE_SERVICE_ROLE_KEY=<sua_service_role_key>
  ```
- ✅ Tabelas Supabase criadas (SQL em `src/config/supabase.sql`)
- ✅ No Render: adicionar as mesmas variáveis em Environment

## 🚀 Executar Migração

### **Local** (seu PC)
```bash
cd aria/apps/api
npm run migrate
```

### **No Render** (via Shell)

1. Abra o [Render Dashboard](https://dashboard.render.com)
2. Clique no serviço `aria-api`
3. Vá em **Shell**
4. Execute:
   ```bash
   npm run migrate
   ```

## 📊 O que é Migrado

| Tabela | Registros | Função |
|--------|-----------|--------|
| `transactions` | 118+ | Receitas e despesas |
| `budget` | N | Orçamento por categoria |
| `settings` | 2+ | Configurações (spreadsheet ID, onboarding) |

## ⚙️ Detalhes do Script

- **Arquivo:** `apps/api/migrate.ts`
- **Tipo:** TypeScript → tsx
- **Conexão:** Supabase SDK
- **Erro Handling:** Continua migração mesmo se uma tabela falhar
- **Saída:** Log detalhado com contadores

## 🔍 Verificar Migração

1. **Supabase Dashboard:**
   - Vá em [Table Editor](https://app.supabase.com)
   - Verifique `transactions`, `budget`, `settings`

2. **API:**
   ```bash
   curl https://aria-api-avq0.onrender.com/api/finance/dashboard
   ```
   Deve retornar dados, não zeros

3. **Telegram:**
   - Envie: `"quanto gastei esse mês?"`
   - Deve retornar resumo com valores

## 🐛 Troubleshooting

**"Cannot find module '@supabase/supabase-js'"**
- Rodar: `npm install`

**"fetch failed" / DNS erro**
- Tenta novamente mais tarde
- No Render, usar Shell tem melhor conectividade

**"SQLITE_DB_PATH not found"**
- Verificar se o arquivo existe no caminho especificado
- No Render, pode não existir (arquivo local)

## 📝 Próximos Passos

- [ ] Rodar migração
- [ ] Verificar dados no Supabase
- [ ] Testar API (dashboard)
- [ ] Validar no Telegram
- [ ] Opcionalmente, remover `dev.native.db` após validar dados

---

**Status:** ✅ Pronto para produção
