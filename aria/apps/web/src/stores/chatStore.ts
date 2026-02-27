import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sessionId: string;
  contentType: 'text';
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

interface ChatStore {
  conversations: Conversation[];
  activeConversationId: string;
  isStreaming: boolean;
  streamingContent: string;
  pendingDocumentsCount: number;
  isHubOpen: boolean;

  // Getters
  activeConversation: () => Conversation | undefined;
  messages: () => Message[];

  // Actions
  startNewConversation: () => string;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  addMessage: (msg: Message) => void;
  setStreaming: (v: boolean) => void;
  appendStreamChunk: (chunk: string) => void;
  commitStreamedMessage: () => void;
  setPendingDocumentsCount: (count: number) => void;
  setHubOpen: (v: boolean) => void;
  clear: () => void;
}

const generateId = () => {
  if (typeof window === 'undefined') return 'server-placeholder';
  return crypto.randomUUID();
};

const now = () => {
  if (typeof window === 'undefined') return 0;
  return Date.now();
};

/**
 * Extracts a clean, theme-based title from the first user message.
 * Strips common Portuguese question prefixes to surface the core topic.
 */
function extractTitle(message: string): string {
  let text = message.trim();

  // Remove leading question/command starters (case-insensitive)
  const prefixes = [
    /^(qual é|quais são|quais|qual)/i,
    /^(o que (tenho|tem|há|está)?)/i,
    /^(me (mostre|mostra|traga|manda|diga|fale sobre|liste|resuma|resume))/i,
    /^(como (está|estão|fica|ficou))/i,
    /^(quero|preciso|pode|poderia|gostaria de)/i,
    /^(verifica|verifique|checa|cheque|lista|listar|busca|buscar)/i,
    /^(agende|agenda|cria|crie|adiciona|adicione|inclui|inclua|manda|envia|envie)/i,
  ];

  for (const rx of prefixes) {
    text = text.replace(rx, '').trim();
  }

  // Remove trailing punctuation
  text = text.replace(/[?!.,]+$/, '').trim();

  // Capitalize first letter
  text = text.charAt(0).toUpperCase() + text.slice(1);

  // Clamp to 38 chars
  if (text.length > 38) text = text.slice(0, 37) + '…';

  // Fallback if we stripped everything
  return text || message.slice(0, 38);
}

const createConversation = (): Conversation => ({
  id: generateId(),
  title: 'Nova Conversa',
  createdAt: now(),
  messages: [],
});

const INITIAL_CONV = createConversation();

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      conversations: [INITIAL_CONV],
      activeConversationId: INITIAL_CONV.id,
      isStreaming: false,
      streamingContent: '',
      pendingDocumentsCount: 0,
      isHubOpen: false,

      activeConversation: () =>
        get().conversations.find((c) => c.id === get().activeConversationId),

      messages: () =>
        get().activeConversation()?.messages ?? [],

      startNewConversation: () => {
        const conv = createConversation();
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeConversationId: conv.id,
          streamingContent: '',
          isStreaming: false,
        }));
        return conv.id;
      },

      switchConversation: (id) =>
        set({ activeConversationId: id, streamingContent: '', isStreaming: false }),

      deleteConversation: (id) =>
        set((s) => {
          const remaining = s.conversations.filter((c) => c.id !== id);
          // If we deleted the active conversation, switch to most recent or create new
          if (s.activeConversationId !== id) {
            return { conversations: remaining };
          }
          if (remaining.length > 0) {
            return { conversations: remaining, activeConversationId: remaining[0].id, streamingContent: '', isStreaming: false };
          }
          // No conversations left — create a fresh one
          const fresh = { id: generateId(), title: 'Nova Conversa', createdAt: now(), messages: [] };
          return { conversations: [fresh], activeConversationId: fresh.id, streamingContent: '', isStreaming: false };
        }),

      addMessage: (msg) =>
        set((s) => {
          const updated = s.conversations.map((c) => {
            if (c.id !== s.activeConversationId) return c;
            const messages = [...c.messages, msg];
            // Auto-title: extract theme from first user message
            const title =
              c.title === 'Nova Conversa' && msg.role === 'user'
                ? extractTitle(msg.content)
                : c.title;
            return { ...c, messages, title };
          });
          return { conversations: updated };
        }),

      setStreaming: (v) => set({ isStreaming: v }),

      appendStreamChunk: (chunk) =>
        set((s) => ({ streamingContent: s.streamingContent + chunk })),

      commitStreamedMessage: () =>
        set((s) => {
          const assistantMsg: Message = {
            id: generateId(),
            role: 'assistant',
            content: s.streamingContent,
            timestamp: now(),
            sessionId: '',
            contentType: 'text',
          };
          const updated = s.conversations.map((c) =>
            c.id !== s.activeConversationId
              ? c
              : { ...c, messages: [...c.messages, assistantMsg] }
          );
          return {
            conversations: updated,
            streamingContent: '',
            isStreaming: false,
          };
        }),

      setPendingDocumentsCount: (count) => set({ pendingDocumentsCount: count }),

      setHubOpen: (v) => set({ isHubOpen: v }),

      clear: () =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id !== s.activeConversationId ? c : { ...c, messages: [] }
          ),
          streamingContent: '',
          isStreaming: false,
          pendingDocumentsCount: 0,
        })),
    }),
    {
      name: 'aria-chat-v2',
      partialize: (state) => ({
        conversations: state.conversations.map((c) => ({
          ...c,
          messages: c.messages.slice(-50),
        })),
        activeConversationId: state.activeConversationId,
      }),
    }
  )
);
