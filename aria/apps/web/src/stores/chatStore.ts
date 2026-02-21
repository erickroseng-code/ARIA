import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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

export const useChatStore = create<ChatStore>((set) => ({
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
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: s.streamingContent,
          timestamp: new Date(),
          sessionId: '',
          contentType: 'text' as const,
        },
      ],
      streamingContent: '',
      isStreaming: false,
    })),

  setPendingDocumentsCount: (count) => set({ pendingDocumentsCount: count }),

  clear: () => set({ messages: [], streamingContent: '', isStreaming: false, pendingDocumentsCount: 0 }),
}));
