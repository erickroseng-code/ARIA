# ARIA — AI Personal Assistant
# Product Requirements Document (PRD)

---

## Change Log

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-02-19 | 1.0 | Criação inicial do PRD | Morgan (PM) + Atlas (Analyst) |
| 2026-02-19 | 1.1 | Adicionado: Out of Scope, KPIs, MVP Validation, Enhancements Futuros | Morgan (PM) |

---

## 1. Goals & Background Context

### Goals

- Construir um assistente pessoal AI (ARIA) acessível via Telegram Bot e Web UI simultaneamente
- Automatizar a gestão de clientes: documentos recebidos → perfil do cliente no Notion preenchido e estruturado automaticamente
- Gerar Planos de Ataque completos para clientes a partir de briefings e documentos de reunião
- Criar tarefas no ClickUp e Notion via áudio ou texto, sem fricção
- Automatizar relatórios e análises periódicas com base em documentos enviados
- Gerenciar agenda e reuniões com Google Calendar integrado
- Centralizar comunicação e comandos num único canal (Telegram ou Web UI)

### Success Metrics (KPIs)

| Métrica | Baseline Atual | Meta MVP |
|---------|---------------|----------|
| Tempo para criar Plano de Ataque | ~45-60 min (manual) | < 3 minutos |
| Tempo para criar tarefa no ClickUp/Notion | ~2-3 min (manual) | < 30 segundos |
| Documentos processados por semana | 0 (manual) | 100% dos documentos recebidos |
| Reuniões com resumo automático gerado | 0% | > 80% das reuniões |
| Relatórios semanais entregues automaticamente | 0 (manual) | 100% (sem intervenção) |
| Tempo de resposta da ARIA por comando | N/A | < 60 segundos para processamento de docs |

### MVP Validation Criteria

O MVP (Epics 1-3) será considerado bem-sucedido quando:
- Plano de Ataque criado no Notion em menos de 3 minutos a partir de 2 documentos enviados
- Tarefa criada no ClickUp/Notion por comando de voz em menos de 30 segundos
- Bot Telegram e Web UI funcionais e autenticados sem erros por 7 dias consecutivos
- 100% dos documentos PDF/Word enviados processados sem falha manual

### Out of Scope (MVP v1.0)

Os seguintes itens estão **explicitamente fora do escopo** do MVP e serão considerados em versões futuras:

| Item | Motivo de Exclusão |
|------|-------------------|
| Aplicativo mobile nativo (iOS/Android) | Telegram + Web Responsive cobre o uso mobile |
| Suporte multi-usuário / multi-tenant | ARIA é um assistente pessoal — single user por design |
| Integração com WhatsApp Business API | API oficial tem custo e aprovação demorada; Telegram cobre o canal |
| Integração com CRMs externos (HubSpot, Salesforce, Pipedrive) | Notion funciona como CRM no MVP |
| Geração de imagens ou vídeos com IA | Fora do escopo de texto e automação |
| Integração com ferramentas de design (Figma, Canva) | Planejado para versão futura |
| Dashboard analítico visual na Web UI | Relatórios textuais cobrem o MVP |
| Agendamento automático de reuniões com convidados externos | Complexidade OAuth + calendários externos |
| Memória persistente entre sessões (banco de dados próprio) | Notion/ClickUp como datastores no MVP |
| Suporte a múltiplos idiomas além do português | Português é idioma primário (NFR5) |

### Future Enhancements (v1.1+)

- **WhatsApp Business** como canal alternativo ao Telegram
- **App mobile nativo** com notificações push nativas
- **Banco de dados próprio** (PostgreSQL) para memória persistente e histórico completo
- **Dashboard visual** com métricas e gráficos na Web UI
- **Integração com Figma** para automação de design assets
- **Multi-usuário** para uso em equipes pequenas
- **Integração com Google Meet / Zoom** para transcrição automática de reuniões ao vivo
- **CRM externo** (HubSpot ou Pipedrive) como alternativa ao Notion

### Background Context

Erick é um consultor que implementa o método da sua empresa em empresas clientes. Seu processo inclui reuniões com múltiplos setores (comercial, marketing) que geram documentos com informações críticas. Hoje, organizar e estruturar essas informações no Notion manualmente consome tempo significativo que poderia ser dedicado às reuniões e entregas de valor.

