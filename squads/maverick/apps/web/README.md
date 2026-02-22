# Maverick Web App (Frontend)

Este diretório é destinado ao código fonte do frontend gerado via **Lovable.dev** ou desenvolvido manualmente.

## 📥 Como Instalar o Código do Lovable

1.  No Lovable, exporte o projeto (Download ZIP ou GitHub Sync).
2.  Extraia o conteúdo do ZIP **dentro desta pasta** (`squads/maverick/apps/web`).
    - Certifique-se de que o `package.json` do Lovable esteja diretamente aqui.
3.  Instale as dependências:
    ```bash
    npm install
    # ou
    pnpm install
    # ou
    yarn
    ```

## 🚀 Como Rodar Localmente

```bash
npm run dev
```
O app estará disponível em `http://localhost:5173` (ou porta similar).

## 🔌 Integração com AIOS (Backend)

O frontend deve se comunicar com o backend do Maverick (rodando no AIOS) através de chamadas de API.
- **Backend URL:** `http://localhost:3000/api/maverick` (Exemplo)
- **Dados Mockados:** Inicialmente, o Lovable usa `src/data.ts` ou similar. Substitua gradualmente por `fetch()` para o backend.

## 🛠️ Stack Recomendada
- **Framework:** React + Vite
- **UI:** Shadcn UI + Tailwind CSS
- **Ícones:** Lucide React
- **Gerenciamento de Estado:** TanStack Query (React Query) ou Zustand
