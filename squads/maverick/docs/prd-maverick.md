# 📋 Maverick Squad - PRD (Product Requirements Document)

## 1. Visão Geral (Contexto)
O **Squad Maverick** é uma unidade de inteligência focada em automação de conteúdo estratégico. O diferencial do squad é unir a análise técnica e comportamental de perfis sociais com uma base de conhecimento semântica (RAG), garantindo que os roteiros e artes gerados não sejam apenas genéricos, mas sim baseados em autoridade técnica e no tom de voz específico do cliente.

### 1.1 Objetivo
Automatizar o ciclo completo de criação de conteúdo: Diagnóstico -> Pesquisa -> Estratégia -> Roteirização -> Design.

---

## 2. Personas & Agentes
| Agente | Papel | Responsabilidade |
| :--- | :--- | :--- |
| **Maverick Scout** | Analista de Redes | Extração de Tom de Voz, Bio e Posts. |
| **Maverick Scholar** | Gestor de Conhecimento | Gerenciamento de RAG de Livros e Vídeos. |
| **Maverick Strategist** | Estrategista | Diagnóstico comparativo e sugestões de pauta. |
| **Maverick Copywriter** | Roteirista | Criação de roteiros e legendas autorais. |
| **Maverick Designer** | Automação Visual | Criação de artes baseadas nos roteiros. |

---

## 3. Requisitos Funcionais (Core Loop)
- **FR1:** Análise de perfil social (Scout) para definir tom de voz.
- **FR2:** Busca semântica em base de conhecimento (Scholar) para embasamento técnico.
- **FR3:** Geração de relatório de diagnóstico (Strategist) cruzando perfil vs conhecimento.
- **FR4:** Produção de roteiros (Copywriter) com base no diagnóstico.
- **FR5:** Geração de referências/artes (Designer) para os roteiros.

---

## 4. Estrutura de Entrega (Milestones)

### Fase 1: Fundação & Coleta (Story 1.1 e 1.2)
- [ ] Implementação da Task `analyze-social-profile.md`.
- [ ] Implementação da Task `search-semantic-knowledge.md`.
- [ ] Configuração do diretório de dados em `squads/maverick/data/`.

### Fase 2: Estratégia & Diagnóstico (Story 1.3)
- [ ] Implementação da Task `diagnose-profile-vs-knowledge.md`.
- [ ] Geração do snapshot de diagnóstico em Markdown.

### Fase 3: Produção Final (Story 1.4)
- [ ] Implementação da Task `write-creative-script.md`.
- [ ] Implementação da Task `generate-visual-design.md`.

---

## 5. Arquitetura de Dados
- **Knowledge Base:** `./data/knowledge/`
- **Snapshots:** `./data/snapshots/`
- **Deliverables:** `./data/deliverables/`

---
— Morgan, planejando o futuro 📊