O ARIA resolve esse gargalo: recebe documentos (PDF/Word), interpreta o conteúdo com IA (Claude), e cria automaticamente a estrutura necessária dentro do perfil do cliente no Notion — pronta para apresentação. Além disso, centraliza toda a gestão de tarefas, agenda e comunicação num único assistente acessível pelo Telegram e por uma Web UI com identidade visual premium.

---

## 2. Requirements

### Functional Requirements

- **FR1:** O sistema deve aceitar upload de arquivos PDF e Word/DOCX via Telegram Bot e Web UI.
- **FR2:** O sistema deve extrair e interpretar o conteúdo dos documentos enviados usando IA (Claude API).
- **FR3:** O usuário deve poder indicar o cliente-alvo por nome ou comando ("cliente: [nome]") e o sistema localiza o perfil no Notion.
- **FR4:** O sistema deve criar uma página estruturada "Plano de Ataque" dentro do perfil do cliente no Notion, seguindo template pré-definido.
- **FR5:** O sistema deve gerar automaticamente: Resumo do Setor Comercial, Resumo do Setor de Marketing, Análise Integrada e Checklists práticos de ações.
- **FR6:** O sistema deve aceitar áudio ou texto para criação de tarefas no ClickUp e/ou Notion.
- **FR7:** O sistema deve transcrever mensagens de áudio (Whisper API) e processar como comando de texto.
- **FR8:** O sistema deve gerenciar agenda via Google Calendar (criar, consultar e receber lembretes de eventos).
- **FR9:** O sistema deve gerar resumos estruturados de reuniões a partir de áudio ou anotações enviadas.
- **FR10:** O sistema deve enviar relatórios periódicos automáticos (semanal/mensal) consolidando dados do Notion e ClickUp.
- **FR11:** O Telegram Bot e a Web UI devem compartilhar o mesmo backend e manter contexto unificado entre os dois canais.
- **FR12:** O sistema deve suportar templates de estrutura Notion configuráveis por tipo de cliente ou projeto.
- **FR13:** O usuário deve poder buscar informações sobre clientes por comando ("o que combinei com o cliente X?").
- **FR14:** O sistema deve preencher automaticamente campos e propriedades do perfil do cliente no Notion com dados extraídos dos documentos.
- **FR15:** O sistema deve registrar automaticamente cada Plano de Ataque gerado e documento processado no histórico do cliente no Notion.
- **FR16:** O usuário deve poder consultar o status consolidado de um cliente via comando e receber resumo de tarefas, reuniões e documentos.
- **FR17:** O assistente deve enviar notificações proativas no Telegram quando houver tarefas vencendo (24h antes) ou reuniões agendadas (1h antes).
- **FR18:** O sistema deve suportar processamento de múltiplos documentos (3 ou mais) num único Plano de Ataque, identificando e rotulando cada fonte.
- **FR19:** Todos os outputs gerados pela IA devem usar formatação rica com Markdown: títulos hierárquicos, bullet points, tabelas, callouts e separadores visuais.
- **FR20:** O sistema deve aceitar mensagens de áudio via Web UI (botão de gravação integrado ao chat) e via Telegram (mensagem de voz nativa), transcrevendo e processando como comando.

### Non-Functional Requirements

- **NFR1:** O processamento de documentos deve ser concluído em menos de 60 segundos para arquivos de até 10MB.
- **NFR2:** O sistema deve rodar localmente (desenvolvimento) e em nuvem (produção) sem mudança de código.
- **NFR3:** Todas as API keys e credenciais devem ser gerenciadas via variáveis de ambiente, nunca hardcoded.
- **NFR4:** O Telegram Bot deve ter disponibilidade 24/7 quando em produção na nuvem.
- **NFR5:** O sistema deve suportar português como idioma primário em todas as interações.
- **NFR6:** Rate limiting implementado na API — máximo 30 requisições/minuto por usuário.
- **NFR7:** A arquitetura deve ser extensível para adicionar novas integrações sem refatoração do núcleo.
- **NFR8:** Logs de todas as operações devem ser mantidos localmente para auditoria.
- **NFR9:** Apenas o Telegram ID do usuário autorizado pode enviar comandos ao bot — whitelist configurável via variável de ambiente.
- **NFR10:** A Web UI deve exigir autenticação (senha ou token) para acesso — nenhum endpoint exposto publicamente sem autenticação.
- **NFR11:** Arquivos enviados para processamento devem ser tratados em memória e deletados imediatamente após a geração do output.
- **NFR12:** Todas as credenciais e API keys devem ser armazenadas exclusivamente em variáveis de ambiente (`.env`), nunca em código-fonte ou arquivos de log.
- **NFR13:** Logs de auditoria devem registrar apenas metadados de operações — nunca o conteúdo dos documentos ou dados sensíveis.
- **NFR14:** As animações da substância fluida devem usar `requestAnimationFrame` ou WebGL/Canvas para performance suave (60fps) sem impacto no carregamento.

