'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
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
  const {
    messages,
    isStreaming,
    streamingContent,
    addMessage,
    setStreaming,
    appendStreamChunk,
    commitStreamedMessage,
  } = useChatStore();

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

  return {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
  };
}
