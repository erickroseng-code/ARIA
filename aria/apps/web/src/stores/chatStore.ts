import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number; // Store as Unix timestamp instead of Date object
  sessionId: string;
  contentType: 'text';
}

interface ChatStore {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  pendingDocumentsCount: number;
  addMessage: (msg: Message) => void;
  setStreaming: (v: boolean) => void;
  appendStreamChunk: (chunk: string) => void;
  commitStreamedMessage: () => void;
  setPendingDocumentsCount: (count: number) => void;
  clear: () => void;
}

// Helper to generate client-side UUID (only on client)
const generateClientUUID = () => {
  if (typeof window === 'undefined') return 'server-placeholder';
  return crypto.randomUUID();
};

// Helper to get current timestamp (only on client)
const getClientTimestamp = () => {
  if (typeof window === 'undefined') return 0;
  return Date.now();
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: [],
      isStreaming: false,
      streamingContent: '',
      pendingDocumentsCount: 0,

      addMessage: (msg) =>
        set((s) => ({ messages: [...s.messages, msg] })),

      setStreaming: (v) => set({ isStreaming: v }),

      appendStreamChunk: (chunk) =>
        set((s) => ({ streamingContent: s.streamingContent + chunk })),

      commitStreamedMessage: () =>
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id: generateClientUUID(),
              role: 'assistant' as const,
              content: s.streamingContent,
              timestamp: getClientTimestamp(),
              sessionId: '',
              contentType: 'text' as const,
            },
          ],
          streamingContent: '',
          isStreaming: false,
        })),

      setPendingDocumentsCount: (count) => set({ pendingDocumentsCount: count }),

      clear: () => set({ messages: [], streamingContent: '', isStreaming: false, pendingDocumentsCount: 0 }),
    }),
    {
      name: 'aria-chat-history',
      // Only persist messages — exclude ephemeral streaming state
      partialize: (state) => ({
        messages: state.messages.slice(-50), // Keep last 50 messages
      }),
    }
  )
);