---

## 3. User Interface Design Goals

### Overall UX Vision

ARIA é um assistente orgânico e vivo. A interface não é uma ferramenta — é uma presença. A tela inicial apresenta uma substância fluida em movimento contínuo, sugerindo que o assistente está ativo, respirando e aguardando. Quando um comando chega, ela reage. A experiência é premium, imersiva e minimalista — inspirada no Apple Vision Pro: fundos escuros profundos, glassmorphism, gradientes sutis e tipografia limpa.

### Key Interaction Paradigms

- **Conversacional:** toda interação via chat — sem formulários, sem menus complexos
- **Comandos naturais:** "processa esses docs para o cliente X" em vez de botões e cliques
- **Feedback imediato:** confirmações visuais de cada ação executada
- **Proativo:** o assistente avisa, lembra e sugere sem precisar ser perguntado

### Core Screens (Web UI)

1. **Tela Inicial** — substância fluida animada ao fundo, campo de entrada centralizado, identidade ARIA
2. **Chat Principal** — interface conversacional estilo LLM, área de mensagens + input com suporte a upload de arquivos e gravação de áudio
3. **Painel de Clientes** — lista rápida dos clientes recentes com status de última interação
4. **Histórico de Operações** — log visual das ações executadas
5. **Configurações** — gerenciar integrações, templates e preferências

### Fluid Substance Animation States

```yaml
idle:        "Movimento lento ao redor da tela, loop infinito, respiração suave"
listening:   "Aproxima-se do centro, pulsa no ritmo do áudio (waveform), cores mais vivas"
processing:  "Circular rápido e concentrado, partículas de luz percorrendo a substância"
responding:  "Expansão suave para fora + recuo — como um expirar — sincronizado com resposta"
success:     "Flash sutil, brilho verde/azul por 1s, retorno ao idle"
error:       "Tremor leve, tom avermelhado por 1-2s, retorno ao idle"
```

### Design References

| Elemento | Referência | Aplicação no ARIA |
|----------|-----------|-------------------|
| Página inicial | Apple Vision Pro Website Redesign | Fundo escuro, substância fluida animada ao redor da tela |
| Cards e painéis | Glass Style Profile (Glassmorphism) | Transparência com blur e borda luminosa |
| Movimento e fluidez | Apple AirPods Parallax Website | Animações orgânicas responsivas |
| Tipografia e espaçamento | Apple Website Clone | Inter/SF Pro, espaçamento generoso, hierarquia clara |
| Gradientes | Apple Vision Pro Website Redesign | Gradientes de profundidade roxo-azul-preto |

### Branding

Interface clean, minimalista e profissional. Dark mode como padrão. Paleta: fundo `#050508`, gradientes roxo-azul-preto, acentos em `#6366F1` (índigo). Glassmorphism nos cards: `backdrop-filter: blur(20px)`, borda luminosa sutil.

### Accessibility

WCAG AA — contraste mínimo garantido, navegação por teclado, labels em todos os campos.

### Target Platforms

- **Web UI:** Web Responsive (desktop-primary, funcional em mobile)
- **Telegram Bot:** Mobile-first via app nativo do Telegram

---

## 4. Technical Assumptions

### Repository Structure

**Monorepo** com a seguinte estrutura:

```
aria/
├── apps/
│   ├── web/          # Web UI (Next.js)
│   └── bot/          # Telegram Bot
├── packages/
│   ├── core/         # Lógica central (IA, processamento de docs)
│   ├── integrations/ # Notion, ClickUp, Google, Telegram
│   └── shared/       # Tipos, utils, constantes compartilhadas
├── docs/
├── .env.example
└── package.json
```

### Service Architecture

**Arquitetura híbrida — Monolith Modular com deploy flexível:**

