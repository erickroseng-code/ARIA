'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore, type Message } from '@/stores/chatStore';
import { streamMessage } from '@/services/chat.service';

// Helper to generate client-side UUID (only on client)
const generateClientUUID = () => {
  if (typeof window === 'undefined') return 'placeholder';
  return crypto.randomUUID();
};

// Helper to get current timestamp (only on client)
const getClientTimestamp = () => {
  if (typeof window === 'undefined') return 0;
  return Date.now();
};

export function useChat() {
  const store = useChatStore();
  const {
    isStreaming,
    streamingContent,
    addMessage,
    setStreaming,
    appendStreamChunk,
    commitStreamedMessage,
  } = store;
  const messages = store.messages();

  const sessionIdRef = useRef<string>('');
  const isInitializedRef = useRef(false);

  // Initialize session ID only once on client
  useEffect(() => {
    if (isInitializedRef.current || typeof window === 'undefined') return;

    isInitializedRef.current = true;

    const storedSessionId = sessionStorage.getItem('aria-session-id');
    if (storedSessionId) {
      sessionIdRef.current = storedSessionId;
    } else {
      sessionIdRef.current = `web_${generateClientUUID()}`;
      sessionStorage.setItem('aria-session-id', sessionIdRef.current);
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming || !sessionIdRef.current) return;

      const sessionId = sessionIdRef.current;

      // Add user message with client-generated values
      addMessage({
        id: generateClientUUID(),
        role: 'user',
        content,
        timestamp: getClientTimestamp(),
        sessionId,
        contentType: 'text',
      });

      setStreaming(true);

      try {
        for await (const chunk of streamMessage(content, sessionId)) {
          appendStreamChunk(chunk);
        }
        commitStreamedMessage();
      } catch (error) {
        console.error('Stream error:', error);
        commitStreamedMessage(); // Save the partial response instead of discarding it!
      }
    },
    [isStreaming, addMessage, setStreaming, appendStreamChunk, commitStreamedMessage]
  );

  const regenerateResponse = useCallback(
    async () => {
      const currentMessages = store.messages();
      if (currentMessages.length < 1 || isStreaming) return;

      let lastUserMsg: Message | null = null;
      let assistantMsgIdToRemove: string | null = null;

      // Find the last assistant message to remove and the user message before it
      for (let i = currentMessages.length - 1; i >= 0; i--) {
        const msg = currentMessages[i];
        if (msg.role === 'assistant' && !assistantMsgIdToRemove) {
          assistantMsgIdToRemove = msg.id;
        } else if (msg.role === 'user' && !lastUserMsg) {
          lastUserMsg = msg;
          break;
        }
      }

      if (!lastUserMsg) return;

      if (assistantMsgIdToRemove) {
        store.removeMessageById(assistantMsgIdToRemove);
      }

      setStreaming(true);
      const sessionId = sessionIdRef.current;

      try {
        for await (const chunk of streamMessage(lastUserMsg.content, sessionId)) {
          appendStreamChunk(chunk);
        }
        commitStreamedMessage();
      } catch (error) {
        console.error('Stream error:', error);
        commitStreamedMessage();
      }
    },
    [isStreaming, store, setStreaming, appendStreamChunk, commitStreamedMessage]
  );

  return {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    regenerateResponse,
  };
}