| Serviço | Descrição | Deploy Local | Deploy Produção |
|---------|-----------|-------------|-----------------|
| `api-server` | Backend principal REST + WebSocket | localhost:3000 | VPS (PM2) |
| `web-ui` | Interface chat estilo LLM | localhost:3001 | Vercel |
| `telegram-bot` | Bot listener + webhook handler | polling local | Railway |
| `worker` | Processamento assíncrono de documentos | integrado ao api-server | VPS (PM2) |

**Stack principal** (decisão final pelo @architect):
- Backend: Node.js + TypeScript (Express ou Fastify)
- Frontend: Next.js + TailwindCSS + Framer Motion
- Animação: Three.js / WebGL (fallback: CSS Canvas)
- IA: Claude API — `claude-sonnet-4-6`
- Transcrição: Whisper API (OpenAI)
- Documentos: `pdf-parse` (PDF) + `mammoth` (Word/DOCX)

### Testing Requirements

- **Unit:** Lógica de negócio (processamento de docs, geração de conteúdo, parsing de comandos)
- **Integration:** Integrações com APIs externas (Notion, ClickUp, Google Calendar, Claude)
- **E2E:** Fluxo completo do "Plano de Ataque" (doc enviado → página criada no Notion)
- **Manual:** Validação visual da Web UI e comportamento da substância fluida

### Additional Technical Assumptions

- Sem banco de dados próprio no MVP — Notion e ClickUp funcionam como datastores
- Autenticação Web UI: JWT com senha master configurável via `.env`
- Autenticação Telegram: whitelist de IDs via `.env`
- Deploy nuvem: Railway (bot) + Vercel (web) + VPS simples (API)
- Variáveis de ambiente: `.env` local, secrets no painel do provedor em produção
- Cron jobs: node-cron para notificações e relatórios automáticos

---

## 5. Epic List

| # | Epic | Objetivo |
|---|------|----------|
| 1 | Foundation & Infrastructure | Base técnica completa — monorepo, API, Bot e Web UI funcionais com IA |
| 2 | Document Processing & Client Management | Fluxo MVP: documentos → Plano de Ataque no Notion |
| 3 | Task Management & Audio | Tarefas por voz/texto no ClickUp e Notion + status de clientes |
| 4 | Calendar, Meetings & Notifications | Agenda, resumos de reuniões e notificações proativas |
| 5 | Reports & Analytics | Relatórios automáticos periódicos e análises ad-hoc |
| 6 | Visual Polish & Production Deploy | Substância fluida, identidade visual completa e deploy em produção |

---

## 6. Epic Details

---

### Epic 1 — Foundation & Infrastructure

**Objetivo:** Estabelecer base técnica completa. Ao final, o usuário envia uma mensagem pelo Telegram e pela Web UI e recebe resposta da IA — com autenticação ativa em ambos os canais.

#### Story 1.1 — Monorepo Setup & Dev Environment
*Como desenvolvedor, quero um monorepo configurado com TypeScript, linting e variáveis de ambiente, para que o projeto tenha uma base consistente e escalável desde o início.*

**Acceptance Criteria:**
1. Monorepo criado com estrutura `apps/web`, `apps/bot`, `packages/core`, `packages/integrations`, `packages/shared`
2. TypeScript configurado em todos os pacotes com `tsconfig.json` base compartilhado
3. ESLint + Prettier configurados com regras consistentes
4. Arquivo `.env.example` documentando todas as variáveis necessárias
5. Scripts npm funcionais: `dev`, `build`, `lint`, `test` na raiz

#### Story 1.2 — Backend API Server & Claude Integration
*Como sistema, quero um servidor API rodando com integração ao Claude, para que todos os serviços tenham um núcleo de IA funcional.*

**Acceptance Criteria:**
1. Servidor Express/Fastify com TypeScript rodando na porta configurável via `.env`
2. Endpoint `GET /health` retornando status 200 com uptime
3. Endpoint `POST /chat` recebendo `{ message, context[] }` e retornando resposta do Claude API
4. Contexto de conversa mantido em memória por sessão
5. Logs estruturados de todas as requisições (sem conteúdo sensível — NFR13)
6. Tratamento de erros centralizado com mensagens padronizadas

#### Story 1.3 — Telegram Bot — Autenticação & Chat Básico
*Como usuário, quero enviar mensagens ao bot do Telegram e receber respostas da IA, com garantia de que apenas eu consigo acessar o bot.*

**Acceptance Criteria:**
1. Telegram Bot conectado via webhook ou polling
2. Whitelist de Telegram IDs configurável via `.env` (NFR9)
3. Mensagens de IDs não autorizados ignoradas silenciosamente
4. Mensagem de texto → Claude API → resposta enviada no chat
5. Comando `/start` retorna mensagem de boas-vindas da ARIA
6. Comando `/help` lista os comandos disponíveis

#### Story 1.4 — Web UI — Interface de Chat com Autenticação
*Como usuário, quero acessar uma interface web protegida por senha e conversar com a ARIA, para ter uma alternativa ao Telegram no desktop.*

**Acceptance Criteria:**
1. Aplicação Next.js com tela de login protegida por senha (JWT — NFR10)
2. Interface de chat com: lista de mensagens, campo de input, botão de envio
3. Mensagens enviadas chegam ao backend e retornam resposta da IA com streaming
4. Indicador visual de "ARIA está digitando..." durante processamento
5. Upload de arquivo (PDF/Word) disponível no input (placeholder — sem processamento)
6. Responsivo para desktop e mobile
7. Dark mode como padrão visual (base da identidade ARIA)

#### Story 1.5 — Contexto Unificado Entre Canais
*Como usuário, quero que o Telegram e a Web UI compartilhem o mesmo contexto de conversa, para que eu possa alternar entre os dois sem perder continuidade.*

**Acceptance Criteria:**
1. Sessão identificada por usuário (não por canal) no backend
2. Mensagem enviada no Telegram aparece no histórico da Web UI e vice-versa
3. Contexto de conversa persistido em memória durante a sessão ativa
4. Ao reiniciar o servidor, nova sessão iniciada (persistência em banco de dados fora do escopo do MVP)

---

### Epic 2 — Document Processing & Client Management *(MVP Core)*

**Objetivo:** Implementar o fluxo completo do "Plano de Ataque" — do documento recebido à página estruturada no Notion. Ao final, o usuário envia 2 PDFs, indica o cliente, e encontra tudo organizado no Notion pronto para apresentação.

#### Story 2.1 — Notion API Integration & Client Lookup
*Como usuário, quero dizer "cliente: Empresa X" e a ARIA localizar automaticamente o perfil dessa empresa no Notion.*

**Acceptance Criteria:**
1. Integração com Notion API configurada via token no `.env`
2. Busca de página de cliente por nome (parcial, insensível a maiúsculas)
3. Quando encontrado: retorna confirmação "✅ Cliente *Empresa X* encontrado"
4. Quando não encontrado: retorna lista dos 3 clientes mais similares para o usuário escolher
5. ID da página do cliente armazenado em contexto da sessão
6. Leitura de propriedades básicas do perfil do cliente (nome, segmento, responsável)

#### Story 2.2 — Document Upload & Parsing
*Como usuário, quero enviar arquivos PDF ou Word via Telegram ou Web UI e ter o conteúdo extraído automaticamente.*

**Acceptance Criteria:**
1. Recebimento de arquivos PDF e Word/DOCX via Telegram e Web UI
2. Extração de texto de PDFs com `pdf-parse`
3. Extração de texto de Word/DOCX com `mammoth`
4. Arquivo processado em memória e deletado imediatamente (NFR11)
5. Suporte a múltiplos arquivos em sequência (até 5 documentos)
6. Feedback: "📄 *Setor Comercial.pdf* recebido e processado (3.2KB)"
7. Arquivos acima de 10MB rejeitados com mensagem clara

#### Story 2.3 — AI Document Interpretation & Content Generation
*Como usuário, quero que a ARIA interprete os documentos e gere resumos e checklists estratégicos automaticamente.*

**Acceptance Criteria:**
1. Conteúdo extraído enviado ao Claude API com prompt estruturado
2. Geração de Resumo do Setor Comercial — pontos-chave, objetivos, desafios
3. Geração de Resumo do Setor de Marketing — pontos-chave, estratégias, oportunidades
4. Geração de Análise Integrada — cruzamento entre setores, gaps e sinergias
5. Geração de Checklists Práticos — ações concretas por prioridade
6. Output com formatação rica: `#`, `-`, tabelas, callouts, separadores (FR19)
7. Preview do conteúdo enviado ao usuário antes de criar no Notion

#### Story 2.4 — Plano de Ataque Page Creation in Notion
*Como usuário, quero que a ARIA crie automaticamente uma página "Plano de Ataque" no Notion, organizada e pronta para apresentação.*

**Acceptance Criteria:**
1. Página criada com título: `🎯 Plano de Ataque — [Data]`
2. Blocos Notion: `heading_1`, `heading_2`, `bulleted_list`, `to_do`, `callout`, `divider`
3. Seções em ordem: Contexto Geral → Resumo Comercial → Resumo Marketing → Análise Integrada → Checklists
4. Checklists criados como blocos `to_do` nativos do Notion
5. Callouts para insights críticos com ícone emoji relevante
6. Link direto para a página enviado ao usuário
7. Confirmação: "✅ Plano de Ataque criado no Notion para *Empresa X* — [link]"

#### Story 2.5 — Client Properties Auto-Fill & History
*Como usuário, quero que informações extraídas dos documentos preencham automaticamente o cadastro do cliente no Notion.*

**Acceptance Criteria:**
1. Extração de metadados: responsável comercial, marketing, metas, desafios, segmento
2. Propriedades do cliente atualizadas via Notion API (FR14)
3. Registro automático no histórico: data, tipo de operação, documentos, link da página (FR15)
4. Propriedades existentes não sobrescritas sem confirmação
5. Confirmação: "📋 Perfil de *Empresa X* atualizado com 4 novos campos"

#### Story 2.6 — Multi-Document Support
*Como usuário, quero enviar 3 ou mais documentos num único Plano de Ataque, para incluir setores adicionais na análise.*

**Acceptance Criteria:**
1. Sistema aceita de 2 a 5 documentos por sessão de Plano de Ataque
2. Cada documento identificado e rotulado pelo usuário
3. Seção dedicada gerada para cada documento na página Notion
4. Análise Integrada considera todos os documentos fornecidos
5. Interface guia: "Envie o próximo documento ou digite *pronto* para gerar o Plano de Ataque"

---

### Epic 3 — Task Management & Audio

**Objetivo:** Criar tarefas no ClickUp e Notion por voz ou texto em linguagem natural, com transcrição automática.

#### Story 3.1 — Audio Transcription (Whisper API)
*Como usuário, quero enviar mensagens de voz e ter o áudio transcrito automaticamente.*

**Acceptance Criteria:**
1. Integração com Whisper API configurada via token no `.env`
2. Telegram: mensagem de voz → transcrita → processada como comando
3. Web UI: botão de gravação → grava → envia → transcrito → processado
4. Indicador visual: "🎙 Transcrevendo áudio..."
5. Transcrição exibida antes de processar
6. Arquivos de áudio deletados após transcrição (NFR11)
7. Suporte a áudios de até 5 minutos

#### Story 3.2 — ClickUp Integration & Task Creation
*Como usuário, quero criar tarefas no ClickUp via texto ou áudio.*

**Acceptance Criteria:**
1. Integração com ClickUp API configurada via token no `.env`
2. Criação de tarefa com: título, descrição, data de vencimento e prioridade
3. Usuário pode especificar lista/projeto
4. Lista padrão configurável via `.env`
5. Confirmação: "✅ Tarefa criada no ClickUp: *Ligar para Empresa X* — vence sexta"
6. Link direto para a tarefa incluído na confirmação

#### Story 3.3 — Notion Task Creation
*Como usuário, quero criar tarefas e anotações no Notion via texto ou áudio.*

**Acceptance Criteria:**
1. Criação de item em database do Notion configurável via `.env`
2. Suporte a criação vinculada ao cliente: "cria tarefa para Empresa X no Notion"
3. Tarefa criada com: título, status (A fazer), data, cliente relacionado
4. Quando vinculada a cliente: item adicionado dentro do perfil do cliente
5. Confirmação com link direto

#### Story 3.4 — Natural Language Task Parsing
*Como usuário, quero usar linguagem natural para criar tarefas sem seguir sintaxe rígida.*

**Acceptance Criteria:**
1. Claude API extrai entidades: título, data, hora, cliente, prioridade, destino
2. Datas relativas interpretadas: "amanhã", "sexta", "semana que vem"
3. Quando destino não especificado: pergunta "Criar no ClickUp, Notion ou em ambos?"
4. Quando data não especificada: tarefa criada sem prazo com confirmação
5. Nome de cliente detectado → tarefa vinculada automaticamente
6. Comandos ambíguos: ARIA pede confirmação antes de criar

#### Story 3.5 — Client Status Command
*Como usuário, quero consultar o status consolidado de um cliente rapidamente.*

**Acceptance Criteria:**
1. Comando reconhecido em variações: "status do cliente X", "resumo da Empresa X"
2. Dados consolidados: tarefas abertas no ClickUp, últimas anotações no Notion, Planos criados, próximas reuniões
3. Resposta formatada com emojis: ✅ concluído, 🔴 atrasado, 📅 agendado
4. Resposta no mesmo canal onde o comando foi feito
5. Link direto para o perfil completo no Notion

---

### Epic 4 — Calendar, Meetings & Notifications

**Objetivo:** Integrar Google Calendar, gerar resumos de reuniões e ativar notificações proativas no Telegram.

#### Story 4.1 — Google Calendar Integration & Event Management
*Como usuário, quero criar e consultar eventos no Google Calendar via comando.*

**Acceptance Criteria:**
1. Integração com Google Calendar API via OAuth2
2. Criação de evento: "agenda reunião com Empresa X na quinta às 14h"
3. Consulta: "o que tenho hoje?", "quais reuniões tenho essa semana?"
4. Evento criado com: título, data, hora, duração padrão 1h (ajustável)
5. Confirmação: "📅 Reunião com *Empresa X* agendada para quinta, 14h" com link
6. Cancelamento por comando

#### Story 4.2 — Meeting Summaries & Follow-ups
*Como usuário, quero enviar áudio ou anotações de reunião e receber resumo estruturado com próximos passos.*

**Acceptance Criteria:**
1. Usuário envia áudio ou texto com indicação do cliente
2. IA gera: Participantes, Pauta, Decisões, Próximos Passos
3. Próximos passos convertidos em tarefas no ClickUp
4. Resumo salvo no perfil do cliente no Notion: `📝 Reunião — [Data]`
5. Link para a página enviado ao usuário
6. Registro adicionado ao histórico do cliente (FR15)

#### Story 4.3 — Proactive Notifications & Daily Briefing
*Como usuário, quero notificações automáticas no Telegram e briefing diário da minha agenda.*

**Acceptance Criteria:**
1. Lembrete de reunião enviado 1h antes (FR17)
2. Lembrete de tarefa vencendo enviado 24h antes (FR17)
3. Briefing diário às 8h (configurável via `.env`)
4. Briefing inclui: reuniões do dia, tarefas com prazo hoje, tarefas atrasadas
5. Notificações formatadas com emojis: 📅 reunião, 🔴 atrasado, ⚠️ vencendo
6. Comando para silenciar: "silencia alertas por 2 horas"
7. Cron job configurado para local e produção

---

### Epic 5 — Reports & Analytics

**Objetivo:** Automatizar geração e entrega de relatórios periódicos com análise narrativa gerada por IA.

#### Story 5.1 — Report Data Aggregation
*Como sistema, quero coletar dados do Notion, ClickUp e Google Calendar num modelo estruturado.*

**Acceptance Criteria:**
1. Coleta do ClickUp: tarefas concluídas, pendentes, atrasadas e criadas no período
2. Coleta do Notion: clientes ativos, Planos criados, reuniões registradas
3. Coleta do Google Calendar: reuniões realizadas e agendadas
4. Dados normalizados em modelo JSON estruturado
5. Erro em uma fonte não bloqueia o relatório — marcada como "dados parciais"
6. Modelo extensível para novas fontes

#### Story 5.2 — AI Report Generation
*Como usuário, quero relatórios semanais e mensais com análise narrativa gerada pela IA.*

**Acceptance Criteria:**
1. Relatório semanal: produtividade, clientes atendidos, tarefas concluídas vs pendentes, destaques
2. Relatório mensal: visão consolidada, tendências, clientes mais ativos, alertas de inatividade
3. Formatação rica: títulos, tabelas comparativas, bullets, callouts (FR19)
4. Análise narrativa com insights acionáveis pelo Claude API
5. Seção "Atenção necessária": tarefas muito atrasadas, clientes sem contato há +2 semanas
6. Gerado em menos de 60 segundos (NFR1)

#### Story 5.3 — Scheduled Report Delivery
*Como usuário, quero receber relatórios automaticamente no Telegram e por e-mail.*

**Acceptance Criteria:**
1. Relatório semanal toda segunda-feira às 8h (configurável via `.env`)
2. Relatório mensal no primeiro dia útil de cada mês
3. Entrega via Telegram (mensagem + link para completo)
4. Entrega via e-mail (Gmail API) com relatório no corpo
5. Relatório salvo no Notion em página `📊 Relatórios`
6. Comando sob demanda: "gera relatório da semana"

#### Story 5.4 — On-Demand Document Analysis
*Como usuário, quero enviar qualquer documento e pedir análise específica sem estar vinculado ao fluxo do Plano de Ataque.*

**Acceptance Criteria:**
1. Instrução livre: "resume esse contrato", "extrai dados numéricos", "compara com o anterior"
2. IA interpreta e aplica o tipo de análise solicitado
3. Resposta com formatação rica (FR19)
4. Usuário pode solicitar: "salva isso no Notion"
5. Sem vínculo obrigatório com perfil de cliente
6. Suporte a comparativo entre 2 documentos na mesma sessão

---

### Epic 6 — Visual Polish & Production Deploy

**Objetivo:** Implementar identidade visual completa da ARIA e configurar deploy em produção estável e seguro.

#### Story 6.1 — Fluid Substance Animation
*Como usuário, quero ver a substância fluida animada reagindo aos meus comandos na Web UI.*

**Acceptance Criteria:**
1. Substância fluida implementada com Three.js ou WebGL Canvas
2. 6 estados implementados: IDLE, LISTENING, PROCESSING, RESPONDING, SUCCESS, ERROR
3. Transições suaves entre estados
4. 60fps sem degradar performance (NFR14)
5. Fallback CSS puro quando WebGL não disponível

#### Story 6.2 — Full Visual Design Implementation
*Como usuário, quero que a Web UI tenha a identidade visual completa da ARIA.*

**Acceptance Criteria:**
1. Paleta: fundo `#050508`, gradientes roxo-azul-preto, acentos `#6366F1`
2. Glassmorphism: `backdrop-filter: blur(20px)`, borda luminosa, transparência
3. Tipografia: Inter com fallback SF Pro
4. Chat: bolhas diferenciadas, timestamps, scroll suave
5. Transições com Framer Motion (300ms ease)
6. Tela de login com substância fluida ao fundo
7. Painel lateral com glassmorphism
8. 100% responsivo

#### Story 6.3 — Production Deployment
*Como usuário, quero a ARIA disponível 24/7 na nuvem.*

**Acceptance Criteria:**
1. Telegram Bot no Railway com variáveis de ambiente configuradas (NFR12)
2. Web UI na Vercel com HTTPS automático
3. API Server no VPS com PM2
4. Deploy automático via push na branch `main`
5. Health check com reinício automático em caso de crash
6. `.env.production.example` documentado
7. `docs/DEPLOY.md` criado

#### Story 6.4 — Security Hardening & Monitoring
*Como usuário, quero que a ARIA em produção seja segura e monitorada.*

**Acceptance Criteria:**
1. Rate limiting: 30 req/min por usuário (NFR6)
2. Headers de segurança com `helmet.js`
3. Logs sem dados sensíveis com rotação a cada 7 dias (NFR13)
4. Uptime check a cada 5 min com alerta no Telegram em caso de queda
5. Nenhuma credencial em código ou log (NFR12)
6. Teste de autenticação: 401 em todos endpoints sem credenciais

---

## 7. Next Steps

### UX Expert Prompt

> **@ux-design-expert** — Com base no PRD do projeto ARIA (`docs/prd.md`), crie as especificações detalhadas de UX/UI. Foco principal: (1) substância fluida animada com 6 estados comportamentais usando Three.js/WebGL, (2) sistema de design com glassmorphism e paleta Apple Vision Pro (`#050508` + gradientes roxo-azul + acentos `#6366F1`), (3) especificação de componentes do chat interface. Use as referências: Apple Vision Pro Website Redesign, Glassmorphism Profile, Apple AirPods Parallax.

### Architect Prompt

> **@architect** — Com base no PRD do projeto ARIA (`docs/prd.md`), crie a arquitetura técnica completa. Decisões necessárias: (1) confirmar stack Node.js/TypeScript + Next.js ou propor alternativa, (2) definir estrutura do monorepo e comunicação entre serviços, (3) estratégia de integração com Notion, ClickUp, Google Calendar, Telegram e Whisper APIs, (4) sugerir estrutura de templates de página Notion para o "Plano de Ataque", (5) definir estratégia de contexto de conversa unificado entre Telegram Bot e Web UI.
